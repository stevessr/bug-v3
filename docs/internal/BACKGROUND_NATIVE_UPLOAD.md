# 后台使用原生上传器

设置 → 开关 → **后台使用原生上传器**，默认关闭，独立于注入页面的“使用 Discourse 原生上传器”。

开启后 Telegram 导入、缓冲区、协作上传等共享 Discourse 上传服务，以及后台下载后上传和内置论坛浏览器上传，会把文件交给目标论坛标签页的 Discourse 原生帖子上传器（验证、预处理和传输）。不改变 imgbed。

- 打开并登录目标论坛，保持帖子编辑器开启；不会替你打开或修改草稿。
- 只发送到完全同源的标签页，优先当前活动标签页，支持自定义 Discourse 域名。
- 只有原生上传器明确表示尚未接受文件时才尝试其他同源标签页。已接受后的失败、超时或未知结果不重新发送，避免重复上传。
- 原生上传器不可用时明确提示，不静默回退到扩展 API。
- 同一页面的后台原生上传串行处理，防止同名文件的原生事件混淆。
- 保留 url、short_url、short_path 和图片尺寸；429 保留等待时间并沿用原有等待重试。
- 关闭后恢复原来的内建 API / Linux.do 页面代理流程。

验证：`pnpm exec playwright test scripts/tests/background-native-upload.spec.ts scripts/tests/telegram-upload-recovery.spec.ts`。浏览器测试使用真实扩展桥接脚本和模拟的 Discourse 事件服务，不替代真实论坛接受测试。
