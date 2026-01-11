# Parallel Subagent Quick Reference

## 🚀 Quick Start

### Spawn Multiple Subagents at Once

```typescript
// ✅ RECOMMENDED: Spawn all at once
spawn_multiple_subagents([
  "Task 1: Fetch user data",
  "Task 2: Fetch analytics",
  "Task 3: Fetch settings"
])

// ❌ AVOID: Spawning one by one
spawn_subagent("Task 1: Fetch user data")
spawn_subagent("Task 2: Fetch analytics")
spawn_subagent("Task 3: Fetch settings")
```

### Wait for Results

```typescript
// Basic wait (all subagents)
wait_for_subagents()

// Wait with timeout (2 minutes)
wait_for_subagents({ timeout_ms: 120000 })

// Wait for specific subagents
wait_for_subagents({ subagent_ids: "subagent_1,subagent_2" })
```

## 📋 Common Patterns

### Pattern 1: Parallel Data Collection

```typescript
spawn_multiple_subagents([
  "Collect data from API endpoint /users",
  "Collect data from API endpoint /products",
  "Collect data from API endpoint /orders"
])
wait_for_subagents({ timeout_ms: 60000 })
```

**Result:** 3x faster than sequential collection

### Pattern 2: Multi-Browser Testing

```typescript
spawn_multiple_subagents([
  "Test checkout flow in Chrome",
  "Test checkout flow in Firefox",
  "Test checkout flow in Safari"
])
wait_for_subagents({ timeout_ms: 300000 })
```

**Result:** All browsers tested simultaneously

### Pattern 3: Independent Validation

```typescript
spawn_multiple_subagents([
  "Validate all email inputs on the page",
  "Check for broken images",
  "Verify form accessibility",
  "Test responsive layout"
])
wait_for_subagents()
```

**Result:** All validations run in parallel

## ⚙️ Configuration

### Basic Config

```typescript
const config: AgentConfig = {
  apiKey: 'your-api-key',
  baseUrl: 'https://api.anthropic.com',
  model: 'claude-opus-4-5-20251101',

  // Parallel execution settings
  maxConcurrentSubagents: 5,    // Max simultaneous subagents
  subagentTimeout: 120000        // 2 minutes per subagent
}
```

### Advanced Config

```typescript
const config: AgentConfig = {
  // ... basic config

  maxConcurrentSubagents: 10,   // High-performance system
  subagentTimeout: 300000,       // 5 minutes for complex tasks

  // Optional: Enable specific tools only
  enabledBuiltinTools: [
    'screenshot',
    'navigate',
    'click',
    'spawn_subagent',
    'spawn_multiple_subagents',
    'wait_for_subagents'
  ]
}
```

## 💡 Performance Tips

### ✅ DO

- **Spawn all subagents at once** using `spawn_multiple_subagents`
- **Set appropriate timeouts** to prevent hangs
- **Use parallel thinking**: Ask "Can these run simultaneously?"
- **Let failures be isolated**: Use `Promise.allSettled` behavior

### ❌ DON'T

- **Spawn sequentially** when tasks are independent
- **Wait without timeout** for unreliable operations
- **Block on failures**: Failed subagents shouldn't stop others
- **Spawn too many**: Respect `maxConcurrentSubagents` limit

## 🎯 Performance Gains

| Scenario | Before | After | Speedup |
|----------|--------|-------|---------|
| 3 API calls | 90s | 30s | **3x** |
| 5 tests | 150s | 30s | **5x** |
| 10 page scrapes | 15m | 3m | **5x** |

## 🔧 Troubleshooting

### Issue: Subagents timeout

**Solution:**
```typescript
// Increase timeout for complex tasks
wait_for_subagents({ timeout_ms: 300000 }) // 5 minutes
```

### Issue: Too many concurrent subagents

**Solution:**
```typescript
// Reduce concurrent limit
const config: AgentConfig = {
  maxConcurrentSubagents: 3  // Lower limit
}
```

### Issue: AI not using parallel execution

**Solution:**
```typescript
// Add explicit hint in task description
const task = `
Test the application.
IMPORTANT: These tests can run in PARALLEL.
Spawn multiple subagents for different test scenarios.
`
```

## 📊 Monitoring

### Check Subagent Status

```typescript
// Status callback receives subagent info
onStatus({
  step: 5,
  message: 'Spawned 3 subagents',
  subagents: [
    { id: 'subagent_1', status: 'running', task: 'Test A' },
    { id: 'subagent_2', status: 'completed', result: 'Success' },
    { id: 'subagent_3', status: 'failed', error: 'Timeout' }
  ]
})
```

## 🔗 Resources

- [Full Documentation](./PARALLEL_SUBAGENT_OPTIMIZATION.md)
- [API Reference](../../src/services/aiAgentService.ts)
- [Summary](./PARALLEL_OPTIMIZATION_SUMMARY.md)

## 📝 Example: Complete Workflow

```typescript
// 1. Configure agent
const config: AgentConfig = {
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseUrl: 'https://api.anthropic.com',
  model: 'claude-opus-4-5-20251101',
  maxConcurrentSubagents: 5,
  subagentTimeout: 120000
}

// 2. Define task with parallel hint
const task = `
Test the e-commerce checkout flow for 3 product types.
PARALLEL EXECUTION: Test each product type simultaneously.
`

// 3. Run agent
const result = await runAgent(
  config,
  task,
  (status) => console.log(status),
  undefined,
  30 // max steps
)

// 4. Agent will automatically:
//    - Identify 3 independent test tasks
//    - Call spawn_multiple_subagents([...3 tasks...])
//    - Call wait_for_subagents()
//    - Return combined results
```

## ⏱️ Timing Comparison

### Sequential Execution
```
Step 1: spawn_subagent("Test product A")   → 0s
Step 2: wait_for_subagents()               → 30s
Step 3: spawn_subagent("Test product B")   → 30s
Step 4: wait_for_subagents()               → 60s
Step 5: spawn_subagent("Test product C")   → 60s
Step 6: wait_for_subagents()               → 90s
Total: 90 seconds
```

### Parallel Execution
```
Step 1: spawn_multiple_subagents([         → 0s
         "Test product A",
         "Test product B",
         "Test product C"
        ])
Step 2: wait_for_subagents()               → 30s
Total: 30 seconds (3x faster!)
```

---

**Last Updated:** 2026-01-11
**Version:** 1.0.0
