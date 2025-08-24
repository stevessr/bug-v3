use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub cors_enabled: bool,
    pub max_workspaces: usize,
    pub command_timeout_seconds: u64,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 8080,
            cors_enabled: true,
            max_workspaces: 10,
            command_timeout_seconds: 300,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub gemini_cli_path: Option<PathBuf>,
    pub default_workspace_dir: Option<PathBuf>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            server: ServerConfig::default(),
            gemini_cli_path: None,
            default_workspace_dir: dirs::home_dir(),
        }
    }
}

impl AppConfig {
    pub fn load() -> Result<Self> {
        // For now, return default config
        // In the future, this could load from a config file
        Ok(Self::default())
    }

    pub fn get_gemini_cli_path(&self) -> Option<&PathBuf> {
        self.gemini_cli_path.as_ref()
    }

    pub fn set_gemini_cli_path(&mut self, path: PathBuf) {
        self.gemini_cli_path = Some(path);
    }
}