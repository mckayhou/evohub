use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

pub mod asset;
pub mod bounty;
pub mod node;

pub use asset::{Asset, AssetType, Gene, Capsule};
pub use bounty::{Bounty, BountyStatus, Decision};
pub use node::{Node, NodeCredentials};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn error(message: impl Into<String>) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message.into()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RootResponse {
    pub name: String,
    pub protocol: String,
    pub version: String,
}
