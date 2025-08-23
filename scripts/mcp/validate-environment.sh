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
