use anyhow::Result;
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};

pub struct Terminal {
    _pty_system: NativePtySystem,
}

impl Terminal {
    pub fn new() -> Self {
        Self {
            _pty_system: NativePtySystem::default(),
        }
    }

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
