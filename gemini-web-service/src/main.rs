use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{Html, Json},
    routing::{get, post, delete},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::{cors::CorsLayer, services::ServeDir, trace::TraceLayer};
use tracing::{info, warn};

mod gemini;
mod workspace;
mod config;

use gemini::GeminiConfig;
use workspace::{Workspace, WorkspaceManager};

// API Types
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    success: bool,
    data: Option<T>,
    error: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn error(msg: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(msg),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateWorkspaceRequest {
    name: String,
    config: GeminiConfig,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecuteCommandRequest {
    command: String,
    auto_approve: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResult {
    pub output: String,
    pub status: String,
    pub execution_time: u64,
}

// Application State
#[derive(Clone)]
pub struct AppState {
    workspace_manager: Arc<RwLock<WorkspaceManager>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            workspace_manager: Arc::new(RwLock::new(WorkspaceManager::new())),
        }
    }
}

// Handlers
async fn health() -> Json<ApiResponse<String>> {
    Json(ApiResponse::success("Gemini Web Service is running".to_string()))
}

async fn serve_frontend() -> Html<String> {
    let html = include_str!("../frontend/index.html");
    Html(html.to_string())
}

async fn list_workspaces(State(state): State<AppState>) -> Json<ApiResponse<Vec<Workspace>>> {
    let manager = state.workspace_manager.read().await;
    let workspaces = manager.list_workspaces();
    Json(ApiResponse::success(workspaces))
}

async fn create_workspace(
    State(state): State<AppState>,
    Json(req): Json<CreateWorkspaceRequest>,
) -> Result<Json<ApiResponse<Workspace>>, StatusCode> {
    let mut manager = state.workspace_manager.write().await;
    
    match manager.create_workspace(req.name, req.config).await {
        Ok(workspace) => Ok(Json(ApiResponse::success(workspace))),
        Err(e) => {
            warn!("Failed to create workspace: {}", e);
            Ok(Json(ApiResponse::error(format!("Failed to create workspace: {}", e))))
        }
    }
}

async fn get_workspace(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Json<ApiResponse<Workspace>> {
    let manager = state.workspace_manager.read().await;
    
    match manager.get_workspace(&id) {
        Some(workspace) => Json(ApiResponse::success(workspace.clone())),
        None => Json(ApiResponse::error("Workspace not found".to_string())),
    }
}

async fn delete_workspace(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Json<ApiResponse<String>> {
    let mut manager = state.workspace_manager.write().await;
    
    if manager.delete_workspace(&id) {
        Json(ApiResponse::success("Workspace deleted".to_string()))
    } else {
        Json(ApiResponse::error("Workspace not found".to_string()))
    }
}

async fn execute_command(
    State(state): State<AppState>,
    Path(workspace_id): Path<String>,
    Json(req): Json<ExecuteCommandRequest>,
) -> Json<ApiResponse<CommandResult>> {
    let manager = state.workspace_manager.read().await;
    
    match manager.execute_command(&workspace_id, &req.command, req.auto_approve.unwrap_or(false)).await {
        Ok(result) => Json(ApiResponse::success(result)),
        Err(e) => {
            warn!("Command execution failed: {}", e);
            Json(ApiResponse::error(format!("Command execution failed: {}", e)))
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();
    
    info!("Starting Gemini Web Service...");

    let state = AppState::new();

    // Build our application with routes
    let app = Router::new()
        .route("/", get(serve_frontend))
        .route("/health", get(health))
        .route("/api/workspaces", get(list_workspaces))
        .route("/api/workspaces", post(create_workspace))
        .route("/api/workspaces/:id", get(get_workspace))
        .route("/api/workspaces/:id", delete(delete_workspace))
        .route("/api/workspaces/:id/execute", post(execute_command))
        .nest_service("/static", ServeDir::new("frontend/static"))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    // Start the server
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8080").await?;
    info!("Server listening on http://127.0.0.1:8080");
    
    axum::serve(listener, app).await?;

    Ok(())
}
