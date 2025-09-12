# Enhanced Logging System

This document describes the comprehensive logging system implemented for debugging the enhanced message passing mechanism, with special focus on `emojiGroups-common` functionality.

## Log Levels

The logging system supports 5 different log levels (from least to most verbose):

### ERROR (0) - Critical Errors Only
- Only shows critical errors that prevent functionality
- Use for production builds where minimal logging is needed
- Example: `logger.error('Failed to initialize storage sync:', error)`

### WARN (1) - Warnings and Errors
- Shows warnings and errors
- Good for production with some debugging capability
- Example: `logger.warn('Connection recovery attempt failed')`

### INFO (2) - General Information (Default)
- Shows general information, warnings, and errors
- Default level for development builds
- Shows important events like initialization, sync events
- Example: `logger.info('✅ Enhanced communication service initialized')`

### DEBUG (3) - Detailed Debugging
- Shows detailed debugging information including message flow
- Best for development and troubleshooting
- Shows message sending/receiving, connection status changes
- Example: `logger.debug('Broadcasting message to all contexts:', messageType)`

### TRACE (4) - Very Detailed Tracing
- Shows very detailed information including message contents
- Use only when debugging specific issues
- Shows actual payload data, detailed timing information
- Example: `logger.trace('Message payload:', payload)`

## Setting Log Levels

### Compile-time Configuration

Set the log level during build:

```bash
# Build with DEBUG level logging
pnpm run build:debug

# Build with TRACE level logging (most verbose)
pnpm run build:trace

# Build for production with minimal logging
pnpm run build:production

# Default build (INFO level)
pnpm run build
```

### Environment Variable

You can also set the log level directly:

```bash
# Set log level for current session
export LOG_LEVEL=DEBUG
pnpm run build

# Or inline
LOG_LEVEL=TRACE pnpm run build
```

## Specialized Logging Methods

The logging system includes specialized methods for debugging message passing:

### Message Passing Logs
```typescript
logger.messageSent(type, payload, to)     // Log outgoing messages
logger.messageReceived(type, payload, from) // Log incoming messages
logger.messageAcknowledged(messageId, success) // Log acknowledgments
```

### Storage Operations
```typescript
logger.storageOperation(operation, key, success, data) // Log storage changes
```

### Connection Status
```typescript
logger.connectionStatus(connected, details) // Log connection changes
```

### Performance Metrics
```typescript
logger.performance(operation, duration, details) // Log timing information
```

### Emoji Operations (Critical for emojiGroups-common debugging)
```typescript
logger.emojiOperation(operation, emojiId, groupId, success) // General emoji ops
logger.commonEmojiOperation(operation, emojiCount, success) // Common emoji specific
```

### Synchronization Events
```typescript
logger.syncEvent(event, context, success) // Log sync events
```

## Context-Aware Logging

Each component has its own logger context:

- **Background**: `[Background]` - Background script operations
- **Popup**: `[Popup]` - Popup page operations  
- **Options**: `[Options]` - Options page operations
- **Content**: `[Content]` - Content script operations
- **Communication**: `[Communication]` - Message passing operations
- **Storage**: `[Storage]` - Storage operations

## Log Format

All logs include:
- **Timestamp**: `[HH:MM:SS]` - Time when log was created
- **Elapsed**: `[123ms]` - Time since logger was created
- **Context**: `[Background]` - Which component created the log
- **Level**: `[INFO]` - Log level
- **Message**: The actual log message

Example:
```
[14:30:25][1234ms][Background][INFO] 🚀 Enhanced background message hub initializing...
[14:30:25][1235ms][Communication:Popup][DEBUG] 📤 Sending message: app:settings-changed
[14:30:25][1236ms][Background][TRACE] 📨 Received message: app:settings-changed from Popup
```

## Debugging emojiGroups-common Issues

For debugging the critical `emojiGroups-common` functionality, use these specific log patterns:

### 1. Enable DEBUG or TRACE level
```bash
LOG_LEVEL=DEBUG pnpm run build
```

### 2. Look for these specific log messages:

**Common Emoji Operations:**
- `✅ Common emoji initial-load (X emojis)`
- `🔄 Common emoji update (X emojis)`
- `📤 Sending message: COMMON_EMOJI_UPDATED`
- `📨 Received message: app:common-group-changed`

**Storage Synchronization:**
- `Storage changes detected: [emojiGroups-common-emoji-group]`
- `✅ Storage change-detected: emojiGroups-common-emoji-group`

**Message Broadcasting:**
- `Broadcasting message: app:common-group-changed to all contexts`
- `📨 Common emoji group changed message received`

### 3. Check for Error Patterns:

**Connection Issues:**
- `🔴 Disconnected: Connection lost`
- `❌ Message acknowledgment timeout`
- `⚠️ Connection recovery attempt failed`

**Storage Issues:**
- `❌ Storage change-detected failed`
- `Failed to broadcast to extension contexts`

**Synchronization Issues:**
- `⚠️ Sync common-emoji-update failed`
- `❌ Common emoji update failed`

## Performance Monitoring

The logging system also tracks performance:

```typescript
// Automatic performance logging for operations > 100ms
logger.performance('storage-load', 150, { keys: ['emojiGroups-common-emoji-group'] })
logger.performance('message-broadcast', 75, { recipients: 3 })
```

## Best Practices

1. **Development**: Use `DEBUG` level for general development
2. **Troubleshooting**: Use `TRACE` level when debugging specific issues
3. **Production**: Use `WARN` or `ERROR` level for production builds
4. **Testing**: Use `INFO` level for automated testing

## Viewing Logs

### Browser DevTools
1. Open Chrome DevTools (F12)
2. Go to Console tab
3. Filter by context: `[Background]`, `[Popup]`, etc.
4. Look for emoji-specific logs: `common emoji`, `COMMON_EMOJI_UPDATED`

### Extension Pages
- **Background logs**: Chrome DevTools → Extensions → Inspect background page
- **Popup logs**: Right-click popup → Inspect
- **Options logs**: Right-click options page → Inspect
- **Content logs**: Regular page DevTools console

## Troubleshooting Common Issues

### emojiGroups-common not syncing:
1. Set `LOG_LEVEL=DEBUG`
2. Look for `COMMON_EMOJI_UPDATED` messages
3. Check storage change detection logs
4. Verify message acknowledgments

### Messages not reaching all contexts:
1. Set `LOG_LEVEL=TRACE`
2. Check broadcast logs for each context
3. Look for connection status changes
4. Verify message acknowledgments

### Performance issues:
1. Check performance logs for slow operations
2. Look for timeout errors
3. Monitor connection recovery attempts
