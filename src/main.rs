use axum::{
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tracing::{info, Level};
use tracing_subscriber;

mod config;
mod middleware;
mod models;
mod routes;
mod services;
mod utils;

use config::Config;
use routes::AppState;
use services::{GDIService, NodeService, AssetService, SwarmService};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .init();

    info!("Starting EvoHub v2.5.0 (Rust)");

    // Load configuration
    let config = Config::from_env()?;
    info!("Configuration loaded");

    // Initialize services
    let gdi_service = GDIService::new(
        config.llm_api_key.clone(),
        config.llm_base_url.clone(),
        config.llm_model.clone(),
    );

    let node_service = Arc::new(NodeService::new(config.jwt_secret.clone()));
    let asset_service = Arc::new(AssetService::new(gdi_service));
    let swarm_service = Arc::new(SwarmService::new());

    // Create app state
    let state = AppState {
        node_service: node_service.clone(),
        asset_service: asset_service.clone(),
        swarm_service: swarm_service.clone(),
    };

    // Build router
    let app = Router::new()
        // Public endpoints
        .route("/", get(routes::root))
        .route("/health", get(routes::health))
        .route("/a2a/hello", post(routes::hello))
        .route("/a2a/directory", get(routes::directory))
        
        // Protected endpoints
        .route("/a2a/heartbeat", post(routes::heartbeat))
        .route("/a2a/publish", post(routes::publish))
        .route("/a2a/fetch", post(routes::fetch))
        .route("/a2a/validate", post(routes::validate))
        .route("/a2a/report", post(routes::report))
        .route("/a2a/revoke", post(routes::revoke))
        
        // Swarm bounty endpoints
        .route("/a2a/bounty/create", post(routes::create_bounty))
        .route("/a2a/bounty/join", post(routes::join_bounty))
        .route("/a2a/bounty/list", get(routes::list_bounties))
        .route("/a2a/bounty/:id", get(routes::get_bounty))
        .route("/a2a/bounty/cancel", post(routes::cancel_bounty))
        .route("/a2a/decision", post(routes::submit_decision))
        
        // Middleware
        .layer(middleware::cors_layer())
        .layer(middleware::auth_layer())
        .layer(axum::middleware::from_fn(middleware::logging_middleware))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            middleware::error_handling_middleware,
        ))
        .with_state(state);

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    info!("Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
