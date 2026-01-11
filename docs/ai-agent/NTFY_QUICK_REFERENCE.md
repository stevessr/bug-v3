# ntfy.sh Quick Reference

## 🚀 Quick Start

### Basic Configuration

```typescript
const config: AgentConfig = {
  apiKey: 'your-api-key',
  model: 'claude-opus-4-5-20251101',

  // ntfy setup
  ntfy: {
    topic: 'my-notifications'  // Required
  }
}
```

### Send Your First Notification

```typescript
const task = `
Process the data files.
When complete, send a notification: "Processing complete!"
`

await runAgent(config, task, onStatus)
```

## 📋 Common Commands

### Simple Notification

```typescript
send_ntfy_notification({
  message: "Task completed successfully"
})
```

### Notification with Title & Priority

```typescript
send_ntfy_notification({
  message: "Backup finished in 5 minutes",
  title: "Backup Status",
  priority: 4,
  tags: "floppy_disk,white_check_mark"
})
```

### Urgent Alert

```typescript
send_ntfy_notification({
  message: "Critical error detected!",
  title: "ERROR",
  priority: 5,
  tags: "warning,skull,fire"
})
```

### Notification with Click Action

```typescript
send_ntfy_notification({
  message: "Report ready for review",
  title: "New Report",
  click_url: "https://example.com/reports/latest",
  tags: "chart_with_upwards_trend"
})
```

### Notification with Image

```typescript
send_ntfy_notification({
  message: "Screenshot captured",
  attach_url: "https://example.com/screenshot.png",
  tags: "camera"
})
```

### Interactive Notification

```typescript
send_ntfy_notification({
  message: "Deployment ready",
  title: "Approval Required",
  priority: 5,
  actions: JSON.stringify([
    { action: "view", label: "Review", url: "https://..." },
    { action: "http", label: "Approve", url: "https://api.../approve", method: "POST" }
  ])
})
```

## ⚙️ Configuration Options

### Default ntfy.sh

```typescript
ntfy: {
  topic: 'my-topic'
}
```

### Self-Hosted Server

```typescript
ntfy: {
  server: 'https://ntfy.example.com',
  topic: 'alerts'
}
```

### With Authentication

```typescript
ntfy: {
  server: 'https://ntfy.example.com',
  topic: 'secure-topic',
  username: 'admin',
  password: 'secret123'
}
```

### Bearer Token Auth

```typescript
ntfy: {
  server: 'https://ntfy.example.com',
  topic: 'api-notifications',
  token: 'tk_AgQdq7mVBoFD37zQVN23WWqn'
}
```

## 🎯 Priority Levels

| Level | Name | Use Case |
|-------|------|----------|
| 1 | Min | Debug info, verbose logs |
| 2 | Low | Low-priority updates |
| 3 | Default | Normal notifications |
| 4 | High | Important events |
| 5 | Urgent | Critical alerts, errors |

## 🏷️ Popular Emoji Tags

### Status

- ✅ Success: `white_check_mark,sparkles`
- ⚠️ Warning: `warning,yellow_heart`
- 🔥 Critical: `fire,skull,warning`
- 📊 Analytics: `chart_with_upwards_trend`
- 🎯 Complete: `dart,white_check_mark`

### Activities

- 🚀 Deploy: `rocket,sparkles`
- 🔨 Build: `hammer,construction`
- 🧪 Test: `test_tube,mag`
- 💾 Backup: `floppy_disk,arrows_counterclockwise`
- 📦 Package: `package,gift`

### System

- 🖥️ Server: `computer,electric_plug`
- 🔧 Maintenance: `wrench,gear`
- 📈 Performance: `chart_with_upwards_trend,zap`
- 🔒 Security: `lock,shield`
- 🌐 Network: `globe_with_meridians,satellite`

## 📱 Subscribe to Notifications

### Web

Visit: `https://ntfy.sh/your-topic-name`

### Mobile

1. Download ntfy app (iOS/Android)
2. Subscribe to: `your-topic-name`

### CLI

```bash
ntfy subscribe your-topic-name
```

### cURL

```bash
curl -s ntfy.sh/your-topic-name/sse
```

## 💡 Usage Patterns

### Task Completion

```typescript
const task = `
Process all orders.
Send notification when done:
- Title: "Order Processing"
- Message: Number of orders processed
- Priority: High
- Tags: shopping_cart, white_check_mark
`
```

### Error Monitoring

```typescript
const task = `
Monitor logs for errors.
If error found, send URGENT notification:
- Title: "Error Detected"
- Message: Error details
- Priority: 5
- Tags: warning, fire
`
```

### Progress Updates

```typescript
const task = `
Process 100 files.
Send update every 25 files:
- "25% complete ▰▰▱▱▱▱▱▱"
- "50% complete ▰▰▰▰▱▱▱▱"
- "75% complete ▰▰▰▰▰▰▱▱"
- "100% complete ▰▰▰▰▰▰▰▰"
`
```

### Multi-Stage Pipeline

```typescript
const task = `
Run CI/CD pipeline:
1. Notify: "🔨 Building..."
2. Build app
3. Notify: "✅ Build complete"
4. Notify: "🧪 Testing..."
5. Run tests
6. Notify: "✅ Tests passed"
7. Notify: "🚀 Deploying..."
8. Deploy
9. Final notification with summary
`
```

## 🔧 Troubleshooting

### No Topic Specified

```typescript
// ❌ Error: topic is required
ntfy: {}

// ✅ Fixed
ntfy: { topic: 'my-topic' }
```

### Authentication Failed

```typescript
// ❌ 401 Unauthorized
ntfy: {
  server: 'https://ntfy.example.com',
  topic: 'secure'
}

// ✅ Fixed
ntfy: {
  server: 'https://ntfy.example.com',
  topic: 'secure',
  username: 'admin',
  password: 'password'
}
```

### Actions Not Showing

```typescript
// ❌ Invalid JSON
actions: "[{action: 'view'}]"

// ✅ Valid JSON
actions: JSON.stringify([{ action: "view", label: "Open", url: "..." }])
```

## 🎨 Templates

### Startup Notification

```typescript
send_ntfy_notification({
  message: "AI Agent started and ready",
  title: "Agent Online",
  tags: "robot,white_check_mark"
})
```

### Error Alert Template

```typescript
send_ntfy_notification({
  message: `Error: ${errorMessage}\nLocation: ${file}:${line}`,
  title: "Application Error",
  priority: 5,
  tags: "warning,skull",
  click_url: errorDashboardUrl
})
```

### Success Template

```typescript
send_ntfy_notification({
  message: `Processed ${count} items in ${duration}`,
  title: "Task Complete",
  priority: 4,
  tags: "white_check_mark,sparkles"
})
```

### Status Dashboard

```typescript
send_ntfy_notification({
  message: `CPU: ${cpu}%\nMemory: ${mem}GB\nDisk: ${disk}GB`,
  title: "System Status",
  priority: 2,
  tags: "chart_with_upwards_trend"
})
```

## 📊 Best Practices

### ✅ DO

- Use descriptive topics: `agent-prod-alerts`, `backup-status`
- Reserve priority 5 for critical alerts only
- Include relevant context in messages
- Use emoji tags for visual categorization
- Test notifications before production use

### ❌ DON'T

- Send notifications for every minor event
- Use generic topics: `test`, `notifications`
- Spam urgent priority notifications
- Forget to configure authentication for private topics
- Expose sensitive data in messages

## 📚 Resources

- [Full Documentation](./NTFY_INTEGRATION.md)
- [ntfy.sh Website](https://ntfy.sh)
- [ntfy Documentation](https://docs.ntfy.sh)
- [Emoji List](https://docs.ntfy.sh/emojis/)

## 🔗 Related

- [AI Agent Parallel Execution](./PARALLEL_SUBAGENT_OPTIMIZATION.md)
- [Quick Reference](./QUICK_REFERENCE.md)

---

**Version:** 1.0.0
**Last Updated:** 2026-01-11
