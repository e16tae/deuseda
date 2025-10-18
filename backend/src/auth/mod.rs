use crate::models::*;
use anyhow::{anyhow, Result};
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use ssh2::Session;
use std::net::TcpStream;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,  // username
    pub exp: usize,
}

/// SSH 서버 연결 및 인증
fn verify_ssh_credentials(username: &str, password: &str) -> Result<bool> {
    // SSH 서버 주소 (환경변수로 설정 가능, 기본값은 localhost)
    let ssh_host = std::env::var("SSH_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let ssh_port = std::env::var("SSH_PORT")
        .unwrap_or_else(|_| "22".to_string())
        .parse::<u16>()
        .unwrap_or(22);

    // TCP 연결
    let tcp = TcpStream::connect((ssh_host.as_str(), ssh_port))
        .map_err(|e| anyhow!("Failed to connect to SSH server: {}", e))?;

    // SSH 세션 생성
    let mut session = Session::new().map_err(|e| anyhow!("Failed to create SSH session: {}", e))?;
    session.set_tcp_stream(tcp);
    session
        .handshake()
        .map_err(|e| anyhow!("SSH handshake failed: {}", e))?;

    // 사용자 인증 시도
    session
        .userauth_password(username, password)
        .map_err(|e| anyhow!("SSH authentication failed: {}", e))?;

    // 인증 성공 확인
    if session.authenticated() {
        Ok(true)
    } else {
        Err(anyhow!("SSH authentication failed"))
    }
}

/// Authenticate user via SSH and generate JWT token (no database required)
pub async fn authenticate_user(req: LoginRequest) -> Result<LoginResponse> {
    // SSH를 통한 실제 리눅스 계정 인증
    verify_ssh_credentials(&req.username, &req.password)?;

    // Generate JWT token with username as subject
    let claims = Claims {
        sub: req.username.clone(),  // username directly in JWT
        exp: (chrono::Utc::now() + chrono::Duration::hours(24)).timestamp() as usize,
    };

    let secret = std::env::var("JWT_SECRET")
        .expect("JWT_SECRET environment variable must be set for production use");
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )?;

    Ok(LoginResponse {
        token,
        username: req.username,
    })
}
