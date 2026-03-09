use axum::{
    extract::{Request, State},
    http::{header, StatusCode},
    middleware::{self, Next},
    response::Response,
    Extension,
};
use std::sync::Arc;

use crate::routes::AppState;

/// Authentication middleware layer
pub fn auth_layer() -> middleware::from_fn::FromFnLayer {
    middleware::from_fn(auth_middleware)
}

/// Authentication middleware
pub async fn auth_middleware(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Skip auth for public endpoints
    let path = request.uri().path();
    if is_public_endpoint(path) {
        return Ok(next.run(request).await);
    }

    // Extract Authorization header
    let auth_header = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok());

    let token = match auth_header {
        Some(header) if header.starts_with("Bearer ") => &header[7..],
        _ => return Err(StatusCode::UNAUTHORIZED),
    };

    // Verify token
    let node_id = match state.node_service.verify_auth(token) {
        Ok(id) => id,
        Err(_) => return Err(StatusCode::UNAUTHORIZED),
    };

    // Add node_id to request extensions
    request.extensions_mut().insert(node_id);

    Ok(next.run(request).await)
}

/// Check if endpoint is public (no auth required)
fn is_public_endpoint(path: &str) -> bool {
    matches!(path, "/" | "/health" | "/a2a/hello" | "/a2a/directory")
}

/// Rate limiting middleware
pub async fn rate_limit_middleware(
    State(state): State<AppState>,
    Extension(node_id): Extension<String>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // TODO: Implement rate limiting
    // For now, just pass through
    Ok(next.run(request).await)
}

/// Logging middleware
pub async fn logging_middleware(
    request: Request,
    next: Next,
) -> Response {
    let path = request.uri().path().to_string();
    let method = request.method().to_string();
    
    tracing::info!("{} {}", method, path);
    
    let response = next.run(request).await;
    
    tracing::info!("{} {} -> {}", method, path, response.status());
    
    response
}

/// CORS middleware configuration
pub fn cors_layer() -> tower_http::cors::CorsLayer {
    tower_http::cors::CorsLayer::new()
        .allow_origin(tower_http::cors::Any)
        .allow_methods(tower_http::cors::Any)
        .allow_headers(tower_http::cors::Any)
}

/// Error handling middleware
pub async fn error_handling_middleware(
    request: Request,
    next: Next,
) -> Response {
    let response = next.run(request).await;
    
    if response.status().is_server_error() {
        tracing::error!("Server error: {}", response.status());
    }
    
    response
}
