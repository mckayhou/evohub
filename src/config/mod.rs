use anyhow::Result;

#[derive(Debug, Clone)]
pub struct Config {
    pub port: u16,
    pub mongodb_uri: String,
    pub redis_uri: String,
    pub jwt_secret: String,
    pub llm_api_key: Option<String>,
    pub llm_base_url: Option<String>,
    pub llm_model: Option<String>,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "3000".to_string())
                .parse()?,
            mongodb_uri: std::env::var("MONGODB_URI")
                .unwrap_or_else(|_| "mongodb://localhost:27017/evohub".to_string()),
            redis_uri: std::env::var("REDIS_URI")
                .unwrap_or_else(|_| "redis://localhost:6379".to_string()),
            jwt_secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "default-secret-change-in-production".to_string()),
            llm_api_key: std::env::var("LLM_API_KEY").ok(),
            llm_base_url: std::env::var("LLM_BASE_URL").ok(),
            llm_model: std::env::var("LLM_MODEL").ok(),
        })
    }
}
