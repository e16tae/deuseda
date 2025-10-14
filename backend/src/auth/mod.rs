use crate::{db::DbPool, models::*};
use anyhow::{anyhow, Result};
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use ssh2::Session;
use std::net::TcpStream;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
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

pub async fn authenticate_user(pool: &DbPool, req: LoginRequest) -> Result<LoginResponse> {
    // SSH를 통한 실제 리눅스 계정 인증
    verify_ssh_credentials(&req.username, &req.password)?;

    // 인증 성공 시 사용자 정보 조회 또는 생성
    let user = match sqlx::query_as::<_, User>("SELECT * FROM users WHERE username = $1")
        .bind(&req.username)
        .fetch_optional(pool)
        .await?
    {
        Some(user) => user,
        None => {
            // 첫 로그인 시 사용자 정보 생성 (password는 저장하지 않음)
            sqlx::query_as::<_, User>(
                "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *",
            )
            .bind(&req.username)
            .bind("") // SSH 인증을 사용하므로 빈 문자열
            .fetch_one(pool)
            .await?
        }
    };

    // Generate JWT token
    let claims = Claims {
        sub: user.id.to_string(),
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
        user: UserInfo {
            id: user.id,
            username: user.username,
        },
    })
}
