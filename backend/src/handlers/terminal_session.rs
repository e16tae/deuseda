use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use uuid::Uuid;

use crate::{
    db::DbPool,
    middleware::auth::Claims,
    models::{CreateTerminalSessionRequest, TerminalSession, TerminalSessionResponse},
};

// GET /api/terminal-sessions - Get all terminal sessions for the current user
pub async fn get_sessions(
    Extension(claims): Extension<Claims>,
    State(pool): State<DbPool>,
) -> Result<Json<Vec<TerminalSessionResponse>>, StatusCode> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    let sessions = sqlx::query_as::<_, TerminalSession>(
        "SELECT * FROM terminal_sessions WHERE user_id = $1 ORDER BY created_at ASC",
    )
    .bind(user_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch terminal sessions: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let response: Vec<TerminalSessionResponse> = sessions
        .into_iter()
        .map(|s| TerminalSessionResponse {
            id: s.session_id,
            title: s.title,
        })
        .collect();

    Ok(Json(response))
}

// POST /api/terminal-sessions - Create a new terminal session
pub async fn create_session(
    Extension(claims): Extension<Claims>,
    State(pool): State<DbPool>,
    Json(req): Json<CreateTerminalSessionRequest>,
) -> Result<Json<TerminalSessionResponse>, StatusCode> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    // Check if session already exists
    let existing = sqlx::query_as::<_, TerminalSession>(
        "SELECT * FROM terminal_sessions WHERE user_id = $1 AND session_id = $2",
    )
    .bind(user_id)
    .bind(&req.session_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to check existing session: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if let Some(session) = existing {
        // Return existing session
        return Ok(Json(TerminalSessionResponse {
            id: session.session_id,
            title: session.title,
        }));
    }

    // Create new session
    let session = sqlx::query_as::<_, TerminalSession>(
        "INSERT INTO terminal_sessions (user_id, session_id, title)
         VALUES ($1, $2, $3)
         RETURNING *",
    )
    .bind(user_id)
    .bind(&req.session_id)
    .bind(&req.title)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create terminal session: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(TerminalSessionResponse {
        id: session.session_id,
        title: session.title,
    }))
}

// DELETE /api/terminal-sessions/:session_id - Delete a terminal session
pub async fn delete_session(
    Extension(claims): Extension<Claims>,
    State(pool): State<DbPool>,
    Path(session_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

    let result =
        sqlx::query("DELETE FROM terminal_sessions WHERE user_id = $1 AND session_id = $2")
            .bind(user_id)
            .bind(session_id)
            .execute(&pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to delete terminal session: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}
