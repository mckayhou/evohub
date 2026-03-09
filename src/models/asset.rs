use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "PascalCase")]
pub enum AssetType {
    Gene,
    Capsule,
    EvolutionEvent,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct Asset {
    #[validate(length(min = 1, max = 128))]
    pub asset_id: String,
    pub r#type: AssetType,
    #[validate(regex(path = "crate::utils::SEMVER_REGEX"))]
    pub version: String,
    #[validate(length(min = 1))]
    pub signals_match: Vec<String>,
    #[validate(length(min = 10, max = 2000))]
    pub summary: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preconditions: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub constraints: Option<HashMap<String, serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code_diff: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub validate_commands: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_gene: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub outcome: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confidence: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub blast_radius: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env_fingerprint: Option<HashMap<String, serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub success_rate: Option<f64>,
    
    // System fields
    pub node_id: String,
    pub gdi_score: f64,
    pub status: AssetStatus,
    pub published_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub revoked_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub revoke_reason: Option<String>,
    
    // GDI breakdown
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quality_score: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rules_score: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage_score: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub social_score: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub freshness_score: Option<f64>,
    
    // Usage tracking
    pub fetch_count: i32,
    pub total_reports: i32,
    pub success_reports: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AssetStatus {
    Promoted,
    Candidate,
    Quarantined,
    Revoked,
}

impl Asset {
    pub fn new(asset_id: String, node_id: String, data: AssetData) -> Self {
        let now = Utc::now();
        Self {
            asset_id,
            r#type: data.r#type,
            version: data.version,
            signals_match: data.signals_match,
            summary: data.summary,
            category: data.category,
            preconditions: data.preconditions,
            constraints: data.constraints,
            code_diff: data.code_diff,
            validate_commands: data.validate_commands,
            parent_gene: data.parent_gene,
            outcome: data.outcome,
            confidence: data.confidence,
            blast_radius: data.blast_radius,
            env_fingerprint: data.env_fingerprint,
            success_rate: data.success_rate,
            node_id,
            gdi_score: 0.0,
            status: AssetStatus::Candidate,
            published_at: now,
            revoked_at: None,
            revoke_reason: None,
            quality_score: None,
            rules_score: None,
            usage_score: None,
            social_score: None,
            freshness_score: None,
            fetch_count: 0,
            total_reports: 0,
            success_reports: 0,
        }
    }

    pub fn update_gdi(&mut self, gdi_score: f64) {
        self.gdi_score = gdi_score;
        self.status = if gdi_score >= 0.70 {
            AssetStatus::Promoted
        } else if gdi_score >= 0.50 {
            AssetStatus::Candidate
        } else {
            AssetStatus::Quarantined
        };
    }

    pub fn revoke(&mut self, reason: String) {
        self.status = AssetStatus::Revoked;
        self.revoked_at = Some(Utc::now());
        self.revoke_reason = Some(reason);
    }

    pub fn report_usage(&mut self, success: bool) {
        self.total_reports += 1;
        if success {
            self.success_reports += 1;
        }
    }

    pub fn success_rate(&self) -> f64 {
        if self.total_reports == 0 {
            return 0.0;
        }
        self.success_reports as f64 / self.total_reports as f64
    }
}

#[derive(Debug, Clone)]
pub struct AssetData {
    pub r#type: AssetType,
    pub version: String,
    pub signals_match: Vec<String>,
    pub summary: String,
    pub category: Option<String>,
    pub preconditions: Option<Vec<String>>,
    pub constraints: Option<HashMap<String, serde_json::Value>>,
    pub code_diff: Option<String>,
    pub validate_commands: Option<Vec<String>>,
    pub parent_gene: Option<String>,
    pub outcome: Option<String>,
    pub confidence: Option<f64>,
    pub blast_radius: Option<Vec<String>>,
    pub env_fingerprint: Option<HashMap<String, serde_json::Value>>,
    pub success_rate: Option<f64>,
}

// Request/Response types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishRequest {
    pub payload: PublishPayload,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishPayload {
    pub assets: Vec<AssetInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct AssetInput {
    #[validate(length(min = 1, max = 128))]
    pub asset_id: String,
    pub r#type: AssetType,
    pub version: String,
    #[validate(length(min = 1))]
    pub signals_match: Vec<String>,
    #[validate(length(min = 10, max = 2000))]
    pub summary: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preconditions: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub constraints: Option<HashMap<String, serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code_diff: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub validate_commands: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishResponse {
    pub success: bool,
    pub published: usize,
    pub failed: usize,
    pub assets: Vec<PublishedAsset>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub errors: Option<Vec<AssetError>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishedAsset {
    pub asset_id: String,
    pub gdi: f64,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetError {
    pub asset_id: String,
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FetchRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signals: Option<Vec<String>>,
    #[serde(default = "default_min_gdi")]
    pub min_gdi: f64,
    #[serde(default = "default_limit")]
    pub limit: i32,
}

fn default_min_gdi() -> f64 { 0.7 }
fn default_limit() -> i32 { 20 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FetchResponse {
    pub success: bool,
    pub count: usize,
    pub capsules: Vec<CapsuleSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapsuleSummary {
    pub asset_id: String,
    pub r#type: AssetType,
    pub gdi_score: f64,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidateRequest {
    pub payload: PublishPayload,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidateResponse {
    pub valid: bool,
    pub message: String,
    pub validations: Vec<AssetValidation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetValidation {
    pub asset_id: String,
    pub valid: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub errors: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportRequest {
    pub asset_id: String,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportResponse {
    pub success: bool,
    pub asset_id: String,
    pub success_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevokeRequest {
    pub asset_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevokeResponse {
    pub success: bool,
    pub asset_id: String,
    pub status: String,
}

// Type aliases for convenience
pub type Gene = Asset;
pub type Capsule = Asset;
