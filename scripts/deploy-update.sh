#!/bin/bash
# 自动部署脚本 - 版本 1.2.9-patch-3

echo "🚀 开始部署扩展更新..."

# 部署到 Cloudflare Pages（使用仓库锁定的 Wrangler，避免依赖全局 CLI）
cd "$(dirname "$0")/.."

echo "📦 部署到 Cloudflare Pages..."
pnpm --filter video2gif-static deploy

echo "✅ 部署完成！"
