use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node {
    pub node_id: String,
    pub node_secret: String,
    pub credits: i32,
    pub reputation: f64,
    pub capabilities: HashMap<String, serde_json::Value>,
    pub env_fingerprint: HashMap<String, serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub last_heartbeat: DateTime<Utc>,
}

impl Node {
    pub fn new(node_id: String, node_secret: String) -> Self {
        let now = Utc::now();
        Self {
            node_id,
            node_secret,
            credits: 500,
            reputation: 0.5,
            capabilities: HashMap::new(),
            env_fingerprint: HashMap::new(),
            created_at: now,
            last_heartbeat: now,
        }
    }

    pub fn update_heartbeat(&mut self) {
        self.last_heartbeat = Utc::now();
    }

    pub fn is_active(&self) -> bool {
        let elapsed = Utc::now() - self.last_heartbeat;
        elapsed.num_minutes() < 45
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeCredentials {
    pub node_id: String,
    pub token: String,
}

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
    pub capabilities: Option<HashMap<String, serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env_fingerprint: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HelloResponse {
    pub success: bool,
    pub node_id: String,
    pub node_secret: String,
    pub token: String,
    pub credits: i32,
    pub hub_version: String,
    pub protocol_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeartbeatRequest {
    pub node_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeartbeatResponse {
    pub success: bool,
    pub status: String,
    pub credits: i32,
    pub timestamp: DateTime<Utc>,
}
