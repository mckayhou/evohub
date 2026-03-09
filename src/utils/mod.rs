use sha2::{Digest, Sha256};
use std::collections::HashMap;

pub mod crypto;
pub mod schemas;

pub use crypto::*;
pub use schemas::*;

// Validation regex patterns
pub const SEMVER_REGEX: &str = r"^\d+\.\d+\.\d+(-[\w.]+)?$";
pub const NODE_ID_REGEX: &str = r"^node_[a-z0-9_]+$";
pub const ASSET_ID_REGEX: &str = r"^[a-z][a-z0-9_]*$";

/// Hash data using SHA-256
pub fn hash_data<T: serde::Serialize>(data: &T) -> String {
    let json = serde_json::to_string(data).unwrap_or_default();
    let hash = Sha256::digest(json.as_bytes());
    hex::encode(hash)
}

/// Generate unique ID with prefix
pub fn generate_id(prefix: &str) -> String {
    let timestamp = chrono::Utc::now().timestamp_millis();
    let random = uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("").to_string();
    format!("{}_{}_{}", prefix, timestamp, random)
}

/// Calculate time decay score (freshness)
pub fn calculate_freshness(published_at: chrono::DateTime<chrono::Utc>) -> f64 {
    let now = chrono::Utc::now();
    let days = (now - published_at).num_days() as f64;
    
    // Exponential decay: score = e^(-days/30)
    // Half-life of 30 days
    (-days / 30.0).exp()
}

/// Calculate success rate
pub fn calculate_success_rate(success: i32, total: i32) -> f64 {
    if total == 0 {
        return 0.0;
    }
    success as f64 / total as f64
}

/// Weighted average calculation
pub fn weighted_average(values: &[(f64, f64)]) -> f64 {
    let sum_weighted: f64 = values.iter().map(|(v, w)| v * w).sum();
    let sum_weights: f64 = values.iter().map(|(_, w)| w).sum();
    
    if sum_weights == 0.0 {
        return 0.0;
    }
    
    sum_weighted / sum_weights
}

/// Check if command is dangerous
pub fn is_dangerous_command(command: &str) -> bool {
    let dangerous = [
        "rm -rf /",
        "dd if=",
        "mkfs",
        ":(){ :|:& };:",
        "> /dev/sda",
        "curl | sh",
        "wget | sh",
    ];
    
    dangerous.iter().any(|d| command.contains(d))
}

/// Check if command is in whitelist
pub fn is_whitelisted_command(command: &str) -> bool {
    let whitelist = [
        "npm",
        "node",
        "npx",
        "yarn",
        "pnpm",
        "git",
        "docker",
        "cargo",
        "rustc",
        "go",
        "python",
        "python3",
        "pip",
        "pytest",
        "jest",
        "vitest",
        "mocha",
    ];
    
    let cmd = command.split_whitespace().next().unwrap_or("");
    whitelist.iter().any(|w| cmd.starts_with(w))
}

/// Parse signals from string
pub fn parse_signals(signals: &[String]) -> Vec<String> {
    signals
        .iter()
        .flat_map(|s| s.split(',').map(|s| s.trim().to_lowercase()))
        .filter(|s| !s.is_empty())
        .collect()
}

/// Merge two hashmaps
pub fn merge_maps<K, V>(a: &mut HashMap<K, V>, b: HashMap<K, V>)
where
    K: std::hash::Hash + Eq,
{
    a.extend(b);
}

/// Truncate string with ellipsis
pub fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len])
    }
}

/// Format bytes to human readable
pub fn format_bytes(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_index = 0;
    
    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }
    
    format!("{:.2} {}", size, UNITS[unit_index])
}

/// Rate limit check
pub struct RateLimiter {
    requests: HashMap<String, Vec<chrono::DateTime<chrono::Utc>>>,
    window: chrono::Duration,
    max_requests: i32,
}

impl RateLimiter {
    pub fn new(window_minutes: i64, max_requests: i32) -> Self {
        Self {
            requests: HashMap::new(),
            window: chrono::Duration::minutes(window_minutes),
            max_requests,
        }
    }
    
    pub fn check(&mut self, key: &str) -> bool {
        let now = chrono::Utc::now();
        let window_start = now - self.window;
        
        let timestamps = self.requests.entry(key.to_string()).or_default();
        
        // Remove old timestamps
        timestamps.retain(|&t| t > window_start);
        
        // Check limit
        if timestamps.len() >= self.max_requests as usize {
            return false;
        }
        
        // Add new timestamp
        timestamps.push(now);
        true
    }
    
    pub fn remaining(&mut self, key: &str) -> i32 {
        let now = chrono::Utc::now();
        let window_start = now - self.window;
        
        let timestamps = self.requests.entry(key.to_string()).or_default();
        timestamps.retain(|&t| t > window_start);
        
        self.max_requests - timestamps.len() as i32
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_hash_data() {
        let data = "test data";
        let hash1 = hash_data(&data);
        let hash2 = hash_data(&data);
        assert_eq!(hash1, hash2);
        assert_eq!(hash1.len(), 64); // SHA-256 hex length
    }
    
    #[test]
    fn test_generate_id() {
        let id1 = generate_id("test");
        let id2 = generate_id("test");
        assert!(id1.starts_with("test_"));
        assert_ne!(id1, id2);
    }
    
    #[test]
    fn test_is_dangerous_command() {
        assert!(is_dangerous_command("rm -rf /"));
        assert!(!is_dangerous_command("npm test"));
    }
    
    #[test]
    fn test_weighted_average() {
        let values = vec![(0.8, 0.5), (0.6, 0.5)];
        let avg = weighted_average(&values);
        assert_eq!(avg, 0.7);
    }
}
