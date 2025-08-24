#!/bin/bash

# Build and run the Gemini Web Service
echo "🚀 Starting Gemini Web Service..."

# Check if we're in the right directory
if [ ! -f "Cargo.toml" ]; then
    echo "❌ Please run this script from the gemini-web-service directory"
    exit 1
fi

# Build the project
echo "🔨 Building Rust project..."
cargo build --release

# Check if build was successful
if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build successful!"

# Run the service
echo "🌐 Starting web service on http://127.0.0.1:8080"
echo "📋 Available endpoints:"
echo "   - GET  /health                 - Health check"
echo "   - GET  /                       - Web interface"
echo "   - GET  /api/workspaces         - List workspaces"
echo "   - POST /api/workspaces         - Create workspace"
echo "   - GET  /api/workspaces/{id}    - Get workspace details"
echo "   - DELETE /api/workspaces/{id}  - Delete workspace"
echo "   - POST /api/workspaces/{id}/execute - Execute command"
echo ""
echo "🛑 Press Ctrl+C to stop the service"

cargo run --release