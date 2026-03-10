use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    Extension,
};
use std::sync::Arc;

use crate::models::{
    ApiResponse, HealthResponse, RootResponse,
    node::{HelloRequest, HelloResponse, HeartbeatRequest, HeartbeatResponse},
    asset::{PublishRequest, FetchRequest, ValidateRequest, ReportRequest, RevokeRequest},
    bounty::{CreateBountyRequest, JoinBountyRequest, SubmitDecisionRequest, CancelBountyRequest},
};
use crate::services::{NodeService, AssetService, SwarmService};

pub mod handlers;


/// Shared application state
#[derive(Clone)]
pub struct AppState {
    pub node_service: Arc<NodeService>,
    pub asset_service: Arc<AssetService>,
    pub swarm_service: Arc<SwarmService>,
}

/// Root endpoint
pub async fn root() -> Json<RootResponse> {
    Json(RootResponse {
        name: "EvoHub".to_string(),
        protocol: "GEP-A2A-v1.0.0".to_string(),
        version: "2.5.0".to_string(),
    })
}

/// Health check endpoint
pub async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
        version: "2.5.0".to_string(),
        timestamp: chrono::Utc::now(),
    })
}

/// Hello endpoint - register new node
pub async fn hello(
    State(state): State<AppState>,
    Json(req): Json<HelloRequest>,
) -> Result<Json<HelloResponse>, StatusCode> {
    match state.node_service.register(req) {
        Ok(response) => Ok(Json(response)),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}

/// Heartbeat endpoint
pub async fn heartbeat(
    State(state): State<AppState>,
    Extension(node_id): Extension<String>,
    Json(req): Json<HeartbeatRequest>,
) -> Result<Json<HeartbeatResponse>, StatusCode> {
    match state.node_service.heartbeat(node_id, req) {
        Ok(response) => Ok(Json(response)),
        Err(_) => Err(StatusCode::NOT_FOUND),
    }
}

/// Publish endpoint
pub async fn publish(
    State(state): State<AppState>,
    Extension(node_id): Extension<String>,
    Json(req): Json<PublishRequest>,
) -> Json<ApiResponse<crate::models::asset::PublishResponse>> {
    let response = state.asset_service.publish(node_id, req).await;
    Json(ApiResponse::success(response))
}

/// Fetch endpoint
pub async fn fetch(
    State(state): State<AppState>,
    Extension(_node_id): Extension<String>,
    Json(req): Json<FetchRequest>,
) -> Json<ApiResponse<crate::models::asset::FetchResponse>> {
    let response = state.asset_service.fetch(req);
    Json(ApiResponse::success(response))
}

/// Validate endpoint
pub async fn validate(
    State(state): State<AppState>,
    Extension(_node_id): Extension<String>,
    Json(req): Json<ValidateRequest>,
) -> Json<ApiResponse<crate::models::asset::ValidateResponse>> {
    let response = state.asset_service.validate(req);
    Json(ApiResponse::success(response))
}

/// Report endpoint
pub async fn report(
    State(state): State<AppState>,
    Extension(_node_id): Extension<String>,
    Json(req): Json<ReportRequest>,
) -> Result<Json<ApiResponse<crate::models::asset::ReportResponse>>, StatusCode> {
    match state.asset_service.report(req) {
        Ok(response) => Ok(Json(ApiResponse::success(response))),
        Err(_) => Err(StatusCode::NOT_FOUND),
    }
}

/// Revoke endpoint
pub async fn revoke(
    State(state): State<AppState>,
    Extension(node_id): Extension<String>,
    Json(req): Json<RevokeRequest>,
) -> Result<Json<ApiResponse<crate::models::asset::RevokeResponse>>, StatusCode> {
    match state.asset_service.revoke(node_id, req) {
        Ok(response) => Ok(Json(ApiResponse::success(response))),
        Err(_) => Err(StatusCode::NOT_FOUND),
    }
}

/// Directory endpoint
pub async fn directory(
    State(state): State<AppState>,
) -> Json<ApiResponse<Vec<crate::models::node::Node>>> {
    let nodes = state.node_service.list_active_nodes();
    Json(ApiResponse::success(nodes))
}

/// Create bounty endpoint
pub async fn create_bounty(
    State(state): State<AppState>,
    Extension(node_id): Extension<String>,
    Json(req): Json<CreateBountyRequest>,
) -> Result<Json<ApiResponse<crate::models::bounty::CreateBountyResponse>>, StatusCode> {
    match state.swarm_service.create_bounty(node_id, req) {
        Ok(response) => Ok(Json(ApiResponse::success(response))),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}

/// Join bounty endpoint
pub async fn join_bounty(
    State(state): State<AppState>,
    Extension(node_id): Extension<String>,
    Json(req): Json<JoinBountyRequest>,
) -> Result<Json<ApiResponse<crate::models::bounty::JoinBountyResponse>>, StatusCode> {
    match state.swarm_service.join_bounty(node_id, req) {
        Ok(response) => Ok(Json(ApiResponse::success(response))),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}

/// Submit decision endpoint
pub async fn submit_decision(
    State(state): State<AppState>,
    Extension(node_id): Extension<String>,
    Json(req): Json<SubmitDecisionRequest>,
) -> Result<Json<ApiResponse<crate::models::bounty::SubmitDecisionResponse>>, StatusCode> {
    match state.swarm_service.submit_decision(node_id, req) {
        Ok(response) => Ok(Json(ApiResponse::success(response))),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}

/// List bounties endpoint
pub async fn list_bounties(
    State(state): State<AppState>,
) -> Json<ApiResponse<crate::models::bounty::ListBountiesResponse>> {
    let response = state.swarm_service.list_bounties(None, None, None, 50);
    Json(ApiResponse::success(response))
}

/// Get bounty endpoint
pub async fn get_bounty(
    State(state): State<AppState>,
    axum::extract::Path(bounty_id): axum::extract::Path<String>,
) -> Result<Json<ApiResponse<crate::models::bounty::GetBountyResponse>>, StatusCode> {
    match state.swarm_service.get_bounty(&bounty_id) {
        Ok(response) => Ok(Json(ApiResponse::success(response))),
        Err(_) => Err(StatusCode::NOT_FOUND),
    }
}

/// Cancel bounty endpoint
pub async fn cancel_bounty(
    State(state): State<AppState>,
    Extension(node_id): Extension<String>,
    Json(req): Json<CancelBountyRequest>,
) -> Result<Json<ApiResponse<crate::models::bounty::CancelBountyResponse>>, StatusCode> {
    match state.swarm_service.cancel_bounty(node_id, req) {
        Ok(response) => Ok(Json(ApiResponse::success(response))),
        Err(_) => Err(StatusCode::BAD_REQUEST),
    }
}
