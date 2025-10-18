use serde::{Deserialize, Serialize};

// No database models needed - all data comes from SSH/tmux

#[derive(Debug, Deserialize)]
pub struct CreateTerminalSessionRequest {
    pub session_id: String,
    pub title: String,
}

#[derive(Debug, Serialize)]
pub struct TerminalSessionResponse {
    pub id: String,
    pub title: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub username: String,
}
