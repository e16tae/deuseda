pub mod auth;
pub mod session;
pub mod terminal;
pub mod terminal_session;

use axum::Json;
use serde_json::{json, Value};

pub async fn health_check() -> Json<Value> {
    Json(json!({ "status": "ok" }))
}
