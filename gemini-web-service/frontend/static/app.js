class GeminiWebApp {
    constructor() {
        this.baseUrl = window.location.origin;
        this.currentWorkspace = null;
        this.workspaces = [];
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadWorkspaces();
        await this.checkHealth();
        this.updateUI();
    }

    bindEvents() {
        // Modal controls
        document.getElementById('createWorkspaceBtn').addEventListener('click', () => {
            this.showCreateWorkspaceModal();
        });

        document.getElementById('cancelCreateBtn').addEventListener('click', () => {
            this.hideCreateWorkspaceModal();
        });

        document.getElementById('createWorkspaceForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createWorkspace();
        });

        // API type change handler
        document.getElementById('apiType').addEventListener('change', (e) => {
            this.updateApiTypeFields(e.target.value);
        });

        // Command execution
        document.getElementById('executeBtn').addEventListener('click', () => {
            this.executeCommand();
        });

        document.getElementById('commandInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.executeCommand();
            }
        });

        // Workspace panel controls
        document.getElementById('closeWorkspaceBtn').addEventListener('click', () => {
            this.closeWorkspace();
        });

        document.getElementById('explainCommandBtn').addEventListener('click', () => {
            this.explainCommand();
        });

        document.getElementById('suggestCommandsBtn').addEventListener('click', () => {
            this.suggestCommands();
        });
    }

    async checkHealth() {
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            const data = await response.json();
            
            if (data.success) {
                this.updateConnectionStatus(true, 'Connected to Gemini Web Service');
            } else {
                this.updateConnectionStatus(false, 'Service error');
            }
        } catch (error) {
            console.error('Health check failed:', error);
            this.updateConnectionStatus(false, 'Connection failed');
        }
    }

    updateConnectionStatus(connected, message) {
        const statusElement = document.getElementById('connectionStatus');
        const textElement = document.getElementById('statusText');
        
        statusElement.className = `w-3 h-3 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-red-500'}`;
        textElement.textContent = message;
    }

    async loadWorkspaces() {
        try {
            const response = await fetch(`${this.baseUrl}/api/workspaces`);
            const data = await response.json();
            
            if (data.success) {
                this.workspaces = data.data || [];
                this.updateWorkspaceCount();
                this.renderWorkspaces();
            }
        } catch (error) {
            console.error('Failed to load workspaces:', error);
            this.showError('Failed to load workspaces');
        }
    }

    updateWorkspaceCount() {
        document.getElementById('workspaceCount').textContent = this.workspaces.length;
    }

    renderWorkspaces() {
        const container = document.getElementById('workspacesContainer');
        
        if (this.workspaces.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <i class="fas fa-plus-circle text-6xl text-gray-300 mb-4"></i>
                    <p class="text-gray-500 text-lg">No workspaces yet. Create your first workspace to get started!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.workspaces.map(workspace => this.createWorkspaceCard(workspace)).join('');
    }

    createWorkspaceCard(workspace) {
        const statusIcon = workspace.status === 'Active' ? 
            '<i class="fas fa-circle text-green-500"></i>' : 
            '<i class="fas fa-circle text-red-500"></i>';

        const apiTypeLabel = {
            'gemini': 'Gemini API',
            'vertex': 'Vertex AI',
            'login_file': 'Login File'
        }[workspace.config.api_type] || workspace.config.api_type;

        return `
            <div class="workspace-card bg-white rounded-lg shadow-md p-6 cursor-pointer" 
                 onclick="app.openWorkspace('${workspace.id}')">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold">${workspace.name}</h3>
                    <div class="flex items-center space-x-2">
                        ${statusIcon}
                        <button onclick="event.stopPropagation(); app.deleteWorkspace('${workspace.id}')" 
                                class="text-red-500 hover:text-red-700">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                <div class="text-sm text-gray-600 mb-3">
                    <p><strong>API:</strong> ${apiTypeLabel}</p>
                    <p><strong>Created:</strong> ${new Date(workspace.created_at * 1000).toLocaleDateString()}</p>
                    <p><strong>Commands:</strong> ${workspace.command_history?.length || 0}</p>
                </div>
                
                <div class="flex justify-between items-center">
                    <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        ${workspace.status}
                    </span>
                    <span class="text-blue-600 hover:text-blue-800">
                        Open <i class="fas fa-arrow-right ml-1"></i>
                    </span>
                </div>
            </div>
        `;
    }

    showCreateWorkspaceModal() {
        document.getElementById('createWorkspaceModal').classList.remove('hidden');
        this.updateApiTypeFields('gemini');
    }

    hideCreateWorkspaceModal() {
        document.getElementById('createWorkspaceModal').classList.add('hidden');
        document.getElementById('createWorkspaceForm').reset();
    }

    updateApiTypeFields(apiType) {
        const sections = {
            apiKey: document.getElementById('apiKeySection'),
            vertex: document.getElementById('vertexSection'),
            loginFile: document.getElementById('loginFileSection')
        };

        // Hide all sections first
        Object.values(sections).forEach(section => section.classList.add('hidden'));

        // Show relevant sections
        switch (apiType) {
            case 'gemini':
                sections.apiKey.classList.remove('hidden');
                break;
            case 'vertex':
                sections.apiKey.classList.remove('hidden');
                sections.vertex.classList.remove('hidden');
                break;
            case 'login_file':
                sections.loginFile.classList.remove('hidden');
                break;
        }
    }

    async createWorkspace() {
        const form = document.getElementById('createWorkspaceForm');
        const formData = new FormData(form);
        
        const name = document.getElementById('workspaceName').value;
        const apiType = document.getElementById('apiType').value;
        
        const config = {
            api_type: apiType
        };

        // Add fields based on API type
        if (apiType === 'gemini' || apiType === 'vertex') {
            const apiKey = document.getElementById('apiKey').value;
            if (apiKey) config.api_key = apiKey;
        }

        if (apiType === 'vertex') {
            const projectId = document.getElementById('projectId').value;
            const region = document.getElementById('region').value;
            if (projectId) config.project_id = projectId;
            if (region) config.region = region;
        }

        if (apiType === 'login_file') {
            const loginFilePath = document.getElementById('loginFilePath').value;
            if (loginFilePath) config.login_file_path = loginFilePath;
        }

        try {
            this.showLoading('Creating workspace...');
            
            const response = await fetch(`${this.baseUrl}/api/workspaces`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, config })
            });

            const data = await response.json();
            
            if (data.success) {
                await this.loadWorkspaces();
                this.hideCreateWorkspaceModal();
                this.showSuccess('Workspace created successfully!');
            } else {
                this.showError(data.error || 'Failed to create workspace');
            }
        } catch (error) {
            console.error('Error creating workspace:', error);
            this.showError('Failed to create workspace');
        } finally {
            this.hideLoading();
        }
    }

    async deleteWorkspace(workspaceId) {
        if (!confirm('Are you sure you want to delete this workspace?')) {
            return;
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/workspaces/${workspaceId}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            
            if (data.success) {
                await this.loadWorkspaces();
                if (this.currentWorkspace?.id === workspaceId) {
                    this.closeWorkspace();
                }
                this.showSuccess('Workspace deleted successfully!');
            } else {
                this.showError(data.error || 'Failed to delete workspace');
            }
        } catch (error) {
            console.error('Error deleting workspace:', error);
            this.showError('Failed to delete workspace');
        }
    }

    async openWorkspace(workspaceId) {
        try {
            const response = await fetch(`${this.baseUrl}/api/workspaces/${workspaceId}`);
            const data = await response.json();
            
            if (data.success) {
                this.currentWorkspace = data.data;
                this.showWorkspacePanel();
                this.updateWorkspacePanel();
            } else {
                this.showError(data.error || 'Failed to open workspace');
            }
        } catch (error) {
            console.error('Error opening workspace:', error);
            this.showError('Failed to open workspace');
        }
    }

    closeWorkspace() {
        this.currentWorkspace = null;
        this.hideWorkspacePanel();
    }

    showWorkspacePanel() {
        document.getElementById('activeWorkspacePanel').classList.remove('hidden');
        document.getElementById('commandInput').focus();
    }

    hideWorkspacePanel() {
        document.getElementById('activeWorkspacePanel').classList.add('hidden');
    }

    updateWorkspacePanel() {
        if (!this.currentWorkspace) return;

        document.getElementById('activeWorkspaceName').textContent = this.currentWorkspace.name;
        this.updateCommandHistory();
    }

    updateCommandHistory() {
        const historyContainer = document.getElementById('commandHistory');
        const history = this.currentWorkspace.command_history || [];

        if (history.length === 0) {
            historyContainer.innerHTML = '<p class="text-gray-500 text-sm">No commands executed yet.</p>';
            return;
        }

        historyContainer.innerHTML = history.slice(-10).reverse().map(entry => {
            const timestamp = new Date(entry.timestamp * 1000).toLocaleTimeString();
            const statusColor = entry.result?.status === 'success' ? 'text-green-600' : 'text-red-600';
            
            return `
                <div class="bg-gray-50 p-3 rounded-md text-sm">
                    <div class="flex justify-between items-center mb-1">
                        <code class="text-blue-600">${entry.command}</code>
                        <span class="text-xs text-gray-500">${timestamp}</span>
                    </div>
                    ${entry.result ? `
                        <div class="text-xs ${statusColor} flex items-center">
                            <i class="fas fa-circle mr-1" style="font-size: 6px;"></i>
                            ${entry.result.status} (${entry.result.execution_time}ms)
                            ${entry.auto_approved ? ' • Auto-approved' : ''}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    async executeCommand() {
        const command = document.getElementById('commandInput').value.trim();
        const autoApprove = document.getElementById('autoApproveCheck').checked;

        if (!command) {
            this.showError('Please enter a command');
            return;
        }

        if (!this.currentWorkspace) {
            this.showError('No workspace selected');
            return;
        }

        try {
            this.showLoading('Executing command...');
            this.clearCommandOutput();
            
            const response = await fetch(`${this.baseUrl}/api/workspaces/${this.currentWorkspace.id}/execute`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    command,
                    auto_approve: autoApprove
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.showCommandOutput(data.data);
                document.getElementById('commandInput').value = '';
                
                // Refresh workspace data to update history
                await this.openWorkspace(this.currentWorkspace.id);
            } else {
                this.showError(data.error || 'Command execution failed');
            }
        } catch (error) {
            console.error('Error executing command:', error);
            this.showError('Failed to execute command');
        } finally {
            this.hideLoading();
        }
    }

    showCommandOutput(result) {
        const outputElement = document.getElementById('commandOutput');
        const statusColor = result.status === 'success' ? 'text-green-400' : 'text-red-400';
        
        outputElement.innerHTML = `
            <div class="mb-2 ${statusColor}">
                <i class="fas fa-terminal mr-2"></i>
                Status: ${result.status} (${result.execution_time}ms)
            </div>
            <pre class="whitespace-pre-wrap">${result.output}</pre>
        `;
        
        outputElement.classList.remove('hidden');
    }

    clearCommandOutput() {
        document.getElementById('commandOutput').classList.add('hidden');
    }

    async explainCommand() {
        const command = document.getElementById('commandInput').value.trim();
        if (!command) {
            this.showError('Please enter a command to explain');
            return;
        }

        // This would call an API endpoint to explain the command
        this.showInfo(`Command explanation would be provided here for: ${command}`);
    }

    async suggestCommands() {
        // This would call an API endpoint to suggest commands
        this.showInfo('Command suggestions would be provided here based on context');
    }

    showLoading(message) {
        document.getElementById('loadingText').textContent = message;
        document.getElementById('loadingOverlay').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showInfo(message) {
        this.showNotification(message, 'info');
    }

    showNotification(message, type) {
        // Simple notification system
        const notification = document.createElement('div');
        const bgColor = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            info: 'bg-blue-500'
        }[type] || 'bg-gray-500';

        notification.className = `fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-opacity`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    updateUI() {
        // Update any UI elements that depend on the current state
        this.updateWorkspaceCount();
    }
}

// Initialize the app when the page loads
const app = new GeminiWebApp();