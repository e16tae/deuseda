use axum::{extract::State, http::StatusCode, Json};
use crate::{db::DbPool, models::Session};

pub async fn list_sessions(
    State(_pool): State<DbPool>,
) -> Result<Json<Vec<Session>>, (StatusCode, String)> {
    // TODO: Extract user from JWT token
    // TODO: Query sessions from database
    Ok(Json(vec![]))
}
