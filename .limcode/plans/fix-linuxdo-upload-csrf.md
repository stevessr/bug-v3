## TODO LIST

<!-- LIMCODE_TODO_LIST_START -->
- [ ] 整理调用方 CSRF 读取逻辑，复用 getCsrfTokenFromPage，减少重复实现  `#cleanup-callers`
- [ ] 设计并实现 multipart 上传的 CSRF 解析兜底函数（含页面/扩展/抓取 fallback）  `#resolve-csrf-helper`
- [ ] 手动验证 linux.do 上传流程与其他上传入口的 CSRF header 行为  `#verify-upload`
- [ ] 在 uploadLinuxDoMultipart 中使用统一 CSRF 解析，确保所有 multipart 请求头包含 CSRF  `#wire-multipart`
<!-- LIMCODE_TODO_LIST_END -->

## 背景与问题定位
- 当前 `uploadLinuxDoMultipart` 依赖调用方传入 `csrfToken`，若为空则不会发送 `x-csrf-token`，触发 `/uploads/create-multipart.json` 的 BAD CSRF。
- 多处调用链（内容脚本上传、页面消息上传、后台下载转发）各自实现 CSRF 读取，存在不一致与空值风险。

## 目标
- multipart 上传所有请求都可靠携带 CSRF 头。
- 统一 CSRF 解析逻辑，减少重复代码与遗漏。

## 方案设计
1. **新增统一 CSRF 解析函数**（放在 `src/utils/discourseUpload.ts` 或抽到共享 util）：
   - 优先使用 `options.csrfToken`。
   - 若 `options.headers` 已包含 CSRF 头（大小写不敏感），直接复用。
   - 若在页面上下文可访问 `document`，调用 `getCsrfTokenFromPage`（或内联同等逻辑）读取 meta/cookie/hidden input。
   - 若仍为空且存在扩展环境（`chrome.runtime` 可用），尝试复用已有消息通道（`REQUEST_LINUX_DO_AUTH` 或 `GET_CSRF_TOKEN`）获取。
   - 若仍为空且有 Cookie，可在后台发起一次 GET baseUrl（或走 PAGE_FETCH）解析 meta token（参考 `linuxDoGroup.ts`）。

2. **更新 multipart 上传流程**：
   - 在 `uploadLinuxDoMultipart` 入口调用上述解析函数，得到 `resolvedCsrfToken`。
   - 将 `resolvedCsrfToken` 传入 `buildAjaxHeaders`，保证 create/presign/complete/abort 全链路都带上 CSRF。
   - 如解析失败，记录警告日志（便于定位）。

3. **整理调用方**：
   - `content/utils/upload/core.ts` 的 `getCSRFToken` 逻辑改为复用 `getCsrfTokenFromPage`（避免逻辑漂移）。
   - `content/discourse/utils/upload-handler.ts`、`content/messageHandlers/pageUploadHandler.ts` 保持传入 CSRF，但允许为空（由 `uploadLinuxDoMultipart` 兜底）。
   - 若存在后台上传链路 `downloadAndUploadDirect` 未能传入 CSRF，则依赖新兜底逻辑解析。

4. **验证与回归**：
   - 手动在 linux.do 触发上传，确认 network 中 `create-multipart.json` 请求含 `x-csrf-token`。
   - 验证页面上传、后台下载转发上传等路径均成功返回上传 URL。
   - 若可行，补充日志或通知提示缺失 CSRF 的情况。

## 影响范围
- `src/utils/discourseUpload.ts`
- `src/content/utils/upload/core.ts`
- `src/content/discourse/utils/upload-handler.ts`
- `src/content/messageHandlers/pageUploadHandler.ts`
- （如需）共享 CSRF 获取工具或新 util

## 风险与回滚
- 仅新增 CSRF 解析兜底与复用逻辑，风险较低；若出现异常，可回滚到现有直传逻辑。
