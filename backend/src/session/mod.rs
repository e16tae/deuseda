use crate::{db::DbPool, models::Session};
use anyhow::Result;
use uuid::Uuid;

#[allow(dead_code)]
pub async fn create_session(
    pool: &DbPool,
    user_id: Uuid,
    title: Option<String>,
) -> Result<Session> {
    let tmux_session_name = format!("deuseda-{}", Uuid::new_v4());
    let session_title = title.unwrap_or_else(|| "Terminal".to_string());

    let session = sqlx::query_as::<_, Session>(
        r#"
        INSERT INTO sessions (user_id, tmux_session_name, session_title)
        VALUES ($1, $2, $3)
        RETURNING *
        "#,
    )
    .bind(user_id)
    .bind(&tmux_session_name)
    .bind(&session_title)
    .fetch_one(pool)
    .await?;

    // Create tmux session
    create_tmux_session(&tmux_session_name).await?;

    Ok(session)
}

#[allow(dead_code)]
pub async fn get_user_sessions(pool: &DbPool, user_id: Uuid) -> Result<Vec<Session>> {
    let sessions = sqlx::query_as::<_, Session>(
        "SELECT * FROM sessions WHERE user_id = $1 AND is_active = true ORDER BY last_accessed_at DESC"
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(sessions)
}

#[allow(dead_code)]
pub async fn update_session_access(pool: &DbPool, session_id: Uuid) -> Result<()> {
    sqlx::query(
        "UPDATE sessions SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = $1"
    )
    .bind(session_id)
    .execute(pool)
    .await?;

    Ok(())
}

async fn create_tmux_session(session_name: &str) -> Result<()> {
    let output = tokio::process::Command::new("tmux")
        .args(&["new-session", "-d", "-s", session_name])
        .output()
        .await?;

    if !output.status.success() {
        anyhow::bail!("Failed to create tmux session: {}", String::from_utf8_lossy(&output.stderr));
    }

    Ok(())
}

#[allow(dead_code)]
pub async fn attach_to_tmux_session(session_name: &str) -> Result<String> {
    // Return the tmux command to attach
    Ok(format!("tmux attach-session -t {}", session_name))
}
