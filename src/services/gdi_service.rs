use crate::models::asset::{Asset, AssetData};
use crate::utils::{calculate_freshness, is_dangerous_command, is_whitelisted_command};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// GDI (Gene Development Index) calculation service
pub struct GDIService {
    llm_api_key: Option<String>,
    llm_base_url: Option<String>,
    llm_model: Option<String>,
}

impl GDIService {
    pub fn new(
        llm_api_key: Option<String>,
        llm_base_url: Option<String>,
        llm_model: Option<String>,
    ) -> Self {
        Self {
            llm_api_key,
            llm_base_url,
            llm_model,
        }
    }

    /// Calculate GDI for an asset
    pub async fn calculate_gdi(&self, asset: &mut Asset) -> GDICalculation {
        // Calculate individual scores
        let quality_score = self.calculate_quality_score(asset).await;
        let rules_score = self.calculate_rules_score(asset);
        let usage_score = self.calculate_usage_score(asset);
        let social_score = self.calculate_social_score(asset);
        let freshness_score = self.calculate_freshness_score(asset);

        // Combined quality: LLM 35% + Rules 65%
        let combined_quality = 0.35 * quality_score + 0.65 * rules_score;

        // Final GDI
        let gdi = 0.35 * combined_quality
            + 0.30 * usage_score
            + 0.20 * social_score
            + 0.15 * freshness_score;

        // Update asset
        asset.quality_score = Some(quality_score);
        asset.rules_score = Some(rules_score);
        asset.usage_score = Some(usage_score);
        asset.social_score = Some(social_score);
        asset.freshness_score = Some(freshness_score);
        asset.gdi_score = gdi;
        asset.update_gdi(gdi);

        GDICalculation {
            gdi_score: gdi,
            breakdown: GDIBreakdown {
                quality: quality_score,
                rules: rules_score,
                combined_quality,
                usage: usage_score,
                social: social_score,
                freshness: freshness_score,
            },
            recommendation: if gdi >= 0.7 {
                "promote".to_string()
            } else if gdi >= 0.5 {
                "candidate".to_string()
            } else {
                "quarantine".to_string()
            },
            reason: self.generate_reason(&quality_score, &rules_score),
            confidence_level: if gdi >= 0.8 {
                "high"
            } else if gdi >= 0.6 {
                "medium"
            } else {
                "low"
            }
            .to_string(),
        }
    }

    /// Calculate LLM quality score (simplified - would call actual LLM)
    async fn calculate_quality_score(&self, asset: &Asset) -> f64 {
        // In production, this would call LLM API with self-consistency N=3
        // For now, return a reasonable default based on asset completeness
        let mut score: f64 = 0.7;

        // Bonus for complete fields
        if asset.code_diff.is_some() && !asset.code_diff.as_ref().unwrap().is_empty() {
            score += 0.1;
        }
        if asset.validate_commands.is_some() && !asset.validate_commands.as_ref().unwrap().is_empty() {
            score += 0.1;
        }
        if asset.preconditions.is_some() {
            score += 0.05;
        }
        if asset.constraints.is_some() {
            score += 0.05;
        }

        score.min(1.0)
    }

    /// Calculate rules-based score (65% of GDI)
    fn calculate_rules_score(&self, asset: &Asset) -> f64 {
        let structure = self.check_structure_rules(asset);
        let safety = self.check_safety_rules(asset);
        let quality = self.check_quality_rules(asset);
        let completeness = self.check_completeness_rules(asset);
        let best_practices = self.check_best_practices_rules(asset);

        // Weights: Structure 25%, Safety 25%, Quality 20%, Completeness 15%, Best Practices 15%
        let score = 0.25 * structure
            + 0.25 * safety
            + 0.20 * quality
            + 0.15 * completeness
            + 0.15 * best_practices;

        score
    }

    /// Structure rules (25%)
    fn check_structure_rules(&self, asset: &Asset) -> f64 {
        let mut score = 0.0;
        let mut checks = 0;

        // Check asset_id format
        if asset.asset_id.len() > 10 && asset.asset_id.contains('_') {
            score += 1.0;
        }
        checks += 1;

        // Check valid type
        if matches!(asset.r#type, crate::models::asset::AssetType::Gene | crate::models::asset::AssetType::Capsule) {
            score += 1.0;
        }
        checks += 1;

        // Check semver version
        // Check semver format (simplified without regex)
        let parts: Vec<&str> = asset.version.split('.').collect();
        if parts.len() >= 3 && parts.iter().all(|p| p.parse::<u32>().is_ok()) {
            score += 1.0;
        }
        checks += 1;

        // Check signals
        if !asset.signals_match.is_empty() {
            score += 1.0;
        }
        checks += 1;

        if checks == 0 {
            0.0
        } else {
            score / checks as f64
        }
    }

    /// Safety rules (25%)
    fn check_safety_rules(&self, asset: &Asset) -> f64 {
        let mut score: f64 = 1.0;

        // Check code_diff for dangerous commands
        if let Some(code) = &asset.code_diff {
            if is_dangerous_command(code) {
                score -= 0.4;
            }
        }

        // Check validate_commands whitelist
        if let Some(commands) = &asset.validate_commands {
            for cmd in commands {
                if is_dangerous_command(cmd) {
                    score -= 0.3;
                }
                if !is_whitelisted_command(cmd) {
                    score -= 0.2;
                }
            }
        }

        // Check timeout constraint
        if let Some(constraints) = &asset.constraints {
            if let Some(timeout) = constraints.get("timeout") {
                if let Some(timeout_val) = timeout.as_u64() {
                    if timeout_val <= 180000 {
                        // 3 minutes max
                        score += 0.1;
                    }
                }
            }
        }

        score.max(0.0).min(1.0)
    }

    /// Quality rules (20%)
    fn check_quality_rules(&self, asset: &Asset) -> f64 {
        let mut score = 0.0;
        let mut checks = 0;

        // Check summary length
        if asset.summary.len() >= 20 {
            score += 1.0;
        }
        checks += 1;

        // Check code_diff length
        if let Some(code) = &asset.code_diff {
            if code.len() >= 50 {
                score += 1.0;
            }
        }
        checks += 1;

        // Check validate_commands
        if let Some(commands) = &asset.validate_commands {
            if !commands.is_empty() {
                score += 1.0;
            }
        }
        checks += 1;

        if checks == 0 {
            0.0
        } else {
            score / checks as f64
        }
    }

    /// Completeness rules (15%)
    fn check_completeness_rules(&self, asset: &Asset) -> f64 {
        let mut score = 0.0;
        let mut checks = 0;

        // Check preconditions
        if let Some(pre) = &asset.preconditions {
            if !pre.is_empty() {
                score += 1.0;
            }
        }
        checks += 1;

        // Check constraints
        if let Some(constraints) = &asset.constraints {
            if !constraints.is_empty() {
                score += 1.0;
            }
        }
        checks += 1;

        // Check detailed signals
        if asset.signals_match.iter().all(|s| s.len() >= 3) {
            score += 1.0;
        }
        checks += 1;

        if checks == 0 {
            0.0
        } else {
            score / checks as f64
        }
    }

    /// Best practices rules (15%)
    fn check_best_practices_rules(&self, asset: &Asset) -> f64 {
        let mut score = 0.0;
        let mut checks = 0;

        // Check semantic versioning (simplified)
        let parts: Vec<&str> = asset.version.split('.').collect();
        if parts.len() >= 3 && parts.iter().all(|p| p.parse::<u32>().is_ok()) {
            score += 1.0;
        }
        checks += 1;

        // Check asset_id format (simplified)
        let prefix = asset.asset_id.split('_').next().unwrap_or("");
        if !prefix.is_empty() && prefix.chars().next().unwrap().is_ascii_lowercase() {
            score += 1.0;
        }
        checks += 1;

        // Check code comments
        if let Some(code) = &asset.code_diff {
            if code.contains("//") || code.contains("/*") {
                score += 1.0;
            }
        }
        checks += 1;

        if checks == 0 {
            0.0
        } else {
            score / checks as f64
        }
    }

    /// Calculate usage score
    fn calculate_usage_score(&self, asset: &Asset) -> f64 {
        if asset.total_reports == 0 {
            return 0.5; // Neutral for new assets
        }
        asset.success_rate()
    }

    /// Calculate social score
    fn calculate_social_score(&self, asset: &Asset) -> f64 {
        // Based on fetch count and community feedback
        // Simplified: use fetch count as proxy
        let fetch_score = (asset.fetch_count as f64 / 100.0).min(1.0);
        0.5 + 0.5 * fetch_score
    }

    /// Calculate freshness score
    fn calculate_freshness_score(&self, asset: &Asset) -> f64 {
        calculate_freshness(asset.published_at)
    }

    /// Generate reason text
    fn generate_reason(&self, quality: &f64, rules: &f64) -> String {
        if *quality > 0.8 && *rules > 0.8 {
            "Excellent quality and compliance".to_string()
        } else if *quality > 0.6 {
            "Good quality with minor issues".to_string()
        } else if *rules > 0.6 {
            "Compliant but needs quality improvement".to_string()
        } else {
            "Needs improvement in both quality and compliance".to_string()
        }
    }
}

/// GDI calculation result
#[derive(Debug, Clone)]
pub struct GDICalculation {
    pub gdi_score: f64,
    pub breakdown: GDIBreakdown,
    pub recommendation: String,
    pub reason: String,
    pub confidence_level: String,
}

/// GDI score breakdown
#[derive(Debug, Clone)]
pub struct GDIBreakdown {
    pub quality: f64,
    pub rules: f64,
    pub combined_quality: f64,
    pub usage: f64,
    pub social: f64,
    pub freshness: f64,
}

/// LLM scoring request
#[derive(Debug, Serialize)]
struct LLMScoringRequest {
    asset: AssetData,
    criteria: Vec<String>,
}

/// LLM scoring response
#[derive(Debug, Deserialize)]
struct LLMScoringResponse {
    quality_score: f64,
    dimension_scores: HashMap<String, f64>,
    recommendation: String,
    reason: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::asset::{AssetData, AssetType};

    fn create_test_asset() -> Asset {
        let data = AssetData {
            r#type: AssetType::Gene,
            version: "1.0.0".to_string(),
            signals_match: vec!["test".to_string()],
            summary: "Test asset for GDI calculation".to_string(),
            category: None,
            preconditions: Some(vec!["node >= 18".to_string()]),
            constraints: None,
            code_diff: Some("// Test code\nconsole.log('test');".to_string()),
            validate_commands: Some(vec!["npm test".to_string()]),
            parent_gene: None,
            outcome: None,
            confidence: None,
            blast_radius: None,
            env_fingerprint: None,
            success_rate: None,
        };
        Asset::new("gene_test_001".to_string(), "node_test".to_string(), data)
    }

    #[tokio::test]
    async fn test_calculate_gdi() {
        let service = GDIService::new(None, None, None);
        let mut asset = create_test_asset();
        
        let result = service.calculate_gdi(&mut asset).await;
        
        assert!(result.gdi_score >= 0.0 && result.gdi_score <= 1.0);
        assert!(!result.recommendation.is_empty());
        assert!(!result.confidence_level.is_empty());
    }

    #[test]
    fn test_check_structure_rules() {
        let service = GDIService::new(None, None, None);
        let asset = create_test_asset();
        
        let score = service.check_structure_rules(&asset);
        assert!(score >= 0.0 && score <= 1.0);
    }

    #[test]
    fn test_check_safety_rules() {
        let service = GDIService::new(None, None, None);
        let asset = create_test_asset();
        
        let score = service.check_safety_rules(&asset);
        assert!(score >= 0.0 && score <= 1.0);
    }
}
