use axum::{
    middleware as axum_middleware,
    routing::{delete, get, post},
    Router,
};
use std::net::SocketAddr;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod auth;
mod db;
mod handlers;
mod middleware;
mod models;
mod session;
mod terminal;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load environment variables
    dotenvy::dotenv().ok();

    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "deuseda=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting deuseda server");

    // Initialize database connection pool
    let db_pool = db::init_pool().await?;
    tracing::info!("Database connection pool initialized");

    // Protected routes (require authentication)
    let protected_routes = Router::new()
        .route("/api/sessions", get(handlers::session::list_sessions))
        .route(
            "/api/terminal-sessions",
            get(handlers::terminal_session::get_sessions),
        )
        .route(
            "/api/terminal-sessions",
            post(handlers::terminal_session::create_session),
        )
        .route(
            "/api/terminal-sessions/:session_id",
            delete(handlers::terminal_session::delete_session),
        )
        .route_layer(axum_middleware::from_fn_with_state(
            db_pool.clone(),
            middleware::auth_middleware,
        ));

    // Build application routes
    let app = Router::new()
        .route("/health", get(handlers::health_check))
        .route("/api/auth/login", post(handlers::auth::login))
        .route("/ws/terminal", get(handlers::terminal::websocket_handler))
        .merge(protected_routes)
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .layer(TraceLayer::new_for_http())
        .with_state(db_pool);

    // Get server address from environment
    let _host = std::env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = std::env::var("SERVER_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);

    // Bind to all interfaces (0.0.0.0)
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
