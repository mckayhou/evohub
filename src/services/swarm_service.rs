use crate::models::bounty::{
    Bounty, BountyStatus, TaskType, Priority,
    CreateBountyRequest, CreateBountyResponse,
    JoinBountyRequest, JoinBountyResponse,
    SubmitDecisionRequest, SubmitDecisionResponse,
    ListBountiesResponse, BountySummary,
    GetBountyResponse, BountyDetail, ParticipantSummary,
    CancelBountyRequest, CancelBountyResponse,
};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Swarm Bounty service
pub struct SwarmService {
    bounties: Arc<Mutex<HashMap<String, Bounty>>>,
}

impl SwarmService {
    pub fn new() -> Self {
        Self {
            bounties: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Create a new bounty
    pub fn create_bounty(
        &self,
        creator_node_id: String,
        req: CreateBountyRequest,
    ) -> Result<CreateBountyResponse, String> {
        let bounty_id = format!("bounty_{}_{}", 
            chrono::Utc::now().timestamp_millis(),
            uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("")
        );

        let mut bounty = Bounty::new(
            bounty_id.clone(),
            creator_node_id,
            req.title,
            req.description,
            req.task_type,
            req.duration_hours.unwrap_or(24),
        );

        // Apply optional fields
        if let Some(reqs) = req.requirements {
            bounty.requirements = reqs;
        }
        bounty.rewards = req.rewards;
        if let Some(tags) = req.tags {
            bounty.tags = tags;
        }
        if let Some(priority) = req.priority {
            bounty.priority = priority;
        }

        let mut bounties = self.bounties.lock().unwrap();
        bounties.insert(bounty_id.clone(), bounty);

        Ok(CreateBountyResponse {
            success: true,
            bounty_id,
            status: BountyStatus::Open,
        })
    }

    /// Join a bounty
    pub fn join_bounty(
        &self,
        node_id: String,
        req: JoinBountyRequest,
    ) -> Result<JoinBountyResponse, String> {
        let mut bounties = self.bounties.lock().unwrap();
        
        let bounty = bounties
            .get_mut(&req.bounty_id)
            .ok_or("Bounty not found")?;

        if !bounty.can_join(&node_id) {
            return Err("Cannot join bounty".to_string());
        }

        bounty.join(node_id);

        Ok(JoinBountyResponse {
            success: true,
            bounty_id: req.bounty_id,
            participants_count: bounty.participants.len(),
            status: bounty.status.clone(),
        })
    }

    /// Submit decision
    pub fn submit_decision(
        &self,
        node_id: String,
        req: SubmitDecisionRequest,
    ) -> Result<SubmitDecisionResponse, String> {
        let mut bounties = self.bounties.lock().unwrap();
        
        let bounty = bounties
            .get_mut(&req.bounty_id)
            .ok_or("Bounty not found")?;

        if bounty.status != BountyStatus::InProgress {
            return Err("Bounty is not in progress".to_string());
        }

        bounty.submit_decision(&node_id, req.decision, req.reasoning)?;

        Ok(SubmitDecisionResponse {
            success: true,
            bounty_id: req.bounty_id,
            consensus_reached: bounty.result.as_ref().map(|r| r.consensus_reached).unwrap_or(false),
            final_decision: bounty.result.as_ref().map(|r| r.final_decision.clone()),
            status: bounty.status.clone(),
        })
    }

    /// List available bounties
    pub fn list_bounties(
        &self,
        task_type: Option<TaskType>,
        tags: Option<Vec<String>>,
        priority: Option<Priority>,
        limit: i32,
    ) -> ListBountiesResponse {
        let bounties = self.bounties.lock().unwrap();
        
        let mut results: Vec<_> = bounties
            .values()
            .filter(|b| {
                matches!(b.status, BountyStatus::Open | BountyStatus::InProgress)
                    && b.deadline > chrono::Utc::now()
            })
            .filter(|b| {
                if let Some(ref tt) = task_type {
                    b.task_type == *tt
                } else {
                    true
                }
            })
            .filter(|b| {
                if let Some(ref t) = tags {
                    t.iter().any(|tag| b.tags.contains(tag))
                } else {
                    true
                }
            })
            .filter(|b| {
                if let Some(ref p) = priority {
                    b.priority == *p
                } else {
                    true
                }
            })
            .cloned()
            .collect();

        // Sort by priority and created_at
        results.sort_by(|a, b| {
            let priority_order = |p: &Priority| match p {
                Priority::Critical => 4,
                Priority::High => 3,
                Priority::Medium => 2,
                Priority::Low => 1,
            };
            priority_order(&b.priority)
                .cmp(&priority_order(&a.priority))
                .then_with(|| b.created_at.cmp(&a.created_at))
        });

        results.truncate(limit as usize);

        ListBountiesResponse {
            success: true,
            count: results.len(),
            bounties: results.into_iter().map(|b| BountySummary {
                bounty_id: b.bounty_id,
                title: b.title,
                description: truncate(&b.description, 200),
                task_type: b.task_type,
                status: b.status,
                rewards: b.rewards,
                deadline: b.deadline,
                participants_count: b.participants.len(),
                tags: b.tags,
                priority: b.priority,
            }).collect(),
        }
    }

    /// Get bounty details
    pub fn get_bounty(&self, bounty_id: &str) -> Result<GetBountyResponse, String> {
        let bounties = self.bounties.lock().unwrap();
        
        let bounty = bounties
            .get(bounty_id)
            .ok_or("Bounty not found")?;

        Ok(GetBountyResponse {
            success: true,
            bounty: BountyDetail {
                bounty_id: bounty.bounty_id.clone(),
                title: bounty.title.clone(),
                description: bounty.description.clone(),
                task_type: bounty.task_type.clone(),
                requirements: bounty.requirements.clone(),
                rewards: bounty.rewards.clone(),
                status: bounty.status.clone(),
                deadline: bounty.deadline,
                created_at: bounty.created_at,
                creator_node_id: bounty.creator_node_id.clone(),
                participants: bounty.participants.iter().map(|p| ParticipantSummary {
                    node_id: p.node_id.clone(),
                    joined_at: p.joined_at,
                    decision: p.decision.clone(),
                    submitted_at: p.submitted_at,
                }).collect(),
                result: bounty.result.clone(),
                tags: bounty.tags.clone(),
                priority: bounty.priority.clone(),
            },
        })
    }

    /// Cancel bounty
    pub fn cancel_bounty(
        &self,
        node_id: String,
        req: CancelBountyRequest,
    ) -> Result<CancelBountyResponse, String> {
        let mut bounties = self.bounties.lock().unwrap();
        
        let bounty = bounties
            .get_mut(&req.bounty_id)
            .ok_or("Bounty not found")?;

        bounty.cancel(&node_id)?;

        Ok(CancelBountyResponse {
            success: true,
            bounty_id: req.bounty_id,
            status: bounty.status.clone(),
        })
    }

    /// Cleanup expired bounties
    pub fn cleanup_expired(&self) -> usize {
        let mut bounties = self.bounties.lock().unwrap();
        let expired: Vec<_> = bounties
            .iter()
            .filter(|(_, b)| {
                matches!(b.status, BountyStatus::Open | BountyStatus::InProgress)
                    && b.deadline < chrono::Utc::now()
            })
            .map(|(id, _)| id.clone())
            .collect();

        let count = expired.len();
        for id in expired {
            if let Some(bounty) = bounties.get_mut(&id) {
                bounty.status = BountyStatus::Expired;
            }
        }

        count
    }
}

impl Default for SwarmService {
    fn default() -> Self {
        Self::new()
    }
}

fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::bounty::Rewards;

    fn create_test_bounty_req() -> CreateBountyRequest {
        CreateBountyRequest {
            title: "Test Bounty".to_string(),
            description: "Test description".to_string(),
            task_type: TaskType::CodeReview,
            requirements: None,
            rewards: Rewards { credits: 100, reputation: 0.05 },
            duration_hours: Some(24),
            tags: None,
            priority: None,
        }
    }

    #[test]
    fn test_create_bounty() {
        let service = SwarmService::new();
        let req = create_test_bounty_req();
        
        let result = service.create_bounty("node_1".to_string(), req);
        assert!(result.is_ok());
        
        let response = result.unwrap();
        assert!(response.success);
        assert!(!response.bounty_id.is_empty());
    }

    #[test]
    fn test_join_bounty() {
        let service = SwarmService::new();
        
        // Create bounty
        let create_result = service.create_bounty("node_1".to_string(), create_test_bounty_req());
        let bounty_id = create_result.unwrap().bounty_id;
        
        // Join with different node
        let join_req = JoinBountyRequest { bounty_id: bounty_id.clone() };
        let join_result = service.join_bounty("node_2".to_string(), join_req);
        
        assert!(join_result.is_ok());
        assert_eq!(join_result.unwrap().participants_count, 1);
    }

    #[test]
    fn test_cancel_bounty() {
        let service = SwarmService::new();
        
        let create_result = service.create_bounty("node_1".to_string(), create_test_bounty_req());
        let bounty_id = create_result.unwrap().bounty_id;
        
        let cancel_req = CancelBountyRequest { bounty_id };
        let cancel_result = service.cancel_bounty("node_1".to_string(), cancel_req);
        
        assert!(cancel_result.is_ok());
        assert!(matches!(cancel_result.unwrap().status, BountyStatus::Cancelled));
    }
}
