use anyhow::{anyhow, Result};
use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tracing::{debug, error, info};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiConfig {
    pub api_type: ApiType,
    pub api_key: Option<String>,
    pub project_id: Option<String>, // For Vertex AI
    pub region: Option<String>,     // For Vertex AI
    pub login_file_path: Option<PathBuf>, // For reusing existing login
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ApiType {
    #[serde(rename = "gemini")]
    Gemini,
    #[serde(rename = "vertex")]
    Vertex,
    #[serde(rename = "login_file")]
    LoginFile,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeminiRequest {
    pub contents: Vec<Content>,
    pub generation_config: Option<GenerationConfig>,
    pub safety_settings: Option<Vec<SafetySetting>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Content {
    pub parts: Vec<Part>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Part {
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerationConfig {
    pub temperature: Option<f32>,
    pub top_p: Option<f32>,
    pub top_k: Option<i32>,
    pub max_output_tokens: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SafetySetting {
    pub category: String,
    pub threshold: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeminiResponse {
    pub candidates: Vec<Candidate>,
    pub usage_metadata: Option<UsageMetadata>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Candidate {
    pub content: Content,
    pub finish_reason: Option<String>,
    pub safety_ratings: Option<Vec<SafetyRating>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SafetyRating {
    pub category: String,
    pub probability: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UsageMetadata {
    pub prompt_token_count: Option<i32>,
    pub candidates_token_count: Option<i32>,
    pub total_token_count: Option<i32>,
}

#[async_trait]
pub trait GeminiProvider {
    async fn generate_content(&self, prompt: &str) -> Result<String>;
    async fn chat(&self, messages: &[String]) -> Result<String>;
    async fn list_models(&self) -> Result<Vec<String>>;
}

pub struct GeminiClient {
    config: GeminiConfig,
    client: Client,
}

impl GeminiClient {
    pub fn new(config: GeminiConfig) -> Self {
        Self {
            config,
            client: Client::new(),
        }
    }

    fn get_api_endpoint(&self, model: &str) -> Result<String> {
        match self.config.api_type {
            ApiType::Gemini => {
                let api_key = self.config.api_key.as_ref()
                    .ok_or_else(|| anyhow!("API key required for Gemini API"))?;
                Ok(format!(
                    "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
                    model, api_key
                ))
            }
            ApiType::Vertex => {
                let project_id = self.config.project_id.as_ref()
                    .ok_or_else(|| anyhow!("Project ID required for Vertex AI"))?;
                let region = self.config.region.as_ref()
                    .ok_or_else(|| anyhow!("Region required for Vertex AI"))?;
                Ok(format!(
                    "https://{}-aiplatform.googleapis.com/v1/projects/{}/locations/{}/publishers/google/models/{}:generateContent",
                    region, project_id, region, model
                ))
            }
            ApiType::LoginFile => {
                // For login file, we'll need to parse the file and determine the appropriate endpoint
                Err(anyhow!("Login file authentication not yet implemented"))
            }
        }
    }

    async fn get_auth_headers(&self) -> Result<HashMap<String, String>> {
        let mut headers = HashMap::new();
        headers.insert("Content-Type".to_string(), "application/json".to_string());

        match self.config.api_type {
            ApiType::Gemini => {
                // API key is already in the URL for Gemini API
            }
            ApiType::Vertex => {
                // For Vertex AI, we would need OAuth2 token
                // This is a simplified implementation
                if let Some(api_key) = &self.config.api_key {
                    headers.insert("Authorization".to_string(), format!("Bearer {}", api_key));
                }
            }
            ApiType::LoginFile => {
                // Parse login file and extract credentials
                if let Some(login_path) = &self.config.login_file_path {
                    info!("Using login file: {:?}", login_path);
                    // TODO: Implement login file parsing
                }
            }
        }

        Ok(headers)
    }
}

#[async_trait]
impl GeminiProvider for GeminiClient {
    async fn generate_content(&self, prompt: &str) -> Result<String> {
        debug!("Generating content for prompt: {}", prompt);

        let model = "gemini-1.5-flash"; // Default model
        let endpoint = self.get_api_endpoint(model)?;
        let headers = self.get_auth_headers().await?;

        let request = GeminiRequest {
            contents: vec![Content {
                parts: vec![Part {
                    text: prompt.to_string(),
                }],
            }],
            generation_config: Some(GenerationConfig {
                temperature: Some(0.7),
                top_p: Some(0.8),
                top_k: Some(40),
                max_output_tokens: Some(2048),
            }),
            safety_settings: Some(vec![
                SafetySetting {
                    category: "HARM_CATEGORY_HARASSMENT".to_string(),
                    threshold: "BLOCK_MEDIUM_AND_ABOVE".to_string(),
                },
                SafetySetting {
                    category: "HARM_CATEGORY_HATE_SPEECH".to_string(),
                    threshold: "BLOCK_MEDIUM_AND_ABOVE".to_string(),
                },
            ]),
        };

        let mut req_builder = self.client.post(&endpoint).json(&request);
        
        for (key, value) in headers {
            req_builder = req_builder.header(&key, &value);
        }

        let response = req_builder.send().await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            error!("API request failed: {}", error_text);
            return Err(anyhow!("API request failed: {}", error_text));
        }

        let gemini_response: GeminiResponse = response.json().await?;

        if let Some(candidate) = gemini_response.candidates.first() {
            if let Some(part) = candidate.content.parts.first() {
                return Ok(part.text.clone());
            }
        }

        Err(anyhow!("No content generated"))
    }

    async fn chat(&self, messages: &[String]) -> Result<String> {
        // For chat, we'll combine messages into a single prompt
        let combined_prompt = messages.join("\n");
        self.generate_content(&combined_prompt).await
    }

    async fn list_models(&self) -> Result<Vec<String>> {
        // Return available models based on API type
        match self.config.api_type {
            ApiType::Gemini => Ok(vec![
                "gemini-1.5-flash".to_string(),
                "gemini-1.5-pro".to_string(),
                "gemini-pro".to_string(),
                "gemini-pro-vision".to_string(),
            ]),
            ApiType::Vertex => Ok(vec![
                "gemini-1.5-flash".to_string(),
                "gemini-1.5-pro".to_string(),
                "gemini-pro".to_string(),
            ]),
            ApiType::LoginFile => Ok(vec![
                "gemini-1.5-flash".to_string(),
                "gemini-1.5-pro".to_string(),
            ]),
        }
    }
}

impl Default for GeminiConfig {
    fn default() -> Self {
        Self {
            api_type: ApiType::Gemini,
            api_key: None,
            project_id: None,
            region: Some("us-central1".to_string()),
            login_file_path: None,
        }
    }
}