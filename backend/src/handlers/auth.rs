use axum::{extract::State, http::StatusCode, Json};
use crate::{auth as auth_service, db::DbPool, models::*};

pub async fn login(
    State(pool): State<DbPool>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, (StatusCode, String)> {
    auth_service::authenticate_user(&pool, payload)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::UNAUTHORIZED, e.to_string()))
}
