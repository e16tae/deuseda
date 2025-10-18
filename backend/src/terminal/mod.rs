use anyhow::{anyhow, Result};
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use serde::{Deserialize, Serialize};
use ssh2::Session;
use std::io::Read;

#[allow(dead_code)]
pub struct Terminal {
    _pty_system: NativePtySystem,
}

impl Terminal {
    #[allow(dead_code)]
    pub fn new() -> Self {
        Self {
            _pty_system: NativePtySystem::default(),
        }
    }

    #[allow(dead_code)]
    pub async fn spawn_shell(&self) -> Result<()> {
        let pty_system = NativePtySystem::default();
        let pair = pty_system.openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })?;

        let cmd = CommandBuilder::new("bash");
        let _child = pair.slave.spawn_command(cmd)?;

        // TODO: Implement I/O handling between PTY and WebSocket
        Ok(())
    }
}

/// Tmux session information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TmuxSession {
    pub name: String,
    pub windows: u32,
    pub created: String,
    pub attached: bool,
}

/// List tmux sessions via SSH
pub fn list_tmux_sessions_via_ssh(session: &mut Session) -> Result<Vec<TmuxSession>> {
    let mut channel = session.channel_session()?;

    // Execute tmux list-sessions command
    // Format: session_name:windows:created:attached
    channel.exec("tmux list-sessions -F '#{session_name}:#{session_windows}:#{session_created}:#{session_attached}' 2>/dev/null || echo 'NO_SESSIONS'")?;

    let mut output = String::new();
    channel.read_to_string(&mut output)?;
    channel.wait_close()?;

    if output.trim() == "NO_SESSIONS" || output.is_empty() {
        return Ok(vec![]);
    }

    parse_tmux_session_list(&output)
}

/// Parse tmux list-sessions output
fn parse_tmux_session_list(output: &str) -> Result<Vec<TmuxSession>> {
    let mut sessions = Vec::new();

    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.split(':').collect();
        if parts.len() >= 4 {
            sessions.push(TmuxSession {
                name: parts[0].to_string(),
                windows: parts[1].parse().unwrap_or(1),
                created: parts[2].to_string(),
                attached: parts[3] == "1",
            });
        }
    }

    Ok(sessions)
}

/// Create a new tmux session via SSH
pub fn create_tmux_session_via_ssh(
    session: &mut Session,
    session_name: &str,
) -> Result<()> {
    let mut channel = session.channel_session()?;

    // Create detached tmux session
    let command = format!("tmux new-session -d -s '{}'", session_name);
    channel.exec(&command)?;

    let mut output = String::new();
    channel.read_to_string(&mut output)?;
    channel.wait_close()?;

    let exit_status = channel.exit_status()?;
    if exit_status != 0 {
        return Err(anyhow!(
            "Failed to create tmux session: {}",
            output
        ));
    }

    Ok(())
}

/// Check if a tmux session exists
pub fn tmux_session_exists_via_ssh(
    session: &mut Session,
    session_name: &str,
) -> Result<bool> {
    let mut channel = session.channel_session()?;

    let command = format!("tmux has-session -t '{}' 2>/dev/null", session_name);
    channel.exec(&command)?;

    let mut _output = String::new();
    channel.read_to_string(&mut _output)?;
    channel.wait_close()?;

    let exit_status = channel.exit_status()?;
    Ok(exit_status == 0)
}

/// Kill a tmux session via SSH
pub fn kill_tmux_session_via_ssh(
    session: &mut Session,
    session_name: &str,
) -> Result<()> {
    let mut channel = session.channel_session()?;

    let command = format!("tmux kill-session -t '{}'", session_name);
    channel.exec(&command)?;

    let mut output = String::new();
    channel.read_to_string(&mut output)?;
    channel.wait_close()?;

    let exit_status = channel.exit_status()?;
    if exit_status != 0 {
        return Err(anyhow!(
            "Failed to kill tmux session: {}",
            output
        ));
    }

    Ok(())
}
