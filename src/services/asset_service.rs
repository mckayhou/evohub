use crate::models::asset::{
    Asset, AssetData, AssetInput, AssetStatus, AssetType,
    PublishRequest, PublishResponse, PublishedAsset, AssetError,
    FetchRequest, FetchResponse, CapsuleSummary,
    ValidateRequest, ValidateResponse, AssetValidation,
    ReportRequest, ReportResponse,
    RevokeRequest, RevokeResponse,
};
use crate::services::GDIService;
use crate::utils::crypto::generate_content_hash;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Asset management service
pub struct AssetService {
    assets: Arc<Mutex<HashMap<String, Asset>>>,
    gdi_service: GDIService,
}

impl AssetService {
    pub fn new(gdi_service: GDIService) -> Self {
        Self {
            assets: Arc::new(Mutex::new(HashMap::new())),
            gdi_service,
        }
    }

    /// Publish assets
    pub async fn publish(
        &self,
        node_id: String,
        req: PublishRequest,
    ) -> PublishResponse {
        let mut saved = vec![];
        let mut errors = vec![];

        for input in req.payload.assets {
            // Check for duplicate
            if self.assets.lock().unwrap().contains_key(&input.asset_id) {
                errors.push(AssetError {
                    asset_id: input.asset_id.clone(),
                    error: "Asset already exists".to_string(),
                });
                continue;
            }

            // Create asset
            let data = AssetData {
                r#type: input.r#type.clone(),
                version: input.version.clone(),
                signals_match: input.signals_match.clone(),
                summary: input.summary.clone(),
                category: None,
                preconditions: input.preconditions.clone(),
                constraints: input.constraints.clone(),
                code_diff: input.code_diff.clone(),
                validate_commands: input.validate_commands.clone(),
                parent_gene: None,
                outcome: None,
                confidence: None,
                blast_radius: None,
                env_fingerprint: None,
                success_rate: None,
            };

            let mut asset = Asset::new(input.asset_id.clone(), node_id.clone(), data);

            // Calculate GDI
            let gdi_result = self.gdi_service.calculate_gdi(&mut asset).await;

            // Store asset
            self.assets.lock().unwrap().insert(input.asset_id.clone(), asset);

            saved.push(PublishedAsset {
                asset_id: input.asset_id,
                gdi: gdi_result.gdi_score,
                status: if gdi_result.gdi_score >= 0.7 {
                    "promoted"
                } else if gdi_result.gdi_score >= 0.5 {
                    "candidate"
                } else {
                    "quarantined"
                }.to_string(),
            });
        }

        PublishResponse {
            success: true,
            published: saved.len(),
            failed: errors.len(),
            assets: saved,
            errors: if errors.is_empty() { None } else { Some(errors) },
        }
    }

    /// Fetch assets
    pub fn fetch(&self, req: FetchRequest) -> FetchResponse {
        let assets = self.assets.lock().unwrap();

        let mut results: Vec<_> = assets
            .values()
            .filter(|a| a.status == AssetStatus::Promoted && a.gdi_score >= req.min_gdi)
            .filter(|a| {
                if let Some(ref signals) = req.signals {
                    a.signals_match.iter().any(|s| signals.contains(s))
                } else {
                    true
                }
            })
            .cloned()
            .collect();

        // Sort by GDI score descending
        results.sort_by(|a, b| b.gdi_score.partial_cmp(&a.gdi_score).unwrap());

        results.truncate(req.limit as usize);

        FetchResponse {
            success: true,
            count: results.len(),
            capsules: results.into_iter().map(|a| CapsuleSummary {
                asset_id: a.asset_id,
                r#type: a.r#type,
                gdi_score: a.gdi_score,
                summary: a.summary,
            }).collect(),
        }
    }

    /// Validate assets (dry run)
    pub fn validate(&self, req: ValidateRequest) -> ValidateResponse {
        let validations: Vec<_> = req.payload.assets.iter().map(|asset| {
            let mut errors = vec![];

            if asset.asset_id.is_empty() {
                errors.push("Missing asset_id".to_string());
            }
            if matches!(asset.r#type, AssetType::EvolutionEvent) {
                errors.push("Invalid asset type".to_string());
            }
            if asset.signals_match.is_empty() {
                errors.push("Missing signals_match".to_string());
            }
            if asset.summary.len() < 10 {
                errors.push("Summary too short".to_string());
            }

            AssetValidation {
                asset_id: asset.asset_id.clone(),
                valid: errors.is_empty(),
                errors: if errors.is_empty() { None } else { Some(errors) },
            }
        }).collect();

        let all_valid = validations.iter().all(|v| v.valid);

        ValidateResponse {
            valid: all_valid,
            message: if all_valid {
                "Validation passed"
            } else {
                "Some assets invalid"
            }.to_string(),
            validations,
        }
    }

    /// Report asset usage
    pub fn report(&self, req: ReportRequest) -> Result<ReportResponse, String> {
        let mut assets = self.assets.lock().unwrap();

        let asset = assets
            .get_mut(&req.asset_id)
            .ok_or("Asset not found")?;

        asset.report_usage(req.success);

        Ok(ReportResponse {
            success: true,
            asset_id: req.asset_id,
            success_rate: asset.success_rate(),
        })
    }

    /// Revoke asset
    pub fn revoke(
        &self,
        node_id: String,
        req: RevokeRequest,
    ) -> Result<RevokeResponse, String> {
        let mut assets = self.assets.lock().unwrap();

        let asset = assets
            .get_mut(&req.asset_id)
            .ok_or("Asset not found")?;

        if asset.node_id != node_id {
            return Err("Not authorized to revoke this asset".to_string());
        }

        asset.revoke(req.reason.unwrap_or_default());

        Ok(RevokeResponse {
            success: true,
            asset_id: req.asset_id,
            status: "revoked".to_string(),
        })
    }

    /// Get asset by ID
    pub fn get_asset(&self, asset_id: &str) -> Option<Asset> {
        let assets = self.assets.lock().unwrap();
        assets.get(asset_id).cloned()
    }

    /// Get asset count
    pub fn asset_count(&self) -> usize {
        let assets = self.assets.lock().unwrap();
        assets.len()
    }

    /// Get promoted asset count
    pub fn promoted_count(&self) -> usize {
        let assets = self.assets.lock().unwrap();
        assets.values().filter(|a| a.status == AssetStatus::Promoted).count()
    }

    /// Increment fetch count
    pub fn increment_fetch_count(&self, asset_id: &str) -> Result<(), String> {
        let mut assets = self.assets.lock().unwrap();

        let asset = assets
            .get_mut(asset_id)
            .ok_or("Asset not found")?;

        asset.fetch_count += 1;
        Ok(())
    }

    /// Get content hash for deduplication
    pub fn get_content_hash(&self, asset: &AssetInput) -> String {
        let content = format!(
            "{}:{}:{}:{}",
            asset.asset_id,
            asset.r#type,
            asset.version,
            asset.code_diff.as_deref().unwrap_or("")
        );
        generate_content_hash(&content)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_publish_request() -> PublishRequest {
        PublishRequest {
            payload: crate::models::asset::PublishPayload {
                assets: vec![AssetInput {
                    asset_id: "gene_test_001".to_string(),
                    r#type: AssetType::Gene,
                    version: "1.0.0".to_string(),
                    signals_match: vec!["test".to_string()],
                    summary: "Test asset for service".to_string(),
                    preconditions: None,
                    constraints: None,
                    code_diff: Some("// test".to_string()),
                    validate_commands: Some(vec!["npm test".to_string()]),
                }],
            },
        }
    }

    #[tokio::test]
    async fn test_publish_asset() {
        let gdi_service = GDIService::new(None, None, None);
        let service = AssetService::new(gdi_service);
        let req = create_test_publish_request();

        let result = service.publish("node_1".to_string(), req).await;

        assert_eq!(result.published, 1);
        assert!(result.assets[0].gdi > 0.0);
    }

    #[test]
    fn test_validate_assets() {
        let gdi_service = GDIService::new(None, None, None);
        let service = AssetService::new(gdi_service);

        let req = ValidateRequest {
            payload: crate::models::asset::PublishPayload {
                assets: vec![AssetInput {
                    asset_id: "gene_test_001".to_string(),
                    r#type: AssetType::Gene,
                    version: "1.0.0".to_string(),
                    signals_match: vec!["test".to_string()],
                    summary: "Test asset".to_string(),
                    preconditions: None,
                    constraints: None,
                    code_diff: None,
                    validate_commands: None,
                }],
            },
        };

        let result = service.validate(req);
        assert!(result.valid);
    }
}
