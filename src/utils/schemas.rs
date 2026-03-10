use serde::{Deserialize, Serialize};

/// Validation schema for asset input
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetInputSchema {
    pub asset_id: String,
    pub version: String,
    pub signals_match: Vec<String>,
    pub summary: String,
}

/// Validation schema for publish request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishRequestSchema {
    pub payload: PayloadSchema,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PayloadSchema {
    pub assets: Vec<AssetInputSchema>,
}

/// Validation schema for fetch request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FetchRequestSchema {
    #[serde(default = "default_min_gdi")]
    pub min_gdi: f64,
    
    #[serde(default = "default_limit")]
    pub limit: i32,
}

fn default_min_gdi() -> f64 { 0.7 }
fn default_limit() -> i32 { 20 }

/// Validation schema for hello request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HelloRequestSchema {
    pub protocol: String,
    pub protocol_version: String,
}

/// Validation schema for heartbeat request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeartbeatRequestSchema {
    pub node_id: String,
}

/// Validation schema for report request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportRequestSchema {
    pub asset_id: String,
    pub success: bool,
}

/// Validation schema for revoke request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevokeRequestSchema {
    pub asset_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

/// Validation schema for LLM call options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMCallOptionsSchema {
    pub model: String,
    pub temperature: f64,
    pub max_tokens: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
}

impl Default for LLMCallOptionsSchema {
    fn default() -> Self {
        Self {
            model: "qwen-coder-plus".to_string(),
            temperature: 0.7,
            max_tokens: 2000,
            system_prompt: None,
        }
    }
}

/// Validation result
#[derive(Debug, Clone)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
}

impl ValidationResult {
    pub fn success() -> Self {
        Self {
            valid: true,
            errors: vec![],
        }
    }
    
    pub fn error(msg: impl Into<String>) -> Self {
        Self {
            valid: false,
            errors: vec![msg.into()],
        }
    }
    
    pub fn add_error(&mut self, msg: impl Into<String>) {
        self.valid = false;
        self.errors.push(msg.into());
    }
}

/// Validate asset type
pub fn validate_asset_type(asset_type: &str) -> ValidationResult {
    match asset_type {
        "Gene" | "Capsule" | "EvolutionEvent" => ValidationResult::success(),
        _ => ValidationResult::error(format!("Invalid asset type: {}", asset_type)),
    }
}

/// Validate protocol version
pub fn validate_protocol_version(protocol: &str, version: &str) -> ValidationResult {
    if protocol != "gep-a2a" {
        return ValidationResult::error(format!("Unsupported protocol: {}", protocol));
    }
    if version != "1.0.0" {
        return ValidationResult::error(format!("Unsupported version: {}", version));
    }
    ValidationResult::success()
}

/// Validate signals
pub fn validate_signals(signals: &[String]) -> ValidationResult {
    if signals.is_empty() {
        return ValidationResult::error("signals_match cannot be empty");
    }
    
    for signal in signals {
        if signal.is_empty() {
            return ValidationResult::error("signal cannot be empty");
        }
        if signal.len() > 64 {
            return ValidationResult::error(format!("signal too long: {}", signal));
        }
    }
    
    ValidationResult::success()
}

/// Validate code diff
pub fn validate_code_diff(code_diff: &str) -> ValidationResult {
    if code_diff.is_empty() {
        return ValidationResult::error("code_diff cannot be empty");
    }
    if code_diff.len() > 10000 {
        return ValidationResult::error("code_diff exceeds maximum length of 10000");
    }
    ValidationResult::success()
}

/// Validate commands
pub fn validate_commands(commands: &[String]) -> ValidationResult {
    use crate::utils::{is_dangerous_command, is_whitelisted_command};
    
    if commands.is_empty() {
        return ValidationResult::error("validate_commands cannot be empty");
    }
    
    for cmd in commands {
        if is_dangerous_command(cmd) {
            return ValidationResult::error(format!("Dangerous command detected: {}", cmd));
        }
        if !is_whitelisted_command(cmd) {
            return ValidationResult::error(format!("Command not in whitelist: {}", cmd));
        }
    }
    
    ValidationResult::success()
}

/// Validate semver version
pub fn validate_semver(version: &str) -> ValidationResult {
    let regex = regex::Regex::new(r"^\d+\.\d+\.\d+(-[\w.]+)?$").unwrap();
    if regex.is_match(version) {
        ValidationResult::success()
    } else {
        ValidationResult::error(format!("Invalid semver: {}", version))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_validate_asset_type() {
        assert!(validate_asset_type("Gene").valid);
        assert!(validate_asset_type("Capsule").valid);
        assert!(!validate_asset_type("Invalid").valid);
    }
    
    #[test]
    fn test_validate_protocol_version() {
        assert!(validate_protocol_version("gep-a2a", "1.0.0").valid);
        assert!(!validate_protocol_version("invalid", "1.0.0").valid);
        assert!(!validate_protocol_version("gep-a2a", "2.0.0").valid);
    }
    
    #[test]
    fn test_validate_signals() {
        assert!(validate_signals(&["test".to_string()]).valid);
        assert!(!validate_signals(&[]).valid);
        assert!(!validate_signals(&["".to_string()]).valid);
    }
    
    #[test]
    fn test_validate_semver() {
        assert!(validate_semver("1.0.0").valid);
        assert!(validate_semver("1.0.0-beta").valid);
        assert!(!validate_semver("invalid").valid);
    }
}
