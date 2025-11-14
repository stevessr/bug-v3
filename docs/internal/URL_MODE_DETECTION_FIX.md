# URL 模式检测逻辑修复

## 问题

访问 `chrome-extension://xxx/index.html?mode=popup#/groups` 时显示灰色空白页面。

## 原因分析

原来的逻辑按照以下优先级判断：

1. 检查 URL 参数 `mode=popup` → 设置为 Popup 模式
2. 但 Popup 组件不支持路由
3. 当 URL 包含 `#/groups` 这样的路由时，Popup 无法处理，显示空白

**问题**: URL 中同时有 `mode=popup` 和路由 hash `#/groups` 时，应该忽略 `mode=popup` 参数，因为带路由的一定是 Options 页面。

## 解决方案

调整模式检测的优先级，路由 hash 的优先级最高：

```typescript
onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  const mode = params.get('mode')
  const hasRouteHash = window.location.hash && window.location.hash.length > 1

  // 优先级1: 如果有路由 hash（如 #/groups），强制使用 options 模式
  // 因为 Popup 不支持路由，带路由的一定是 options 页面
  if (hasRouteHash) {
    isPopupMode.value = false
  } else if (mode === 'popup') {
    // 优先级2: URL 明确指定 popup 模式
    isPopupMode.value = true
  } else if (mode === 'options') {
    // 优先级3: URL 明确指定 options 模式
    isPopupMode.value = false
  } else {
    // 优先级4: 如果没有指定模式，通过窗口大小判断
    const isSmallWindow = window.innerWidth < 500 || window.innerHeight < 500
    isPopupMode.value = isSmallWindow
  }
})
```

## 新的优先级逻辑

| 优先级 | 条件                   | 结果         | 说明                    |
| ------ | ---------------------- | ------------ | ----------------------- |
| 1      | 有路由 hash（`#/xxx`） | Options 模式 | 路由只在 Options 中使用 |
| 2      | `?mode=popup`          | Popup 模式   | 明确指定 Popup          |
| 3      | `?mode=options`        | Options 模式 | 明确指定 Options        |
| 4      | 窗口 < 500px           | Popup 模式   | 小窗口默认 Popup        |
| 5      | 其他                   | Options 模式 | 默认 Options            |

## URL 测试用例

### ✅ 正确显示 Options 模式

```
index.html?mode=options
index.html?mode=options#/groups
index.html?mode=popup#/groups  ← 修复重点：虽然有 mode=popup，但因为有路由所以显示 Options
index.html#/groups
index.html#/settings
index.html  (窗口 > 500px)
```

### ✅ 正确显示 Popup 模式

```
index.html?mode=popup
index.html  (窗口 < 500px)
```

## 实际场景

### 场景1: 用户在 Popup 中点击设置按钮

```
跳转前: index.html?mode=popup
跳转后: index.html?mode=options#/groups
结果: ✅ 正确显示 Options 页面
```

### 场景2: 扩展图标点击

```
URL: index.html?mode=popup
结果: ✅ 显示 Popup 界面
```

### 场景3: 右键 → 选项

```
URL: index.html?mode=options
结果: ✅ 显示 Options 页面
```

### 场景4: 直接访问带路由的 URL（问题场景）

```
URL: index.html?mode=popup#/groups
修复前: ❌ 显示空白（Popup 不支持路由）
修复后: ✅ 显示 Options 页面（路由优先级最高）
```

## 边缘情况处理

1. **无参数无路由**: 根据窗口大小判断
2. **冲突的参数**: 路由 hash 优先级最高
3. **无效路由**: 由 vue-router 处理，重定向到默认页面

## 相关文件

- `/src/App.vue` - 模式检测逻辑

## 测试建议

安装扩展后测试以下 URL：

1. `chrome-extension://xxx/index.html?mode=popup` - 应显示 Popup
2. `chrome-extension://xxx/index.html?mode=options` - 应显示 Options
3. `chrome-extension://xxx/index.html?mode=popup#/groups` - 应显示 Options（带路由）
4. `chrome-extension://xxx/index.html#/settings` - 应显示 Options（带路由）
5. 在 Popup 中点击设置按钮 - 应正确跳转到 Options

## 优势

1. ✅ **逻辑清晰**: 路由优先级最高，符合直觉
2. ✅ **避免空白页**: 任何带路由的 URL 都会显示 Options
3. ✅ **向后兼容**: 所有原有 URL 模式仍然工作
4. ✅ **用户友好**: 错误的 URL 组合也能正确显示
