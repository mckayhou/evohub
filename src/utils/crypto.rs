use bcrypt::{hash, verify, DEFAULT_COST};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// JWT Claims
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub node_id: String,
    pub exp: usize,
}

/// Generate JWT token
pub fn generate_token(node_id: &str, secret: &str, duration_days: i64) -> Result<String, jsonwebtoken::errors::Error> {
    let expiration = chrono::Utc::now()
        + chrono::Duration::days(duration_days);
    
    let claims = Claims {
        node_id: node_id.to_string(),
        exp: expiration.timestamp() as usize,
    };
    
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

/// Verify JWT token
pub fn verify_token(token: &str, secret: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let validation = Validation::default();
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )?;
    Ok(token_data.claims)
}

/// Hash password using bcrypt
pub fn hash_password(password: &str) -> Result<String, bcrypt::BcryptError> {
    hash(password, DEFAULT_COST)
}

/// Verify password hash
pub fn verify_password(password: &str, hash: &str) -> Result<bool, bcrypt::BcryptError> {
    verify(password, hash)
}

/// Compute SHA-256 hash
pub fn compute_sha256(data: &[u8]) -> String {
    let hash = Sha256::digest(data);
    hex::encode(hash)
}

/// Generate node ID
pub fn generate_node_id() -> String {
    let timestamp = chrono::Utc::now().timestamp_millis();
    let random = uuid::Uuid::new_v4().to_string();
    let random_part = random.split('-').next().unwrap_or("");
    format!("node_{}_{}", timestamp, random_part)
}

/// Generate node secret
pub fn generate_node_secret() -> String {
    let timestamp = chrono::Utc::now().timestamp_millis();
    let random = uuid::Uuid::new_v4().to_string();
    let random_part = random.split('-').next().unwrap_or("");
    format!("secret_{}_{}", timestamp, random_part)
}

/// Generate asset ID
pub fn generate_asset_id(prefix: &str) -> String {
    let timestamp = chrono::Utc::now().timestamp_millis();
    let random = uuid::Uuid::new_v4().to_string();
    let random_part = random.split('-').next().unwrap_or("");
    format!("{}_{}_{}", prefix, timestamp, random_part)
}

/// Generate decision ID
pub fn generate_decision_id() -> String {
    generate_asset_id("decision")
}

/// Generate task ID
pub fn generate_task_id() -> String {
    generate_asset_id("task")
}

/// Generate session ID
pub fn generate_session_id() -> String {
    generate_asset_id("session")
}

/// Generate UUID v4
pub fn generate_uuid() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Generate HMAC signature
pub fn generate_hmac(data: &str, secret: &str) -> String {
    use hmac::{Hmac, Mac};
    use sha2::Sha256;
    
    type HmacSha256 = Hmac<Sha256>;
    
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .expect("HMAC can take key of any size");
    mac.update(data.as_bytes());
    let result = mac.finalize();
    hex::encode(result.into_bytes())
}

/// Verify HMAC signature
pub fn verify_hmac(data: &str, secret: &str, signature: &str) -> bool {
    let expected = generate_hmac(data, secret);
    expected == signature
}

/// Generate content hash for deduplication
pub fn generate_content_hash(content: &str) -> String {
    compute_sha256(content.as_bytes())
}

/// Generate API key
pub fn generate_api_key() -> String {
    let random = uuid::Uuid::new_v4().to_string().replace("-", "");
    format!("ek_{}", random)
}

/// Mask sensitive data
pub fn mask_sensitive(s: &str, visible: usize) -> String {
    if s.len() <= visible * 2 {
        return "***".to_string();
    }
    let start = &s[..visible];
    let end = &s[s.len() - visible..];
    format!("{}***{}", start, end)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_generate_node_id() {
        let id = generate_node_id();
        assert!(id.starts_with("node_"));
        assert!(id.len() > 10);
    }
    
    #[test]
    fn test_generate_node_secret() {
        let secret = generate_node_secret();
        assert!(secret.starts_with("secret_"));
        assert!(secret.len() > 20);
    }
    
    #[test]
    fn test_compute_sha256() {
        let hash = compute_sha256(b"test");
        assert_eq!(hash.len(), 64);
    }
    
    #[test]
    fn test_generate_content_hash() {
        let hash1 = generate_content_hash("test data");
        let hash2 = generate_content_hash("test data");
        assert_eq!(hash1, hash2);
    }
    
    #[test]
    fn test_mask_sensitive() {
        assert_eq!(mask_sensitive("1234567890", 2), "12***90");
        assert_eq!(mask_sensitive("abc", 1), "a***c");
        assert_eq!(mask_sensitive("ab", 1), "***");
    }
}
