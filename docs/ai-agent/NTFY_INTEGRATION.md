# ntfy.sh Integration Guide

## Overview

The AI Agent system now includes built-in support for [ntfy.sh](https://ntfy.sh), a simple HTTP-based pub-sub notification service. This allows agents to send notifications to external devices, services, or monitoring systems during task execution.

## Features

- ✅ Send notifications to ntfy.sh or self-hosted ntfy servers
- ✅ Rich notification formatting (title, priority, tags, emojis)
- ✅ Click actions and attachments
- ✅ Action buttons for interactive notifications
- ✅ Authentication support (username/password or bearer token)
- ✅ Custom server deployment support
- ✅ No external dependencies (uses native fetch API)

## Quick Start

### Basic Configuration

```typescript
import { runAgent, type AgentConfig } from '@/services/aiAgentService'

const config: AgentConfig = {
  apiKey: 'your-anthropic-api-key',
  baseUrl: 'https://api.anthropic.com',
  model: 'claude-opus-4-5-20251101',

  // ntfy configuration
  ntfy: {
    topic: 'my-agent-notifications'  // Default topic
  }
}
```

### Sending a Simple Notification

```typescript
const task = `
Complete the data processing task.
When finished, send a notification via ntfy with the message "Data processing complete!"
`

await runAgent(config, task, (status) => console.log(status))
```

The AI agent will automatically use the `send_ntfy_notification` tool:

```typescript
send_ntfy_notification({
  message: "Data processing complete!",
  title: "Task Completed",
  priority: 4,
  tags: "white_check_mark,success"
})
```

## Configuration Options

### NtfyConfig Interface

```typescript
interface NtfyConfig {
  server?: string      // Custom ntfy server URL (default: https://ntfy.sh)
  topic?: string       // Default topic to publish to
  username?: string    // Username for authentication
  password?: string    // Password for authentication
  token?: string       // Bearer token (alternative to username/password)
}
```

### Examples

#### Using Default ntfy.sh Server

```typescript
const config: AgentConfig = {
  // ... other config
  ntfy: {
    topic: 'my-notifications'
  }
}
```

#### Using Self-Hosted ntfy Server

```typescript
const config: AgentConfig = {
  // ... other config
  ntfy: {
    server: 'https://ntfy.example.com',
    topic: 'agent-alerts',
    username: 'admin',
    password: 'secretpassword'
  }
}
```

#### Using Bearer Token Authentication

```typescript
const config: AgentConfig = {
  // ... other config
  ntfy: {
    server: 'https://ntfy.example.com',
    topic: 'secure-notifications',
    token: 'tk_AgQdq7mVBoFD37zQVN23WWqn'
  }
}
```

## Tool Usage

### send_ntfy_notification Tool

The AI agent has access to the `send_ntfy_notification` tool with the following parameters:

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message` | string | Yes | The notification message body |
| `topic` | string | No | Topic to publish to (overrides config default) |
| `title` | string | No | Notification title |
| `priority` | number | No | Priority level (1-5, default: 3) |
| `tags` | string | No | Comma-separated tags/emojis |
| `click_url` | string | No | URL to open when notification is clicked |
| `attach_url` | string | No | URL of image/file to attach |
| `actions` | string | No | JSON array of action buttons |

#### Priority Levels

- `1` - Minimum priority
- `2` - Low priority
- `3` - Default priority
- `4` - High priority
- `5` - Urgent/Maximum priority (triggers high-priority notification sound)

### Examples

#### Simple Text Notification

```typescript
send_ntfy_notification({
  message: "Backup completed successfully"
})
```

#### Notification with Title and Priority

```typescript
send_ntfy_notification({
  message: "Database backup completed in 5 minutes",
  title: "Backup Status",
  priority: 4,
  tags: "floppy_disk,white_check_mark"
})
```

#### Notification with Click Action

```typescript
send_ntfy_notification({
  message: "New report available",
  title: "Report Ready",
  click_url: "https://example.com/reports/2026-01-11",
  tags: "chart_with_upwards_trend"
})
```

#### Notification with Image Attachment

```typescript
send_ntfy_notification({
  message: "Screenshot captured",
  title: "Test Result",
  attach_url: "https://example.com/screenshots/test-result.png",
  tags: "camera"
})
```

#### Notification with Action Buttons

```typescript
send_ntfy_notification({
  message: "Deployment ready for approval",
  title: "Approval Required",
  priority: 5,
  tags: "warning",
  actions: JSON.stringify([
    {
      action: "view",
      label: "Review Changes",
      url: "https://github.com/org/repo/pull/123"
    },
    {
      action: "http",
      label: "Approve",
      url: "https://api.example.com/approve",
      method: "POST"
    }
  ])
})
```

## Common Use Cases

### 1. Task Completion Notifications

```typescript
const task = `
Process all pending orders.
Send a notification when complete with:
- Title: "Order Processing Complete"
- Message: Total number of orders processed
- Priority: High
- Tags: shopping_cart, white_check_mark
`
```

### 2. Error Alerts

```typescript
const task = `
Monitor the application logs for errors.
If any errors are found, send an urgent notification with:
- Title: "Error Detected"
- Message: Error details
- Priority: 5 (urgent)
- Tags: warning, skull
- Click URL: Link to error dashboard
`
```

### 3. Progress Updates

```typescript
const task = `
Download and process 100 files.
Send notifications every 25 files:
- "25% complete"
- "50% complete"
- "75% complete"
- "100% complete - All files processed"
Use priority 3 for progress, priority 4 for completion.
`
```

### 4. Multi-Stage Workflow Notifications

```typescript
const task = `
Run the deployment pipeline:
1. Build application → notify "Build started"
2. Run tests → notify "Tests running"
3. Deploy to staging → notify "Deployed to staging" with link
4. Run smoke tests → notify "Smoke tests complete"
5. Final notification with all results
`
```

### 5. Scheduled Monitoring

```typescript
const task = `
Check website uptime every 5 minutes for 1 hour.
Send notification only if:
- Response time > 2 seconds (priority: high, tags: warning)
- Server returns error (priority: urgent, tags: skull, fire)
- All checks pass after 1 hour (priority: default, tags: white_check_mark)
`
```

## Advanced Features

### Using Different Topics

You can override the default topic for specific notifications:

```typescript
send_ntfy_notification({
  message: "Critical alert",
  topic: "urgent-alerts",  // Different topic
  priority: 5
})

send_ntfy_notification({
  message: "Info message",
  topic: "info-channel",   // Another topic
  priority: 2
})
```

### Emoji Tags

ntfy supports emoji shortcodes for tags:

```typescript
send_ntfy_notification({
  message: "Deployment successful",
  tags: "rocket,sparkles,white_check_mark"
})

send_ntfy_notification({
  message: "Error occurred",
  tags: "warning,skull,fire"
})

send_ntfy_notification({
  message: "Data synced",
  tags: "floppy_disk,arrows_counterclockwise"
})
```

See [ntfy emoji list](https://docs.ntfy.sh/emojis/) for all available emojis.

### Interactive Actions

Create actionable notifications:

```typescript
send_ntfy_notification({
  message: "Pull request ready for review",
  title: "PR #123",
  actions: JSON.stringify([
    {
      action: "view",
      label: "Open PR",
      url: "https://github.com/org/repo/pull/123"
    },
    {
      action: "http",
      label: "Approve",
      url: "https://api.github.com/repos/org/repo/pulls/123/reviews",
      method: "POST",
      headers: {
        "Authorization": "Bearer ${GITHUB_TOKEN}"
      },
      body: '{"event": "APPROVE"}'
    }
  ])
})
```

## Subscribing to Notifications

### Web Browser

Simply visit: `https://ntfy.sh/your-topic-name`

### Mobile Apps

1. Download ntfy app:
   - [Android](https://play.google.com/store/apps/details?id=io.heckel.ntfy)
   - [iOS](https://apps.apple.com/us/app/ntfy/id1625396347)

2. Subscribe to your topic: `your-topic-name`

### CLI

```bash
# Subscribe and print notifications
ntfy subscribe your-topic-name

# Subscribe with custom server
ntfy subscribe --from-config ntfy.example.com/your-topic
```

### cURL

```bash
# Subscribe and stream notifications
curl -s ntfy.sh/your-topic-name/sse
```

## Self-Hosting ntfy

### Quick Setup with Docker

```bash
docker run -d \
  --name ntfy \
  -p 80:80 \
  -v /var/cache/ntfy:/var/cache/ntfy \
  binwiederhier/ntfy \
  serve --cache-file /var/cache/ntfy/cache.db
```

### Configuration File

`/etc/ntfy/server.yml`:

```yaml
base-url: "https://ntfy.example.com"
listen-http: ":80"
cache-file: "/var/cache/ntfy/cache.db"
auth-default-access: "deny-all"

# Enable authentication
auth-file: "/var/lib/ntfy/user.db"
```

### Create User

```bash
ntfy user add --role=admin myuser
```

### Agent Configuration

```typescript
const config: AgentConfig = {
  // ... other config
  ntfy: {
    server: 'https://ntfy.example.com',
    topic: 'agent-notifications',
    username: 'myuser',
    password: 'mypassword'
  }
}
```

## Best Practices

### 1. Topic Naming

Use descriptive, hierarchical topics:

```
✅ Good:
- agent-tasks-production
- monitoring-alerts-critical
- backups-daily-status

❌ Avoid:
- test
- notifications
- alerts
```

### 2. Priority Usage

Reserve urgent priority (5) for critical alerts:

```typescript
// Critical issues
priority: 5  // System down, data loss, security breach

// Important updates
priority: 4  // Deployment complete, high-value events

// Normal notifications
priority: 3  // Regular status updates

// Low priority
priority: 2  // Verbose logs, debug info

// Minimum
priority: 1  // Rarely used
```

### 3. Message Clarity

Write clear, actionable messages:

```typescript
✅ Good:
send_ntfy_notification({
  message: "Backup completed: 1.2GB uploaded in 3m 45s",
  title: "Daily Backup",
  tags: "floppy_disk,white_check_mark"
})

❌ Avoid:
send_ntfy_notification({
  message: "Done"
})
```

### 4. Error Handling

The agent will automatically handle errors, but you can guide it:

```typescript
const task = `
Send notification "Task started".
Process data (this might fail).
If successful: send "Success" with priority 4
If failed: send "Error: <details>" with priority 5 and tags "warning,skull"
`
```

### 5. Rate Limiting

Be mindful of notification frequency:

```typescript
const task = `
Process 1000 items.
Send notification every 100 items (not every single item).
Final notification with summary.
`
```

## Troubleshooting

### Issue: Topic not specified

**Error:** `Error: topic is required`

**Solution:** Provide topic in config or tool parameter:

```typescript
const config: AgentConfig = {
  ntfy: {
    topic: 'my-default-topic'
  }
}

// OR in tool call:
send_ntfy_notification({
  message: "Test",
  topic: "specific-topic"
})
```

### Issue: Authentication failed

**Error:** `ntfy notification failed: 401 Unauthorized`

**Solution:** Verify credentials:

```typescript
const config: AgentConfig = {
  ntfy: {
    server: 'https://ntfy.example.com',
    username: 'correct-username',
    password: 'correct-password'
  }
}
```

### Issue: Server not reachable

**Error:** `ntfy notification error: fetch failed`

**Solution:** Check server URL and network:

```bash
# Test server connectivity
curl https://ntfy.example.com/health

# Check DNS resolution
nslookup ntfy.example.com
```

### Issue: Actions not working

**Problem:** Action buttons don't appear

**Solution:** Ensure actions is valid JSON string:

```typescript
// ✅ Correct
actions: JSON.stringify([{ action: "view", label: "Open", url: "https://..." }])

// ❌ Wrong
actions: "[{action: 'view', label: 'Open'}]"  // Invalid JSON
```

## Examples Gallery

### Startup Notification

```typescript
send_ntfy_notification({
  message: "AI Agent started and ready to process tasks",
  title: "Agent Online",
  priority: 3,
  tags: "robot,white_check_mark"
})
```

### Progress Bar Simulation

```typescript
// 0%
send_ntfy_notification({ message: "▱▱▱▱▱▱▱▱▱▱ 0%", title: "Processing" })

// 50%
send_ntfy_notification({ message: "▰▰▰▰▰▱▱▱▱▱ 50%", title: "Processing" })

// 100%
send_ntfy_notification({ message: "▰▰▰▰▰▰▰▰▰▰ 100%", title: "Complete!" })
```

### System Status Dashboard

```typescript
send_ntfy_notification({
  message: `CPU: 45%
Memory: 2.1GB / 8GB
Disk: 120GB / 500GB
Network: 15 Mbps`,
  title: "System Status",
  priority: 2,
  tags: "chart_with_upwards_trend"
})
```

### Multi-Step Workflow

```typescript
const task = `
Complete the CI/CD pipeline:

1. Send: "🔨 Building application..."
2. Build the app
3. Send: "✅ Build complete"
4. Send: "🧪 Running tests..."
5. Run tests
6. Send: "✅ All 127 tests passed"
7. Send: "🚀 Deploying to production..."
8. Deploy
9. Send final notification with:
   - Title: "Deployment Complete"
   - Message: Build number and deployment time
   - Priority: High
   - Click URL: Production URL
   - Actions: ["View Site", "View Logs"]
`
```

## Integration with Other Tools

### With Slack/Discord

Use ntfy webhooks to forward to other platforms:

1. Create ntfy webhook in Slack/Discord
2. Configure ntfy topic to forward
3. Agent notifications appear in both places

### With Monitoring Systems

Forward urgent notifications to PagerDuty, Opsgenie, etc.:

```typescript
send_ntfy_notification({
  message: "Critical: Database connection lost",
  topic: "pagerduty-alerts",  // Forwarded to PagerDuty
  priority: 5,
  tags: "fire,warning"
})
```

### With Automation Platforms

Trigger n8n, Zapier, or Make.com workflows:

```typescript
send_ntfy_notification({
  message: JSON.stringify({ event: "task_complete", data: {...} }),
  topic: "automation-trigger",
  priority: 4
})
```

## API Reference

See [src/services/aiAgentService.ts:1223-1269](src/services/aiAgentService.ts#L1223-L1269) for tool definition.

See [src/services/aiAgentService.ts:2546-2632](src/services/aiAgentService.ts#L2546-L2632) for implementation.

## Resources

- [ntfy.sh Official Documentation](https://docs.ntfy.sh/)
- [ntfy.sh Public Server](https://ntfy.sh)
- [ntfy GitHub Repository](https://github.com/binwiederhier/ntfy)
- [Emoji Shortcodes List](https://docs.ntfy.sh/emojis/)

---

**Last Updated:** 2026-01-11
**Version:** 1.0.0
**Author:** AI Agent Development Team
