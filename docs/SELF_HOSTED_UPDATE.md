# 扩展自托管更新功能

本文档说明如何为表情扩展配置自托管更新功能。

## 功能概述

自托管更新功能允许扩展在不依赖官方扩展商店的情况下自动检查和安装更新。这对于：
- 开发版本测试
- 企业内部分发
- 绕过商店审核延迟
- 提供更快的更新推送

非常有用。

## 文件结构

```
scripts/cfworker/public/
├── updates.xml          # Chrome扩展更新清单
├── updates.json         # Firefox扩展更新清单
└── updates/             # 扩展文件目录
    ├── extension.crx    # Chrome扩展包
    └── extension.xpi    # Firefox扩展包
```

## 配置步骤

### 1. 获取扩展 ID

#### Chrome 扩展
1. 在 Chrome 中加载未打包的扩展
2. 记下扩展 ID（32 位字符串）
3. 更新 `scripts/update-extension-version.js` 中的 `CONFIG.extensionId`

#### Firefox 扩展
1. 构建 XPI 文件
2. 使用 Firefox 的临时安装功能加载
3. 记下扩展 ID

### 2. 更新 manifest.json

manifest.json 已配置了更新 URL：
```json
{
  "update_url": "https://s.pwsh.us.kg/updates.xml",
  "applications": {
    "gecko": {
      "id": "emoji-extension@pwsh.us.kg",
      "update_url": "https://s.pwsh.us.kg/updates.json"
    }
  }
}
```

### 3. 发布新版本

#### 自动化流程
```bash
# 1. 构建扩展
npm run build:prod

# 2. 打包扩展
npm run pack:crx

# 3. 更新版本信息
node scripts/update-extension-version.js

# 4. 部署到Cloudflare Pages
./scripts/deploy-update.sh
```

#### 手动流程
1. 构建并打包扩展
2. 将 CRX/XPI 文件复制到 `scripts/cfworker/public/updates/`
3. 更新 `updates.xml` 和 `updates.json` 中的版本号
4. 部署到 Cloudflare Pages

## 更新文件格式

### Chrome updates.xml
```xml
<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='YOUR_EXTENSION_ID'>
    <updatecheck codebase='https://s.pwsh.us.kg/updates/extension.crx' version='1.0.0' />
  </app>
</gupdate>
```

### Firefox updates.json
```json
{
  "addons": {
    "YOUR_EXTENSION_ID@pwsh.us.kg": {
      "updates": [
        {
          "version": "1.0.0",
          "update_link": "https://s.pwsh.us.kg/updates/extension.xpi",
          "update_hash": "sha256:HASH_HERE"
        }
      ]
    }
  }
}
```

## 安全考虑

1. **HTTPS 必须**：所有更新 URL 必须使用 HTTPS
2. **版本验证**：扩展会验证新版本号是否高于当前版本
3. **哈希验证**：Firefox 使用 SHA256 哈希验证文件完整性
4. **权限控制**：确保更新服务器只能由授权人员访问

## 更新检查机制

### 自动检查
- 每 24 小时检查一次更新
- 扩展启动时检查
- 浏览器定期检查（频率因浏览器而异）

### 手动检查
用户可以通过以下方式手动检查：
1. 扩展设置中的"检查更新"按钮
2. 开发者工具中的更新检查
3. 调用 `chrome.runtime.requestUpdateCheck()`

### 通知机制
- 发现更新时显示桌面通知
- 提供立即更新和稍后提醒选项
- 点击通知跳转到下载页面

## 故障排除

### 常见问题

#### 1. 更新检查失败
- 检查网络连接
- 验证更新 URL 是否可访问
- 确认 XML/JSON 格式正确

#### 2. 版本号不更新
- 确保新版本号高于当前版本
- 检查版本号格式（x.y.z）
- 清除扩展缓存

#### 3. 下载失败
- 验证 CRX/XPI 文件是否存在
- 检查文件权限
- 确认服务器配置正确

### 调试方法

1. 打开浏览器开发者工具
2. 查看背景页面控制台日志
3. 检查网络请求
4. 手动访问更新 URL 验证响应

## 最佳实践

1. **版本管理**：遵循语义化版本控制
2. **测试流程**：先在小范围测试，再全面推送
3. **回滚计划**：保留旧版本文件以备回滚
4. **监控日志**：记录更新成功/失败统计
5. **用户通知**：重要更新时提供详细说明

## 相关命令

```bash
# 更新版本信息
node scripts/update-extension-version.js

# 部署到Cloudflare Pages
cd scripts/cfworker && wrangler pages deploy

# 检查更新文件
curl https://s.pwsh.us.kg/updates.xml
curl https://s.pwsh.us.kg/updates.json
```

## 注意事项

1. 确保 Cloudflare Pages 配置正确
2. 更新文件后需要等待 CDN 缓存刷新
3. Chrome 和 Firefox 的更新机制略有不同
4. 企业环境可能需要额外的安全配置