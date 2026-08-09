# Cloudflare Worker 市场表情部署

仓库中的 `.github/workflows/deploy-cfworker-market.yml` 只负责
`scripts/cfworker/public/assets/market/**` 下的市场表情数据：

- 推送到 `master` 且修改市场目录文件时自动运行。
- 也可以在 GitHub Actions 中使用 **Run workflow** 手动运行。
- 部署前运行 `pnpm update:metadata`，回填 `metadata.json`、分页索引和
  `market-random.ts` 的分组清单，并通过 `pnpm validate:market` 校验。
- 其他扩展代码、普通表情数据和 Worker 静态页面的变更不会自动触发此流程。

## GitHub Secrets

在仓库设置以下 Actions secrets：

- `CLOUDFLARE_API_TOKEN`：具备目标 Pages 项目部署权限的 API Token。
- `CLOUDFLARE_ACCOUNT_ID`：Cloudflare Account ID。

目标 Pages 项目由 `scripts/cfworker/package.json` 中的
`video2gif-pages` 指定。部署使用工作区锁定的 Wrangler 版本，不依赖全局 CLI。

## 本地验证

```bash
pnpm update:metadata
pnpm validate:market
pnpm update:data
```

`pnpm update:metadata` 会修改生成文件；如果只是本地检查且不想保留时间戳变化，
可在验证后还原这些生成文件。
