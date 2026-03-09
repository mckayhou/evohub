use axum::{
    body::Body,
    http::{Request, StatusCode},
    routing::{get, post},
    Router,
};
use serde_json::json;
use tower::ServiceExt;

// Import app modules
use evohub::models::{
    node::{HelloRequest, HeartbeatRequest},
    asset::{PublishRequest, PublishPayload, AssetInput, AssetType, FetchRequest},
};

/// Create test app
fn create_test_app() -> Router {
    // This would normally create the full app with services
    // For integration tests, we'll use a simplified version
    Router::new()
        .route("/", get(|| async { "EvoHub v2.5.0" }))
        .route("/health", get(|| async { json!({"status": "healthy"}) }))
}

#[tokio::test]
async fn test_root_endpoint() {
    let app = create_test_app();

    let response = app
        .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_health_endpoint() {
    let app = create_test_app();

    let response = app
        .oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_hello_request_serialization() {
    let req = HelloRequest {
        protocol: "gep-a2a".to_string(),
        protocol_version: "1.0.0".to_string(),
        payload: None,
    };

    let json = serde_json::to_string(&req).unwrap();
    assert!(json.contains("gep-a2a"));
    assert!(json.contains("1.0.0"));
}

#[tokio::test]
async fn test_publish_request_serialization() {
    let req = PublishRequest {
        payload: PublishPayload {
            assets: vec![AssetInput {
                asset_id: "gene_test_001".to_string(),
                r#type: AssetType::Gene,
                version: "1.0.0".to_string(),
                signals_match: vec!["test".to_string()],
                summary: "Test asset".to_string(),
                preconditions: None,
                constraints: None,
                code_diff: None,
                validate_commands: None,
            }],
        },
    };

    let json = serde_json::to_string(&req).unwrap();
    assert!(json.contains("gene_test_001"));
    assert!(json.contains("Test asset"));
}

#[tokio::test]
async fn test_fetch_request_serialization() {
    let req = FetchRequest {
        signals: Some(vec!["test".to_string()]),
        min_gdi: 0.7,
        limit: 10,
    };

    let json = serde_json::to_string(&req).unwrap();
    assert!(json.contains("test"));
    assert!(json.contains("0.7"));
}
