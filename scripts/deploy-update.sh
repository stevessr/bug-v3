#!/bin/bash
# 自动部署脚本 - 版本 1.2.9-patch-3

echo "🚀 开始部署扩展更新..."

# 进入 CF Worker 目录
cd "$(dirname "$0")/cfworker"

# 部署到 Cloudflare Pages
echo "📦 部署到 Cloudflare Pages..."
wrangler pages deploy

echo "✅ 部署完成！"
echo "📍 更新 URL:"
echo "   Chrome: https://s.pwsh.us.kg/updates.xml"
echo "   Firefox: https://s.pwsh.us.kg/updates.json"
echo "   下载：https://s.pwsh.us.kg/updates/extension.crx"
