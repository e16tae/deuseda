use axum::{
    extract::Path,
    http::{HeaderMap, StatusCode},
    Extension, Json,
};
use ssh2::Session;
use std::net::TcpStream;

use crate::{
    middleware::auth::Claims,
    models::{CreateTerminalSessionRequest, TerminalSessionResponse},
    terminal::{create_tmux_session_via_ssh, kill_tmux_session_via_ssh, list_tmux_sessions_via_ssh},
};

// GET /api/terminal-sessions - Get all terminal sessions for the current user
// Requires X-SSH-Password header to connect to SSH and list tmux sessions
pub async fn get_sessions(
    Extension(claims): Extension<Claims>,
    headers: HeaderMap,
) -> Result<Json<Vec<TerminalSessionResponse>>, StatusCode> {
    // Get username directly from JWT
    let username = claims.username();

    // Get password from header
    let password = headers
        .get("X-SSH-Password")
        .and_then(|v| v.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // Connect to SSH and list tmux sessions
    let ssh_host = std::env::var("SSH_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let ssh_port = std::env::var("SSH_PORT")
        .unwrap_or_else(|_| "22".to_string())
        .parse::<u16>()
        .unwrap_or(22);

    let tcp = TcpStream::connect((ssh_host.as_str(), ssh_port))
        .map_err(|e| {
            tracing::error!("Failed to connect to SSH: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let mut session = Session::new().map_err(|e| {
        tracing::error!("Failed to create SSH session: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    session.set_tcp_stream(tcp);
    session.handshake().map_err(|e| {
        tracing::error!("SSH handshake failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    session
        .userauth_password(username, password)
        .map_err(|e| {
            tracing::error!("SSH authentication failed: {}", e);
            StatusCode::UNAUTHORIZED
        })?;

    // List tmux sessions
    let tmux_sessions = list_tmux_sessions_via_ssh(&mut session)
        .map_err(|e| {
            tracing::error!("Failed to list tmux sessions: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Convert to response format
    let response: Vec<TerminalSessionResponse> = tmux_sessions
        .into_iter()
        .map(|s| TerminalSessionResponse {
            id: s.name.clone(),
            title: s.name,
        })
        .collect();

    Ok(Json(response))
}

// POST /api/terminal-sessions - Create a new terminal session
// Requires X-SSH-Password header to connect to SSH and create tmux session
pub async fn create_session(
    Extension(claims): Extension<Claims>,
    headers: HeaderMap,
    Json(req): Json<CreateTerminalSessionRequest>,
) -> Result<Json<TerminalSessionResponse>, StatusCode> {
    // Get username directly from JWT
    let username = claims.username();

    // Get password from header
    let password = headers
        .get("X-SSH-Password")
        .and_then(|v| v.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // Connect to SSH
    let ssh_host = std::env::var("SSH_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let ssh_port = std::env::var("SSH_PORT")
        .unwrap_or_else(|_| "22".to_string())
        .parse::<u16>()
        .unwrap_or(22);

    let tcp = TcpStream::connect((ssh_host.as_str(), ssh_port))
        .map_err(|e| {
            tracing::error!("Failed to connect to SSH: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let mut session = Session::new().map_err(|e| {
        tracing::error!("Failed to create SSH session: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    session.set_tcp_stream(tcp);
    session.handshake().map_err(|e| {
        tracing::error!("SSH handshake failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    session
        .userauth_password(username, password)
        .map_err(|e| {
            tracing::error!("SSH authentication failed: {}", e);
            StatusCode::UNAUTHORIZED
        })?;

    // Check if session already exists, if not create it
    let session_exists = crate::terminal::tmux_session_exists_via_ssh(&mut session, &req.session_id)
        .map_err(|e| {
            tracing::error!("Failed to check tmux session: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if !session_exists {
        // Create new tmux session
        create_tmux_session_via_ssh(&mut session, &req.session_id)
            .map_err(|e| {
                tracing::error!("Failed to create tmux session: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

        tracing::info!("Created new tmux session: {}", req.session_id);
    } else {
        tracing::info!("Tmux session already exists: {}", req.session_id);
    }

    Ok(Json(TerminalSessionResponse {
        id: req.session_id.clone(),
        title: req.title,
    }))
}

// DELETE /api/terminal-sessions/:session_id - Delete a terminal session
// Requires X-SSH-Password header to connect to SSH and kill tmux session
pub async fn delete_session(
    Extension(claims): Extension<Claims>,
    headers: HeaderMap,
    Path(session_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    // Get username directly from JWT
    let username = claims.username();

    // Get password from header
    let password = headers
        .get("X-SSH-Password")
        .and_then(|v| v.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // Connect to SSH
    let ssh_host = std::env::var("SSH_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let ssh_port = std::env::var("SSH_PORT")
        .unwrap_or_else(|_| "22".to_string())
        .parse::<u16>()
        .unwrap_or(22);

    let tcp = TcpStream::connect((ssh_host.as_str(), ssh_port))
        .map_err(|e| {
            tracing::error!("Failed to connect to SSH: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let mut session = Session::new().map_err(|e| {
        tracing::error!("Failed to create SSH session: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    session.set_tcp_stream(tcp);
    session.handshake().map_err(|e| {
        tracing::error!("SSH handshake failed: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    session
        .userauth_password(username, password)
        .map_err(|e| {
            tracing::error!("SSH authentication failed: {}", e);
            StatusCode::UNAUTHORIZED
        })?;

    // Check if session exists
    let session_exists = crate::terminal::tmux_session_exists_via_ssh(&mut session, &session_id)
        .map_err(|e| {
            tracing::error!("Failed to check tmux session: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if !session_exists {
        tracing::warn!("Tmux session not found: {}", session_id);
        return Err(StatusCode::NOT_FOUND);
    }

    // Kill tmux session
    kill_tmux_session_via_ssh(&mut session, &session_id)
        .map_err(|e| {
            tracing::error!("Failed to kill tmux session: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    tracing::info!("Deleted tmux session: {}", session_id);

    Ok(StatusCode::NO_CONTENT)
}
