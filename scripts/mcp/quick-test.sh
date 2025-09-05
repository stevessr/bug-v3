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
