use crate::middleware::auth::Claims;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query,
    },
    http::StatusCode,
    response::Response,
};
use futures_util::{SinkExt, StreamExt};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::Deserialize;
use serde_json;
use ssh2::Session;
use std::net::TcpStream;
use tokio::sync::mpsc;

#[derive(Deserialize)]
pub struct WsQuery {
    token: Option<String>,
    session_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(tag = "type")]
enum TerminalMessage {
    #[serde(rename = "resize")]
    Resize { cols: u32, rows: u32 },
}

pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    Query(params): Query<WsQuery>,
) -> Result<Response, StatusCode> {
    // Validate JWT token from query params
    let token = params.token.ok_or(StatusCode::UNAUTHORIZED)?;

    let secret = std::env::var("JWT_SECRET")
        .expect("JWT_SECRET environment variable must be set for production use");

    let token_data = decode::<Claims>(
        &token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|_| StatusCode::UNAUTHORIZED)?;

    // Get username directly from JWT
    let username = token_data.claims.sub;

    tracing::info!(
        "WebSocket connection authorized for user: {}",
        username
    );

    let session_id = params.session_id.unwrap_or_else(|| "default".to_string());

    Ok(ws.on_upgrade(move |socket| handle_socket(socket, username, session_id)))
}

async fn handle_socket(socket: WebSocket, username: String, session_id: String) {
    tracing::info!(
        "WebSocket connection established for user: {} (session: {})",
        username,
        session_id
    );

    let (mut sender, mut receiver) = socket.split();

    // Wait for password from first message (sent by frontend)
    let password = match receiver.next().await {
        Some(Ok(Message::Text(pwd))) => pwd.trim().to_string(),
        Some(Ok(Message::Binary(data))) => String::from_utf8_lossy(&data).trim().to_string(),
        _ => {
            let _ = sender
                .send(Message::Text("Error: No password received\r\n".to_string()))
                .await;
            return;
        }
    };

    // Send connecting message
    let _ = sender
        .send(Message::Text("Connecting to SSH server...\r\n".to_string()))
        .await;

    // Get SSH configuration
    let ssh_host = std::env::var("SSH_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let ssh_port = std::env::var("SSH_PORT")
        .unwrap_or_else(|_| "22".to_string())
        .parse::<u16>()
        .unwrap_or(22);

    // Establish SSH connection in blocking task
    let (tx_to_ssh, mut rx_to_ssh) = mpsc::channel::<Vec<u8>>(100);
    let (tx_from_ssh, mut rx_from_ssh) = mpsc::channel::<Vec<u8>>(100);
    let (tx_resize, mut rx_resize) = mpsc::channel::<(u32, u32)>(10);

    let username_clone = username.clone();
    let password_clone = password.clone();
    let session_id_clone = session_id.clone();

    // Spawn SSH handling in blocking task
    let ssh_task = tokio::task::spawn_blocking(move || {
        // Connect to SSH server
        let tcp = match TcpStream::connect((ssh_host.as_str(), ssh_port)) {
            Ok(tcp) => tcp,
            Err(e) => {
                tracing::error!("Failed to connect to SSH server: {}", e);
                return Err(format!("Failed to connect to SSH server: {}", e));
            }
        };

        // Create SSH session
        let mut session = match Session::new() {
            Ok(s) => s,
            Err(e) => {
                tracing::error!("Failed to create SSH session: {}", e);
                return Err(format!("Failed to create SSH session: {}", e));
            }
        };

        session.set_tcp_stream(tcp);
        if let Err(e) = session.handshake() {
            tracing::error!("SSH handshake failed: {}", e);
            return Err(format!("SSH handshake failed: {}", e));
        }

        // Authenticate
        if let Err(e) = session.userauth_password(&username_clone, &password_clone) {
            tracing::error!("SSH authentication failed: {}", e);
            return Err(format!("SSH authentication failed: {}", e));
        }

        if !session.authenticated() {
            tracing::error!("SSH authentication failed");
            return Err("SSH authentication failed".to_string());
        }

        // Request PTY and shell with tmux for session persistence
        let mut channel = match session.channel_session() {
            Ok(c) => c,
            Err(e) => {
                tracing::error!("Failed to open channel: {}", e);
                return Err(format!("Failed to open channel: {}", e));
            }
        };

        // Request PTY with initial size (80x24 is common default)
        let initial_width = 80;
        let initial_height = 24;
        let pty_modes = ssh2::PtyModes::new();
        if let Err(e) = channel.request_pty(
            "xterm-256color",
            Some(pty_modes),
            Some((initial_width, initial_height, 0, 0)),
        ) {
            tracing::error!("Failed to request PTY: {}", e);
            return Err(format!("Failed to request PTY: {}", e));
        }

        // Use tmux for persistent sessions
        // Session name is provided by the frontend (session_id)
        // Try to attach to existing session, or create new one if it doesn't exist
        let tmux_command = format!(
            "tmux attach-session -t '{}' || tmux new-session -s '{}'",
            session_id_clone, session_id_clone
        );

        if let Err(e) = channel.exec(&tmux_command) {
            tracing::error!("Failed to execute tmux command: {}", e);
            return Err(format!("Failed to execute tmux command: {}", e));
        }

        // Now set to non-blocking mode for I/O
        session.set_blocking(false);

        tracing::info!("SSH shell started successfully");

        // I/O loop
        use std::io::{Read, Write};
        let mut buffer = [0u8; 4096];
        let mut stderr_buffer = [0u8; 4096];

        loop {
            // Read from SSH stdout and send to WebSocket
            match channel.read(&mut buffer) {
                Ok(n) if n > 0 => {
                    tracing::debug!("SSH stdout read {} bytes", n);
                    if tx_from_ssh.blocking_send(buffer[..n].to_vec()).is_err() {
                        tracing::error!("Failed to send stdout to WebSocket");
                        break;
                    }
                }
                Ok(_) => {}
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    // No data available, continue
                }
                Err(e) => {
                    tracing::error!("SSH read error: {}", e);
                    break;
                }
            }

            // Read from SSH stderr and send to WebSocket
            match channel.stderr().read(&mut stderr_buffer) {
                Ok(n) if n > 0 => {
                    tracing::debug!("SSH stderr read {} bytes", n);
                    if tx_from_ssh
                        .blocking_send(stderr_buffer[..n].to_vec())
                        .is_err()
                    {
                        tracing::error!("Failed to send stderr to WebSocket");
                        break;
                    }
                }
                Ok(_) => {}
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    // No data available, continue
                }
                Err(e) => {
                    tracing::error!("SSH stderr read error: {}", e);
                    break;
                }
            }

            // Read from WebSocket and send to SSH (non-blocking)
            match rx_to_ssh.try_recv() {
                Ok(data) => {
                    if let Err(e) = channel.write_all(&data) {
                        tracing::error!("SSH write error: {}", e);
                        break;
                    }
                    let _ = channel.flush();
                }
                Err(tokio::sync::mpsc::error::TryRecvError::Empty) => {
                    // No data from WebSocket, continue
                }
                Err(tokio::sync::mpsc::error::TryRecvError::Disconnected) => {
                    tracing::info!("WebSocket disconnected");
                    break;
                }
            }

            // Handle terminal resize
            match rx_resize.try_recv() {
                Ok((cols, rows)) => {
                    tracing::info!("Resizing PTY to {}x{}", cols, rows);
                    if let Err(e) = channel.request_pty_size(cols, rows, None, None) {
                        tracing::error!("Failed to resize PTY: {}", e);
                    }
                }
                Err(tokio::sync::mpsc::error::TryRecvError::Empty) => {
                    // No resize command, continue
                }
                Err(tokio::sync::mpsc::error::TryRecvError::Disconnected) => {
                    // Resize channel closed, but we can continue
                }
            }

            std::thread::sleep(std::time::Duration::from_millis(10));

            // Check if channel is EOF
            if channel.eof() {
                tracing::info!("SSH channel EOF");
                break;
            }
        }

        let _ = channel.close();
        let _ = channel.wait_close();

        Ok(())
    });

    // Task to read from SSH and send to WebSocket
    let ssh_to_ws_task = tokio::spawn(async move {
        while let Some(data) = rx_from_ssh.recv().await {
            tracing::debug!("Sending {} bytes to WebSocket", data.len());
            if sender.send(Message::Binary(data)).await.is_err() {
                tracing::error!("Failed to send to WebSocket");
                break;
            }
        }
        tracing::info!("SSH to WebSocket task ended");
    });

    // Read from WebSocket and send to SSH
    while let Some(msg) = receiver.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                tracing::debug!("Received text from WebSocket: {} bytes", text.len());

                // Try to parse as JSON control message
                if let Ok(terminal_msg) = serde_json::from_str::<TerminalMessage>(&text) {
                    match terminal_msg {
                        TerminalMessage::Resize { cols, rows } => {
                            tracing::info!("Received resize command: {}x{}", cols, rows);
                            if tx_resize.send((cols, rows)).await.is_err() {
                                tracing::error!("Failed to send resize command");
                            }
                        }
                    }
                } else {
                    // Not JSON, treat as terminal input
                    if tx_to_ssh.send(text.as_bytes().to_vec()).await.is_err() {
                        break;
                    }
                }
            }
            Ok(Message::Binary(data)) => {
                tracing::debug!("Received binary from WebSocket: {} bytes", data.len());
                if tx_to_ssh.send(data).await.is_err() {
                    break;
                }
            }
            Ok(Message::Close(_)) => {
                tracing::info!("WebSocket close message received");
                break;
            }
            Err(e) => {
                tracing::error!("WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }

    // Clean up
    drop(tx_to_ssh);
    tracing::info!("Waiting for SSH task to complete");

    match ssh_task.await {
        Ok(Ok(())) => tracing::info!("SSH task completed successfully"),
        Ok(Err(e)) => tracing::error!("SSH task failed: {}", e),
        Err(e) => tracing::error!("SSH task join error: {}", e),
    }

    let _ = ssh_to_ws_task.await;
    tracing::info!("WebSocket connection closed for user: {}", username);
}
