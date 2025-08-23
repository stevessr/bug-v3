# MCP Development Environment Usage Guide

## Quick Start

1. **Environment Setup** (One-time)
   ```bash
   ./scripts/setup-mcp.sh
   ```

2. **Validate Environment**
   ```bash
   ./scripts/mcp/validate-environment.sh
   ```

3. **Run Quick Tests**
   ```bash
   ./scripts/mcp/quick-test.sh
   ```

## Using the Comprehensive Agent

The main agent is configured in `.claude/agents/agent.md` with full MCP integration.

### Key Features

- **Context7**: Intelligent project understanding
- **Memory**: Long-term learning and pattern recognition
- **Node.js**: Complete JavaScript/TypeScript development
- **Playwright**: Browser automation and testing
- **Linux**: System operations and browser management
- **Fetch**: Network operations and API testing
- **Python**: Scripting and validation

### Example Workflows

#### Browser Extension Development
```bash
# Full development cycle
npm run build                    # Build extension
npm run test                     # Run all tests
./scripts/mcp/quick-test.sh     # Validate MCP environment
```

#### Testing Workflow
```bash
# Comprehensive testing
npm run test                     # Playwright tests
npm run build:prod              # Production build test
./scripts/mcp/validate-environment.sh  # Environment validation
```

#### Development Debugging
```bash
# Debug mode
npm run dev                      # Development build
# Use browser dev tools for debugging
# MCP servers provide intelligent assistance
```

## MCP Server Capabilities

### Context7 MCP
- Project structure analysis
- Context-aware suggestions  
- Workflow optimization
- Intelligent error recovery

### Memory MCP
- Persistent development memory
- Pattern recognition
- Solution similarity search
- Automated learning

### Node.js MCP
- Package management (npm/pnpm)
- Build system integration
- Test execution
- Code quality analysis

### Playwright MCP
- Multi-browser testing
- Extension testing
- Visual regression testing
- Accessibility validation

### Linux MCP
- Browser installation/configuration
- System monitoring
- Environment management
- Service operations

### Fetch MCP
- HTTP request testing
- API validation
- File operations
- Network monitoring

### Python MCP
- Script execution
- Data validation
- Automation tasks
- Testing support

## Configuration Files

- **Main Config**: `.claude/mcp/config.json`
- **Individual Servers**: `.claude/mcp/*.json`
- **Environment**: `.env.mcp`
- **Agent Definition**: `.claude/agents/agent.md`

## Best Practices

### Development Workflow
1. Always run environment validation before starting
2. Use context-aware development with MCP servers
3. Store significant decisions in memory
4. Run comprehensive tests regularly
5. Monitor system resources during development

### Memory Management
1. Tag memories for easy retrieval
2. Regular pattern analysis
3. Clean up outdated memories
4. Validate memory quality

### Testing Strategy
1. Multi-browser extension testing
2. Automated visual regression
3. API endpoint validation
4. Performance monitoring
5. Accessibility compliance

## Troubleshooting

### Common Issues

1. **Playwright Browser Installation Failed**
   ```bash
   # Manual installation
   npx playwright install chromium
   ```

2. **Python Virtual Environment Issues**
   ```bash
   # Recreate environment
   rm -rf venv
   python3 -m venv venv
   source venv/bin/activate
   pip install requests pytest jsonschema
   ```

3. **Node.js Dependency Issues**
   ```bash
   # Clean install
   rm -rf node_modules package-lock.json
   npm install
   ```

4. **MCP Server Configuration Issues**
   ```bash
   # Validate configurations
   ./scripts/mcp/validate-environment.sh
   ```

### Performance Optimization

1. **Memory Usage**
   - Monitor with `htop` or similar
   - Adjust `MCP_MEMORY_LIMIT` in `.env.mcp`

2. **Network Performance**
   - Check network connectivity
   - Validate API endpoints

3. **Build Performance**
   - Use production builds for testing
   - Monitor build times

## Advanced Usage

### Custom MCP Server Configuration
Edit `.claude/mcp/config.json` to adjust:
- Server priorities
- Startup order
- Resource limits
- Security settings

### Integration with External Tools
The MCP architecture supports:
- CI/CD pipeline integration
- IDE/Editor plugins
- External API services
- Custom automation scripts

### Monitoring and Observability
- Check logs in `.claude/mcp/logs/`
- Monitor system resources
- Track performance metrics
- Review error patterns

## Support and Documentation

- **Architecture**: `ARCHITECTURE.md`
- **Main Agent**: `.claude/agents/agent.md`
- **MCP Configs**: `.claude/mcp/`
- **Setup Scripts**: `scripts/mcp/`

For issues or questions, refer to the comprehensive documentation or run the validation scripts to diagnose problems.