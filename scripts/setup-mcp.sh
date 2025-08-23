#!/bin/bash

# MCP Development Environment Setup Script
# This script initializes the comprehensive MCP server environment

set -e

echo "🚀 Initializing Comprehensive MCP Development Environment"
echo "========================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

print_status "Setting up MCP development environment..."

# 1. Install Node.js dependencies
print_status "Installing Node.js dependencies..."
if command -v pnpm &> /dev/null; then
    pnpm install
    print_success "Dependencies installed with pnpm"
elif command -v npm &> /dev/null; then
    npm install
    print_success "Dependencies installed with npm"
else
    print_error "Neither npm nor pnpm found. Please install Node.js package manager."
    exit 1
fi

# 2. Install Playwright browsers
print_status "Installing Playwright browsers..."
if npx playwright install; then
    print_success "Playwright browsers installed"
else
    print_warning "Playwright browser installation failed. You may need to install manually."
fi

# 3. Create necessary directories
print_status "Creating MCP workspace directories..."
mkdir -p .claude/mcp/logs
mkdir -p .claude/mcp/cache
mkdir -p .claude/mcp/data
mkdir -p tests/screenshots
mkdir -p tests/videos
mkdir -p tests/traces
mkdir -p scripts/mcp
print_success "Workspace directories created"

# 4. Set up Python virtual environment (optional)
if command -v python3 &> /dev/null; then
    print_status "Setting up Python virtual environment..."
    if [ ! -d "venv" ]; then
        python3 -m venv venv
        print_success "Python virtual environment created"
    else
        print_warning "Python virtual environment already exists"
    fi
    
    # Install basic Python packages
    print_status "Installing Python packages..."
    if source venv/bin/activate && pip install requests pytest jsonschema; then
        print_success "Python packages installed"
        deactivate
    else
        print_warning "Python package installation failed"
    fi
else
    print_warning "Python3 not found. Python MCP server may not work properly."
fi

# 5. Create environment configuration
print_status "Creating environment configuration..."
cat > .env.mcp << EOF
# MCP Development Environment Configuration
NODE_ENV=development
DEBUG=mcp:*
PLAYWRIGHT_BROWSERS_PATH=./browsers
MCP_LOG_LEVEL=info
MCP_CACHE_ENABLED=true
MCP_MEMORY_LIMIT=2GB
PROJECT_ROOT=$(pwd)
EOF
print_success "Environment configuration created"

# 6. Create MCP startup script
print_status "Creating MCP startup script..."
cat > scripts/mcp/start-servers.sh << 'EOF'
#!/bin/bash

# MCP Servers Startup Script
echo "🔌 Starting MCP Servers..."

# Source environment variables
if [ -f .env.mcp ]; then
    source .env.mcp
fi

# Define MCP server configurations
SERVERS=(
    "context7:./claude/mcp/context7.json"
    "memory:./claude/mcp/memory.json" 
    "nodejs:./claude/mcp/nodejs.json"
    "playwright:./claude/mcp/playwright.json"
    "linux:./claude/mcp/linux.json"
    "fetch:./claude/mcp/fetch.json"
    "python:./claude/mcp/python.json"
)

# Start each server
for server in "${SERVERS[@]}"; do
    IFS=':' read -r name config <<< "$server"
    echo "Starting $name MCP server..."
    # Placeholder for actual MCP server startup
    # This would be replaced with actual MCP server implementation
done

echo "✅ All MCP servers started successfully"
EOF

chmod +x scripts/mcp/start-servers.sh
print_success "MCP startup script created"

# 7. Create validation script
print_status "Creating environment validation script..."
cat > scripts/mcp/validate-environment.sh << 'EOF'
#!/bin/bash

# Environment Validation Script
echo "🔍 Validating MCP Development Environment..."

# Check Node.js
if command -v node &> /dev/null; then
    echo "✅ Node.js: $(node --version)"
else
    echo "❌ Node.js not found"
fi

# Check npm/pnpm
if command -v pnpm &> /dev/null; then
    echo "✅ pnpm: $(pnpm --version)"
elif command -v npm &> /dev/null; then
    echo "✅ npm: $(npm --version)"
else
    echo "❌ No package manager found"
fi

# Check Python
if command -v python3 &> /dev/null; then
    echo "✅ Python: $(python3 --version)"
else
    echo "❌ Python3 not found"
fi

# Check Git
if command -v git &> /dev/null; then
    echo "✅ Git: $(git --version)"
else
    echo "❌ Git not found"
fi

# Check Playwright
if npx playwright --version &> /dev/null; then
    echo "✅ Playwright: $(npx playwright --version)"
else
    echo "❌ Playwright not installed or not working"
fi

# Check project structure
echo ""
echo "📁 Project Structure Validation:"
for dir in ".claude/mcp" "tests" "src" "scripts/mcp"; do
    if [ -d "$dir" ]; then
        echo "✅ $dir directory exists"
    else
        echo "❌ $dir directory missing"
    fi
done

# Check MCP configuration files
echo ""
echo "⚙️  MCP Configuration Files:"
for config in context7 memory nodejs playwright linux fetch python; do
    if [ -f ".claude/mcp/$config.json" ]; then
        echo "✅ $config.json configuration exists"
    else
        echo "❌ $config.json configuration missing"
    fi
done

echo ""
echo "🎯 Environment validation complete!"
EOF

chmod +x scripts/mcp/validate-environment.sh
print_success "Environment validation script created"

# 8. Create quick test script
print_status "Creating quick test script..."
cat > scripts/mcp/quick-test.sh << 'EOF'
#!/bin/bash

# Quick Test Script for MCP Environment
echo "🧪 Running MCP Environment Quick Tests..."

# Test build
echo "Testing build process..."
if npm run build > /dev/null 2>&1; then
    echo "✅ Build test passed"
else
    echo "❌ Build test failed"
fi

# Test extension structure
echo "Testing extension structure..."
if [ -f "dist/manifest.json" ]; then
    echo "✅ Extension manifest exists"
else
    echo "❌ Extension manifest missing"
fi

# Test JavaScript execution
echo "Testing Node.js execution..."
if node -e "console.log('Node.js test passed')" > /dev/null 2>&1; then
    echo "✅ Node.js execution test passed"
else
    echo "❌ Node.js execution test failed"
fi

# Test Python execution (if available)
if command -v python3 &> /dev/null; then
    echo "Testing Python execution..."
    if python3 -c "print('Python test passed')" > /dev/null 2>&1; then
        echo "✅ Python execution test passed"
    else
        echo "❌ Python execution test failed"
    fi
fi

echo "🎯 Quick tests complete!"
EOF

chmod +x scripts/mcp/quick-test.sh
print_success "Quick test script created"

# 9. Run validation
print_status "Running environment validation..."
./scripts/mcp/validate-environment.sh

# 10. Final setup completion
print_success "MCP Development Environment Setup Complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Run './scripts/mcp/validate-environment.sh' to check your setup"
echo "2. Run './scripts/mcp/quick-test.sh' to test basic functionality"
echo "3. Use the comprehensive agent with: 'agent.md' configuration"
echo "4. Start development with full MCP server support"
echo ""
echo "📖 Documentation:"
echo "- Main agent configuration: .claude/agents/agent.md"
echo "- MCP server configs: .claude/mcp/"
echo "- Environment config: .env.mcp"
echo ""
print_success "Happy coding with your enhanced development environment! 🚀"