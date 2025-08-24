use crate::gemini::{GeminiClient, GeminiConfig, GeminiProvider};
use crate::CommandResult;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Command;
use std::time::Instant;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub config: GeminiConfig,
    pub created_at: u64,
    pub working_directory: Option<PathBuf>,
    pub status: WorkspaceStatus,
    pub command_history: Vec<CommandHistoryEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WorkspaceStatus {
    Active,
    Inactive,
    Error(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandHistoryEntry {
    pub command: String,
    pub timestamp: u64,
    pub result: Option<CommandResult>,
    pub auto_approved: bool,
}

impl Workspace {
    pub fn new(name: String, config: GeminiConfig) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            config,
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            working_directory: None,
            status: WorkspaceStatus::Active,
            command_history: Vec::new(),
        }
    }

    pub fn set_working_directory(&mut self, dir: PathBuf) {
        self.working_directory = Some(dir);
    }

    pub fn add_command_to_history(&mut self, command: String, result: Option<CommandResult>, auto_approved: bool) {
        let entry = CommandHistoryEntry {
            command,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            result,
            auto_approved,
        };
        self.command_history.push(entry);
    }
}

pub struct WorkspaceManager {
    workspaces: HashMap<String, Workspace>,
    gemini_clients: HashMap<String, GeminiClient>,
}

impl WorkspaceManager {
    pub fn new() -> Self {
        Self {
            workspaces: HashMap::new(),
            gemini_clients: HashMap::new(),
        }
    }

    pub async fn create_workspace(&mut self, name: String, config: GeminiConfig) -> Result<Workspace> {
        let workspace = Workspace::new(name, config.clone());
        let id = workspace.id.clone();

        // Create Gemini client for this workspace
        let client = GeminiClient::new(config);
        
        // Test the client connection
        match client.list_models().await {
            Ok(models) => {
                info!("Workspace {} created with {} available models", id, models.len());
            }
            Err(e) => {
                warn!("Failed to connect to Gemini API for workspace {}: {}", id, e);
                // Continue anyway, connection might work later
            }
        }

        self.gemini_clients.insert(id.clone(), client);
        self.workspaces.insert(id.clone(), workspace.clone());

        Ok(workspace)
    }

    pub fn list_workspaces(&self) -> Vec<Workspace> {
        self.workspaces.values().cloned().collect()
    }

    pub fn get_workspace(&self, id: &str) -> Option<&Workspace> {
        self.workspaces.get(id)
    }

    pub fn delete_workspace(&mut self, id: &str) -> bool {
        let removed = self.workspaces.remove(id).is_some();
        if removed {
            self.gemini_clients.remove(id);
            info!("Workspace {} deleted", id);
        }
        removed
    }

    pub async fn execute_command(
        &self,
        workspace_id: &str,
        command: &str,
        auto_approve: bool,
    ) -> Result<CommandResult> {
        let workspace = self.workspaces.get(workspace_id)
            .ok_or_else(|| anyhow!("Workspace not found"))?;

        let client = self.gemini_clients.get(workspace_id)
            .ok_or_else(|| anyhow!("Gemini client not found for workspace"))?;

        info!("Executing command in workspace {}: {}", workspace_id, command);

        let start_time = Instant::now();
        let result = if auto_approve {
            self.execute_system_command(command, &workspace.working_directory).await
        } else {
            // For manual approval, we'll analyze the command with Gemini first
            self.analyze_and_execute_command(command, client, &workspace.working_directory).await
        };

        let execution_time = start_time.elapsed().as_millis() as u64;

        match result {
            Ok(output) => Ok(CommandResult {
                output,
                status: "success".to_string(),
                execution_time,
            }),
            Err(e) => {
                error!("Command execution failed: {}", e);
                Ok(CommandResult {
                    output: format!("Error: {}", e),
                    status: "error".to_string(),
                    execution_time,
                })
            }
        }
    }

    async fn analyze_and_execute_command(
        &self,
        command: &str,
        client: &GeminiClient,
        working_dir: &Option<PathBuf>,
    ) -> Result<String> {
        // Use Gemini to analyze the command for safety and provide insights
        let analysis_prompt = format!(
            "Analyze this command for safety and provide execution recommendations: '{}'",
            command
        );

        debug!("Analyzing command with Gemini: {}", command);

        match client.generate_content(&analysis_prompt).await {
            Ok(analysis) => {
                info!("Gemini analysis: {}", analysis);
                
                // For now, we'll execute the command after analysis
                // In a real implementation, you might want to check for dangerous commands
                if self.is_safe_command(command) {
                    self.execute_system_command(command, working_dir).await
                } else {
                    Err(anyhow!("Command deemed unsafe: {}", command))
                }
            }
            Err(e) => {
                warn!("Failed to analyze command with Gemini: {}", e);
                // Fallback to direct execution for safe commands
                if self.is_safe_command(command) {
                    self.execute_system_command(command, working_dir).await
                } else {
                    Err(anyhow!("Command analysis failed and command not in safe list"))
                }
            }
        }
    }

    async fn execute_system_command(
        &self,
        command: &str,
        working_dir: &Option<PathBuf>,
    ) -> Result<String> {
        debug!("Executing system command: {}", command);

        let mut cmd = if cfg!(target_os = "windows") {
            let mut c = Command::new("cmd");
            c.args(["/C", command]);
            c
        } else {
            let mut c = Command::new("sh");
            c.args(["-c", command]);
            c
        };

        if let Some(dir) = working_dir {
            cmd.current_dir(dir);
        }

        let output = cmd.output()?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        if output.status.success() {
            if stderr.is_empty() {
                Ok(stdout.to_string())
            } else {
                Ok(format!("Output: {}\nWarnings: {}", stdout, stderr))
            }
        } else {
            Err(anyhow!("Command failed: {}", stderr))
        }
    }

    fn is_safe_command(&self, command: &str) -> bool {
        let safe_commands = [
            "ls", "dir", "pwd", "cd", "echo", "cat", "head", "tail",
            "grep", "find", "ps", "which", "whoami", "date", "uptime",
            "git status", "git log", "git diff", "git branch",
            "npm list", "cargo check", "python --version",
        ];

        let dangerous_patterns = [
            "rm -rf", "del /s", "format", "fdisk", "mkfs",
            "sudo rm", "chmod 777", ">/dev/", "dd if=",
            "&& rm", "; rm", "| rm", "shutdown", "reboot",
        ];

        // Check if command starts with a safe command
        let is_safe = safe_commands.iter().any(|&safe_cmd| {
            command.trim().starts_with(safe_cmd)
        });

        // Check for dangerous patterns
        let is_dangerous = dangerous_patterns.iter().any(|&pattern| {
            command.to_lowercase().contains(pattern)
        });

        is_safe && !is_dangerous
    }

    pub async fn get_command_suggestions(&self, workspace_id: &str, context: &str) -> Result<Vec<String>> {
        let client = self.gemini_clients.get(workspace_id)
            .ok_or_else(|| anyhow!("Gemini client not found for workspace"))?;

        let prompt = format!(
            "Given this context: '{}', suggest 3-5 useful command-line commands that would be helpful. Return only the commands, one per line.",
            context
        );

        match client.generate_content(&prompt).await {
            Ok(response) => {
                let suggestions = response
                    .lines()
                    .map(|line| line.trim().to_string())
                    .filter(|line| !line.is_empty())
                    .collect();
                Ok(suggestions)
            }
            Err(e) => {
                error!("Failed to get command suggestions: {}", e);
                Err(e)
            }
        }
    }

    pub async fn explain_command(&self, workspace_id: &str, command: &str) -> Result<String> {
        let client = self.gemini_clients.get(workspace_id)
            .ok_or_else(|| anyhow!("Gemini client not found for workspace"))?;

        let prompt = format!(
            "Explain what this command does and any potential risks: '{}'",
            command
        );

        client.generate_content(&prompt).await
    }
}