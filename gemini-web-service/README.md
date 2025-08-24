# Gemini Web Service

A Rust-based web service that provides a web interface for Gemini CLI functionality. This service allows users to interact with Google's Gemini AI through a web interface, supporting multiple workspaces, command execution, and various authentication methods.

## Features

- **Multiple Workspace Support**: Create and manage multiple isolated workspaces
- **Flexible Authentication**: Support for Gemini API keys, Vertex AI, and existing login files
- **Command Execution**: Execute commands with AI assistance and safety analysis
- **Auto-approval Mode**: Option to auto-approve commands or require manual confirmation
- **Command History**: Track command execution history per workspace
- **AI Integration**: Use Gemini AI to explain commands and suggest improvements
- **Web Interface**: Modern, responsive web UI built with Tailwind CSS

## Architecture

### Backend (Rust)
- **Framework**: Axum web framework with Tokio async runtime
- **API Client**: Reqwest for HTTP requests to Gemini APIs
- **Workspace Management**: In-memory workspace management with command tracking
- **Safety**: Built-in command safety analysis and filtering

### Frontend
- **Pure JavaScript**: No framework dependencies
- **Tailwind CSS**: Modern, responsive styling
- **Real-time Updates**: Dynamic UI updates for workspace and command status

## Installation

### Prerequisites

- Rust 1.70+ 
- Cargo package manager

### Building from Source

```bash
cd gemini-web-service
cargo build --release
```

### Running the Service

```bash
cargo run
```

The service will start on `http://127.0.0.1:8080` by default.

## Configuration

### API Types

#### 1. Gemini API
- **Requirements**: Valid Gemini API key
- **Endpoint**: `https://generativelanguage.googleapis.com`
- **Setup**: Get API key from [Google AI Studio](https://ai.google.dev/gemini-api/docs/api-key)

#### 2. Vertex AI
- **Requirements**: GCP project ID, region, and OAuth2 token
- **Endpoint**: `https://{region}-aiplatform.googleapis.com`
- **Setup**: Enable Vertex AI API in Google Cloud Console

#### 3. Login File (Experimental)
- **Requirements**: Existing Gemini CLI login file
- **Purpose**: Reuse existing authentication from Gemini CLI
- **Note**: Implementation depends on Gemini CLI file format

## API Endpoints

### Health Check
```
GET /health
```

### Workspace Management
```
GET    /api/workspaces           # List all workspaces
POST   /api/workspaces           # Create new workspace
GET    /api/workspaces/{id}      # Get workspace details
DELETE /api/workspaces/{id}      # Delete workspace
```

### Command Execution
```
POST /api/workspaces/{id}/execute
```

Request body:
```json
{
  "command": "ls -la",
  "auto_approve": false
}
```

## Usage

### Creating a Workspace

1. Click "New Workspace" in the web interface
2. Choose your authentication method:
   - **Gemini API**: Enter your API key
   - **Vertex AI**: Enter project ID, region, and API key
   - **Login File**: Specify path to existing login file
3. Name your workspace and click "Create"

### Executing Commands

1. Open a workspace by clicking on it
2. Enter a command in the input field
3. Choose execution mode:
   - **Manual**: Command will be analyzed by AI before execution
   - **Auto-approve**: Command will be executed immediately
4. Click "Execute" or press Enter

### Command Safety

The service includes built-in safety measures:

- **Safe Command Whitelist**: Common read-only commands (ls, ps, git status, etc.)
- **Dangerous Pattern Detection**: Blocks potentially harmful commands
- **AI Analysis**: Uses Gemini AI to analyze command safety (manual mode)

## Development

### Project Structure

```
gemini-web-service/
├── src/
│   ├── main.rs          # Main server and routing
│   ├── gemini.rs        # Gemini API client
│   ├── workspace.rs     # Workspace management
│   └── config.rs        # Configuration management
├── frontend/
│   ├── index.html       # Main web interface
│   └── static/
│       └── app.js       # Frontend JavaScript
└── Cargo.toml          # Rust dependencies
```

### Adding New Features

#### Backend
1. Add new API endpoints in `main.rs`
2. Implement business logic in appropriate modules
3. Update workspace management if needed

#### Frontend
1. Add UI elements to `index.html`
2. Implement functionality in `app.js`
3. Update API calls to match backend endpoints

### Testing

```bash
# Run the service
cargo run

# Test API endpoints
curl http://localhost:8080/health
curl -X POST http://localhost:8080/api/workspaces \
  -H "Content-Type: application/json" \
  -d '{"name":"test","config":{"api_type":"gemini","api_key":"your-key"}}'
```

## Security Considerations

- **API Keys**: Store API keys securely, never in plain text
- **Command Filtering**: Review and update safe command patterns
- **Network Security**: Use HTTPS in production
- **Input Validation**: All user inputs are validated and sanitized

## Roadmap

- [ ] **Enhanced Login File Support**: Full parsing of Gemini CLI login files
- [ ] **Persistent Storage**: Save workspace configurations to disk
- [ ] **Session Management**: User authentication and sessions
- [ ] **Command Templates**: Pre-defined command templates
- [ ] **Streaming Output**: Real-time command output streaming
- [ ] **File Upload/Download**: File management through web interface
- [ ] **Collaborative Features**: Multiple users per workspace

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
1. Check the existing issues in the repository
2. Create a new issue with detailed information
3. Include logs and configuration details when reporting bugs