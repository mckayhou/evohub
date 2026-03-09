use crate::models::node::{
    Node, NodeCredentials, HelloRequest, HelloResponse,
    HeartbeatRequest, HeartbeatResponse,
};
use crate::utils::crypto::{generate_node_id, generate_node_secret, generate_token, verify_token};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Node management service
pub struct NodeService {
    nodes: Arc<Mutex<HashMap<String, Node>>>,
    jwt_secret: String,
}

impl NodeService {
    pub fn new(jwt_secret: String) -> Self {
        Self {
            nodes: Arc::new(Mutex::new(HashMap::new())),
            jwt_secret,
        }
    }

    /// Register a new node
    pub fn register(&self, req: HelloRequest) -> Result<HelloResponse, String> {
        // Validate protocol
        if req.protocol != "gep-a2a" || req.protocol_version != "1.0.0" {
            return Err("Unsupported protocol version".to_string());
        }

        let node_id = generate_node_id();
        let node_secret = generate_node_secret();
        
        let mut node = Node::new(node_id.clone(), node_secret.clone());
        
        // Store capabilities and env_fingerprint if provided
        if let Some(payload) = req.payload {
            if let Some(caps) = payload.capabilities {
                node.capabilities = caps;
            }
            if let Some(env) = payload.env_fingerprint {
                node.env_fingerprint = env;
            }
        }

        let token = generate_token(&node_id, &self.jwt_secret, 7)
            .map_err(|e| format!("Failed to generate token: {}", e))?;

        let mut nodes = self.nodes.lock().unwrap();
        nodes.insert(node_id.clone(), node);

        Ok(HelloResponse {
            success: true,
            node_id,
            node_secret,
            token,
            credits: 500,
            hub_version: "2.5.0".to_string(),
            protocol_version: "GEP-A2A-v1.0.0".to_string(),
        })
    }

    /// Update heartbeat
    pub fn heartbeat(&self, node_id: String, _req: HeartbeatRequest) -> Result<HeartbeatResponse, String> {
        let mut nodes = self.nodes.lock().unwrap();
        
        let node = nodes
            .get_mut(&node_id)
            .ok_or("Node not found")?;

        node.update_heartbeat();

        Ok(HeartbeatResponse {
            success: true,
            status: "alive".to_string(),
            credits: node.credits,
            timestamp: chrono::Utc::now(),
        })
    }

    /// Verify JWT token and return node_id
    pub fn verify_auth(&self, token: &str) -> Result<String, String> {
        let claims = verify_token(token, &self.jwt_secret)
            .map_err(|e| format!("Invalid token: {}", e))?;
        Ok(claims.node_id)
    }

    /// Get node by ID
    pub fn get_node(&self, node_id: &str) -> Option<Node> {
        let nodes = self.nodes.lock().unwrap();
        nodes.get(node_id).cloned()
    }

    /// List active nodes
    pub fn list_active_nodes(&self) -> Vec<Node> {
        let nodes = self.nodes.lock().unwrap();
        nodes
            .values()
            .filter(|n| n.is_active())
            .cloned()
            .collect()
    }

    /// Update node credits
    pub fn update_credits(&self, node_id: &str, delta: i32) -> Result<i32, String> {
        let mut nodes = self.nodes.lock().unwrap();
        
        let node = nodes
            .get_mut(node_id)
            .ok_or("Node not found")?;

        node.credits += delta;
        Ok(node.credits)
    }

    /// Update node reputation
    pub fn update_reputation(&self, node_id: &str, delta: f64) -> Result<f64, String> {
        let mut nodes = self.nodes.lock().unwrap();
        
        let node = nodes
            .get_mut(node_id)
            .ok_or("Node not found")?;

        node.reputation = (node.reputation + delta).clamp(0.0, 1.0);
        Ok(node.reputation)
    }

    /// Cleanup inactive nodes
    pub fn cleanup_inactive(&self, max_age_minutes: i64) -> usize {
        let mut nodes = self.nodes.lock().unwrap();
        let cutoff = chrono::Utc::now() - chrono::Duration::minutes(max_age_minutes);
        
        let to_remove: Vec<_> = nodes
            .iter()
            .filter(|(_, n)| n.last_heartbeat < cutoff)
            .map(|(id, _)| id.clone())
            .collect();

        let count = to_remove.len();
        for id in to_remove {
            nodes.remove(&id);
        }

        count
    }

    /// Get node count
    pub fn node_count(&self) -> usize {
        let nodes = self.nodes.lock().unwrap();
        nodes.len()
    }

    /// Get active node count
    pub fn active_node_count(&self) -> usize {
        let nodes = self.nodes.lock().unwrap();
        nodes.values().filter(|n| n.is_active()).count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_hello_request() -> HelloRequest {
        HelloRequest {
            protocol: "gep-a2a".to_string(),
            protocol_version: "1.0.0".to_string(),
            payload: None,
        }
    }

    #[test]
    fn test_register_node() {
        let service = NodeService::new("test-secret".to_string());
        let req = create_test_hello_request();
        
        let result = service.register(req);
        assert!(result.is_ok());
        
        let response = result.unwrap();
        assert!(response.success);
        assert!(!response.node_id.is_empty());
        assert!(!response.token.is_empty());
        assert_eq!(response.credits, 500);
    }

    #[test]
    fn test_register_invalid_protocol() {
        let service = NodeService::new("test-secret".to_string());
        let req = HelloRequest {
            protocol: "invalid".to_string(),
            protocol_version: "1.0.0".to_string(),
            payload: None,
        };
        
        let result = service.register(req);
        assert!(result.is_err());
    }

    #[test]
    fn test_verify_auth() {
        let service = NodeService::new("test-secret".to_string());
        let req = create_test_hello_request();
        
        let response = service.register(req).unwrap();
        let verified = service.verify_auth(&response.token);
        
        assert!(verified.is_ok());
        assert_eq!(verified.unwrap(), response.node_id);
    }

    #[test]
    fn test_heartbeat() {
        let service = NodeService::new("test-secret".to_string());
        let req = create_test_hello_request();
        
        let response = service.register(req).unwrap();
        let heartbeat_req = HeartbeatRequest {
            node_id: response.node_id.clone(),
        };
        
        let result = service.heartbeat(response.node_id, heartbeat_req);
        assert!(result.is_ok());
        assert_eq!(result.unwrap().status, "alive");
    }

    #[test]
    fn test_update_credits() {
        let service = NodeService::new("test-secret".to_string());
        let req = create_test_hello_request();
        
        let response = service.register(req).unwrap();
        let new_credits = service.update_credits(&response.node_id, 100);
        
        assert!(new_credits.is_ok());
        assert_eq!(new_credits.unwrap(), 600);
    }
}
