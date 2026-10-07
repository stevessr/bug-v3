# / 快捷表情选取（试验性功能）

设置 → 开关 → **启用 / 快捷表情选取**。默认关闭，可单独开关；关闭时立即收起菜单，不修改已输入的文字。

- 仅在 Discourse 话题 textarea、聊天 textarea 和 ProseMirror 话题编辑器中生效。
- 在行首或空白后输入 `/`：先显示当前站点已启用、非空的表情分组。
- 输入名称筛选，↑/↓ 选择分组，Enter 进入该分组。
- 表情网格支持 ↑/↓ 按行移动、←/→ 按列移动，Enter 插入；也可鼠标点击。
- 分组选定后可继续输入表情名称筛选；查询为空时 Backspace 返回分组。Esc 取消并保留文字。
- 替换从 `/` 到当前光标之间的文字，不清空编辑器，也不会插入另一输入框。
- 优先插入 customOutput；否则使用当前站点可解析的 short_url 或完整 URL。
- 网格冻结图片首帧；当前选中预览保留动画。图片按可见区域懒加载。
- 不接管 URL 中的 `/`、粘贴、IME 合成、普通网页输入框或 Ctrl/Meta/Alt 快捷键。

验证：`pnpm exec playwright test scripts/tests/slash-emoji-picker.spec.ts`。
