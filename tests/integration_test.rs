use serde::{Deserialize, Serialize};
use serde_json::json;

// Test request/response types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HelloRequest {
    pub protocol: String,
    pub protocol_version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload: Option<HelloPayload>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HelloPayload {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capabilities: Option<std::collections::HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AssetType {
    Gene,
    Capsule,
    EvolutionEvent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetInput {
    pub asset_id: String,
    pub r#type: AssetType,
    pub version: String,
    pub signals_match: Vec<String>,
    pub summary: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preconditions: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub constraints: Option<std::collections::HashMap<String, serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code_diff: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub validate_commands: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishPayload {
    pub assets: Vec<AssetInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishRequest {
    pub payload: PublishPayload,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FetchRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signals: Option<Vec<String>>,
    pub min_gdi: f64,
    pub limit: i32,
}

#[test]
fn test_hello_request_serialization() {
    let req = HelloRequest {
        protocol: "gep-a2a".to_string(),
        protocol_version: "1.0.0".to_string(),
        payload: None,
    };

    let json = serde_json::to_string(&req).unwrap();
    assert!(json.contains("gep-a2a"));
    assert!(json.contains("1.0.0"));
}

#[test]
fn test_publish_request_serialization() {
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

#[test]
fn test_fetch_request_serialization() {
    let req = FetchRequest {
        signals: Some(vec!["test".to_string()]),
        min_gdi: 0.7,
        limit: 10,
    };

    let json = serde_json::to_string(&req).unwrap();
    assert!(json.contains("test"));
    assert!(json.contains("0.7"));
}

#[test]
fn test_asset_type_serialization() {
    let gene = AssetType::Gene;
    let capsule = AssetType::Capsule;
    let event = AssetType::EvolutionEvent;

    assert_eq!(serde_json::to_string(&gene).unwrap(), "\"Gene\"");
    assert_eq!(serde_json::to_string(&capsule).unwrap(), "\"Capsule\"");
    assert_eq!(serde_json::to_string(&event).unwrap(), "\"EvolutionEvent\"");
}

#[test]
fn test_json_parsing() {
    let json = r#"{"protocol":"gep-a2a","protocol_version":"1.0.0"}"#;
    let req: HelloRequest = serde_json::from_str(json).unwrap();
    assert_eq!(req.protocol, "gep-a2a");
    assert_eq!(req.protocol_version, "1.0.0");
}
