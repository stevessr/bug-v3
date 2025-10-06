# Linux.do 429 错误自动过盾功能

## 功能概述

为 linux.do 网站添加了自动检测和处理 429（Too Many Requests）错误的功能。当检测到服务器返回 429 状态码时，会自动提示用户刷新页面以触发 Cloudflare 验证。

## 功能特性

### ✨ 核心功能

1. **全局请求拦截**
   - 拦截所有 `fetch` API 请求
   - 拦截所有 `XMLHttpRequest` 请求
   - 实时监测 HTTP 响应状态码

2. **智能 429 检测**
   - 自动识别 429 (Too Many Requests) 响应
   - 记录触发 429 的请求 URL
   - 提供详细的控制台日志

3. **自动过盾机制**
   - 检测到 429 时弹出确认对话框
   - 用户确认后刷新页面触发 Cloudflare 验证
   - 通过验证后恢复正常访问

4. **防抖保护**
   - 30 秒冷却时间，避免频繁触发
   - 防止同时处理多个 429 错误
   - 避免用户体验受到干扰

### 🎯 仅限 linux.do

此功能**仅在 linux.do 域名下启用**，不会影响其他网站的正常使用。

## 技术实现

### 文件结构

```
src/content/
├── content.ts                    # 入口文件，初始化功能
└── utils/
    └── antiRateLimit.ts         # 429 拦截和处理逻辑
```

### 核心代码

#### 1. Fetch API 拦截

```typescript
const originalFetch = window.fetch

window.fetch = async function (...args) {
  const response = await originalFetch(...args)
  
  if (response.status === 429) {
    console.warn('[Anti-RateLimit] Fetch 请求返回 429:', args[0])
    triggerCloudflareChallenge()
  }
  
  return response
}
```

#### 2. XMLHttpRequest 拦截

```typescript
XMLHttpRequest.prototype.send = function (body) {
  this.addEventListener('readystatechange', function () {
    if (this.readyState === 4 && this.status === 429) {
      console.warn('[Anti-RateLimit] XHR 请求返回 429:', this._requestURL)
      triggerCloudflareChallenge()
    }
  })
  
  return originalSend.apply(this, arguments)
}
```

#### 3. 触发 Cloudflare 验证

```typescript
function triggerCloudflareChallenge() {
  const shouldRefresh = confirm(
    '检测到访问频率限制 (429)，是否刷新页面以触发 Cloudflare 验证？'
  )
  
  if (shouldRefresh) {
    window.location.reload()
  }
}
```

## 使用说明

### 自动运行

功能会在访问 linux.do 时自动启动，无需任何配置。

### 用户体验流程

1. **正常浏览** → 用户在 linux.do 正常浏览内容
2. **触发限制** → 当请求过于频繁时，服务器返回 429
3. **自动检测** → 扩展立即检测到 429 错误
4. **弹出提示** → 显示确认对话框：
   ```
   检测到访问频率限制 (429)，是否刷新页面以触发 Cloudflare 验证？
   [确定] [取消]
   ```
5. **用户选择**
   - 点击 **确定** → 页面刷新，触发 Cloudflare 验证
   - 点击 **取消** → 继续当前操作（可能部分功能受限）
6. **验证通过** → 完成验证后恢复正常访问

### 手动触发（调试用）

在浏览器控制台可以手动触发：

```javascript
// 手动触发过盾
window.triggerCloudflareChallenge()
```

## 控制台日志

### 正常启动日志

```
[Anti-RateLimit] 初始化 429 错误拦截器 for linux.do
[Anti-RateLimit] Fetch API 拦截已启用
[Anti-RateLimit] XMLHttpRequest 拦截已启用
[Anti-RateLimit] ✅ 拦截器启动成功
[Anti-RateLimit] 已暴露 window.triggerCloudflareChallenge() 用于手动测试
```

### 检测到 429 时

```
[Anti-RateLimit] Fetch 请求返回 429: https://linux.do/api/xxx
[Anti-RateLimit] 检测到 429 错误，准备触发过盾...
[Anti-RateLimit] 用户确认，刷新页面触发验证
```

### 冷却期间

```
[Anti-RateLimit] 冷却中，跳过触发
```

## 配置参数

### 可调整参数

在 `antiRateLimit.ts` 中可以调整以下参数：

```typescript
// 冷却时间（毫秒）
const COOLDOWN_MS = 30000 // 默认 30 秒
```

建议值：
- **30 秒**（默认）：平衡用户体验和防护效果
- **60 秒**：更保守，减少打扰
- **15 秒**：更激进，快速响应

## 兼容性

### 浏览器支持

- ✅ Chrome 88+
- ✅ Edge 88+
- ✅ Firefox 78+
- ✅ Safari 14+

### API 兼容性

- ✅ Fetch API
- ✅ XMLHttpRequest
- ✅ 现代浏览器的所有请求方式

## 优势

### 1. 自动化
- 无需用户手动刷新页面
- 自动检测和处理 429 错误
- 减少用户操作步骤

### 2. 智能化
- 防抖机制避免频繁触发
- 用户确认后再执行操作
- 详细的日志便于调试

### 3. 非侵入性
- 仅在 linux.do 生效
- 不影响其他网站
- 不改变原有功能

### 4. 灵活性
- 支持手动触发
- 可调整冷却时间
- 可扩展到其他网站

## 注意事项

### ⚠️ 重要提示

1. **需要用户确认**
   - 不会强制刷新页面
   - 用户可以选择取消
   - 保护用户当前操作

2. **冷却机制**
   - 30 秒内只触发一次
   - 避免无限循环
   - 防止用户体验下降

3. **仅限 linux.do**
   - 其他网站不会受影响
   - 专为 linux.do 优化
   - 可根据需要扩展

4. **需要重新加载扩展**
   - 首次安装后需要重新加载扩展
   - 更新后需要刷新 linux.do 页面
   - 确保拦截器正确初始化

## 故障排除

### 问题 1：功能没有生效

**解决方法：**
1. 检查是否在 linux.do 域名下
2. 打开控制台查看是否有启动日志
3. 重新加载扩展
4. 刷新页面

### 问题 2：频繁弹出提示

**解决方法：**
1. 检查网络连接
2. 减少请求频率
3. 增加 `COOLDOWN_MS` 值
4. 联系 linux.do 管理员

### 问题 3：刷新后仍然 429

**解决方法：**
1. 等待 30 秒后重试
2. 清除浏览器缓存
3. 尝试使用无痕模式
4. 检查 IP 是否被限制

## 后续优化建议

### 1. 更智能的验证方式
- 自动检测是否需要验证
- 静默触发验证流程
- 避免打断用户操作

### 2. 更友好的提示
- 使用自定义弹窗代替 confirm
- 显示倒计时和进度
- 提供更多操作选项

### 3. 数据统计
- 记录 429 触发次数
- 分析触发时间分布
- 优化冷却策略

### 4. 扩展到其他网站
- 支持更多论坛平台
- 通用化拦截器
- 可配置域名列表

## 测试方法

### 模拟 429 错误

可以通过以下方式测试功能：

```javascript
// 在控制台执行
fetch('https://linux.do/api/test', {
  headers: {
    // 模拟高频请求
  }
})
```

或手动触发：

```javascript
window.triggerCloudflareChallenge()
```

## 版本信息

- **添加日期**: 2025-10-06
- **版本**: 1.0.0+
- **分支**: edge-cannary
- **影响文件**: 
  - `src/content/content.ts`
  - `src/content/utils/antiRateLimit.ts`

## 相关链接

- 问题反馈: https://github.com/stevessr/bug-v3/issues
- Linux.do: https://linux.do
- Cloudflare: https://www.cloudflare.com

## 贡献

欢迎提交 PR 改进此功能：
- 优化验证流程
- 改进用户体验
- 添加新特性
- 修复 Bug

---

**Note**: 此功能设计用于改善用户体验，请勿用于绕过合理的访问限制。请遵守 linux.do 的使用条款和服务条款。
