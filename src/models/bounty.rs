use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum BountyStatus {
    Open,
    InProgress,
    Completed,
    Cancelled,
    Expired,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TaskType {
    CodeReview,
    BugFix,
    Optimization,
    Documentation,
    Testing,
    Research,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Decision {
    Accept,
    Reject,
    Abstain,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bounty {
    pub bounty_id: String,
    pub title: String,
    pub description: String,
    pub task_type: TaskType,
    pub requirements: Requirements,
    pub rewards: Rewards,
    pub created_at: DateTime<Utc>,
    pub deadline: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<DateTime<Utc>>,
    pub status: BountyStatus,
    pub creator_node_id: String,
    pub participants: Vec<Participant>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<BountyResult>,
    pub tags: Vec<String>,
    pub priority: Priority,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Requirements {
    pub skills: Vec<String>,
    pub min_reputation: f64,
    pub max_nodes: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rewards {
    pub credits: i32,
    pub reputation: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Participant {
    pub node_id: String,
    pub joined_at: DateTime<Utc>,
    pub decision: Decision,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub submitted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BountyResult {
    pub consensus_reached: bool,
    pub final_decision: String,
    pub winning_nodes: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub solution_asset_id: Option<String>,
}

impl Bounty {
    pub fn new(
        bounty_id: String,
        creator_node_id: String,
        title: String,
        description: String,
        task_type: TaskType,
        duration_hours: i64,
    ) -> Self {
        let now = Utc::now();
        Self {
            bounty_id,
            title,
            description,
            task_type,
            requirements: Requirements {
                skills: vec![],
                min_reputation: 0.5,
                max_nodes: 5,
            },
            rewards: Rewards {
                credits: 100,
                reputation: 0.05,
            },
            created_at: now,
            deadline: now + chrono::Duration::hours(duration_hours),
            completed_at: None,
            status: BountyStatus::Open,
            creator_node_id,
            participants: vec![],
            result: None,
            tags: vec![],
            priority: Priority::Medium,
        }
    }

    pub fn can_join(&self, node_id: &str) -> bool {
        if self.status != BountyStatus::Open {
            return false;
        }
        if self.deadline < Utc::now() {
            return false;
        }
        if self.participants.len() >= self.requirements.max_nodes as usize {
            return false;
        }
        if self.participants.iter().any(|p| p.node_id == node_id) {
            return false;
        }
        true
    }

    pub fn join(&mut self, node_id: String) {
        self.participants.push(Participant {
            node_id,
            joined_at: Utc::now(),
            decision: Decision::Abstain,
            reasoning: None,
            submitted_at: None,
        });

        // Auto-start if min participants reached
        if self.participants.len() >= 3 {
            self.status = BountyStatus::InProgress;
        }
    }

    pub fn submit_decision(&mut self, node_id: &str, decision: Decision, reasoning: Option<String>) -> Result<(), String> {
        let participant = self.participants
            .iter_mut()
            .find(|p| p.node_id == node_id)
            .ok_or("Not a participant")?;
        
        if participant.submitted_at.is_some() {
            return Err("Decision already submitted".to_string());
        }
        
        participant.decision = decision;
        participant.reasoning = reasoning;
        participant.submitted_at = Some(Utc::now());
        
        // Check consensus
        self.check_consensus();
        
        Ok(())
    }

    fn check_consensus(&mut self) {
        let submitted: Vec<_> = self.participants
            .iter()
            .filter(|p| p.submitted_at.is_some())
            .collect();
        
        if submitted.len() < 3 {
            return;
        }
        
        // Count decisions
        let mut counts: HashMap<Decision, i32> = HashMap::new();
        for p in &submitted {
            *counts.entry(p.decision.clone()).or_insert(0) += 1;
        }
        
        // Find majority
        let total = self.participants.len();
        let threshold = (total as f64 * 0.67) as i32;
        
        for (decision, count) in counts {
            if count >= threshold {
                self.status = BountyStatus::Completed;
                self.completed_at = Some(Utc::now());
                self.result = Some(BountyResult {
                    consensus_reached: true,
                    final_decision: format!("{:?}", decision).to_lowercase(),
                    winning_nodes: submitted
                        .iter()
                        .filter(|p| p.decision == decision)
                        .map(|p| p.node_id.clone())
                        .collect(),
                    solution_asset_id: None,
                });
                return;
            }
        }
        
        // All submitted but no consensus
        if submitted.len() == total {
            self.status = BountyStatus::Completed;
            self.completed_at = Some(Utc::now());
            self.result = Some(BountyResult {
                consensus_reached: false,
                final_decision: "no_consensus".to_string(),
                winning_nodes: vec![],
                solution_asset_id: None,
            });
        }
    }

    pub fn cancel(&mut self, node_id: &str) -> Result<(), String> {
        if self.creator_node_id != node_id {
            return Err("Only creator can cancel".to_string());
        }
        if self.status == BountyStatus::Completed {
            return Err("Cannot cancel completed bounty".to_string());
        }
        
        self.status = BountyStatus::Cancelled;
        Ok(())
    }

    pub fn is_expired(&self) -> bool {
        self.deadline < Utc::now()
    }
}

// Request/Response types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateBountyRequest {
    pub title: String,
    pub description: String,
    pub task_type: TaskType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub requirements: Option<Requirements>,
    pub rewards: Rewards,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_hours: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<Priority>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateBountyResponse {
    pub success: bool,
    pub bounty_id: String,
    pub status: BountyStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JoinBountyRequest {
    pub bounty_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JoinBountyResponse {
    pub success: bool,
    pub bounty_id: String,
    pub participants_count: usize,
    pub status: BountyStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitDecisionRequest {
    pub bounty_id: String,
    pub decision: Decision,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub solution_asset_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitDecisionResponse {
    pub success: bool,
    pub bounty_id: String,
    pub consensus_reached: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub final_decision: Option<String>,
    pub status: BountyStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListBountiesRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub task_type: Option<TaskType>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<Priority>,
    #[serde(default = "default_limit")]
    pub limit: i32,
}

fn default_limit() -> i32 { 50 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListBountiesResponse {
    pub success: bool,
    pub count: usize,
    pub bounties: Vec<BountySummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BountySummary {
    pub bounty_id: String,
    pub title: String,
    pub description: String,
    pub task_type: TaskType,
    pub status: BountyStatus,
    pub rewards: Rewards,
    pub deadline: DateTime<Utc>,
    pub participants_count: usize,
    pub tags: Vec<String>,
    pub priority: Priority,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetBountyResponse {
    pub success: bool,
    pub bounty: BountyDetail,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BountyDetail {
    pub bounty_id: String,
    pub title: String,
    pub description: String,
    pub task_type: TaskType,
    pub requirements: Requirements,
    pub rewards: Rewards,
    pub status: BountyStatus,
    pub deadline: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub creator_node_id: String,
    pub participants: Vec<ParticipantSummary>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<BountyResult>,
    pub tags: Vec<String>,
    pub priority: Priority,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParticipantSummary {
    pub node_id: String,
    pub joined_at: DateTime<Utc>,
    pub decision: Decision,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub submitted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CancelBountyRequest {
    pub bounty_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CancelBountyResponse {
    pub success: bool,
    pub bounty_id: String,
    pub status: BountyStatus,
}
