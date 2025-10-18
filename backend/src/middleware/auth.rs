use axum::{
    extract::Request,
    http::{header, StatusCode},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::{Deserialize, Serialize};

/// JWT Claims with username as subject
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String, // username (not user_id anymore)
    pub exp: usize,
}

impl Claims {
    pub fn username(&self) -> &str {
        &self.sub
    }
}

pub async fn auth_middleware(mut req: Request, next: Next) -> Result<Response, StatusCode> {
    let auth_header = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|header| header.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let token = auth_header.strip_prefix("Bearer ").unwrap_or(auth_header);

    let secret = std::env::var("JWT_SECRET")
        .expect("JWT_SECRET environment variable must be set for production use");

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|_| StatusCode::UNAUTHORIZED)?;

    // Insert Claims with username
    req.extensions_mut().insert(token_data.claims);

    Ok(next.run(req).await)
}
