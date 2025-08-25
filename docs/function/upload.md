# 文件上传功能汇总

任务说明：把项目中与“文件上传”相关的实现位置、关键流程与示例代码整理成独立文档，便于阅读和复用。

简要计划：

- 扫描并定位实现文件（已完成）
- 提取关键实现点与流程（已完成）
- 给出最小示例代码片段与使用示例（已完成）

## 覆盖清单

- [x] 扫描仓库并定位相关文件
- [x] 总结主要实现模块与职责
- [x] 提取关键流程（队列、重试、进度 UI、FormData 构建）
- [x] 给出示例代码片段与调用示例
- [x] 将结果写入 `docs/UPLOAD_SUMMARY.md`

---

## 1. 主要实现文件（定位）

- `src/content/uploader.ts` — 主体实现：`ImageUploader` 类、上传队列、重试、上传对话框（拖拽/选择）、diff 模式逻辑、`performUpload`（FormData + fetch）。
- `src/content/injector.ts` — 在页面注入上传按钮/菜单，调用上传对话框（`showImageUploadDialog()`）。
- `src/components/ImageGenerator/ImageUpload.vue` 与 `src/image-generator.ts` — 用于图片生成/编辑页面的文件选择、预览（FileReader -> base64）和拖放逻辑。
- `src/options/components/ExternalImportTab.vue` 与 `src/options/modals/ImportEmojisModal.vue` — 在选项页中使用 `<input type="file">` 导入 JSON 配置的示例。
- `image-generator.html` / `image-generator.ts` / `referense/simple.html` — 页面端的上传/选择/拖放示例。

## 2. 功能概览（高层）

1. UI：提供一个可拖拽的上传面板（regular 上传和 diff 上传两种 tab），包括隐藏的 `<input type="file">` 用于触发选择文件。
2. 队列：`ImageUploader` 使用等待/上传/失败/成功四个队列管理多个并发上传任务。
3. 重试与退避：对可重试错误进行指数退避与限制最大重试次数（`maxRetries`）。
4. 上传实现：通过构造 `FormData`（包含文件、sha1 校验、name、type 等字段）并用 `fetch` POST 到后端（看代码示例为 `https://linux.do/uploads.json?client_id=...`）。
5. CSRF & Cookies：尝试从 meta、cookie 或隐藏 input 提取 CSRF token，并在请求头里携带 `X-Csrf-Token`，如有 cookie 则附带 `Cookie`。
6. 插入到编辑器：上传成功后生成 Markdown 插入语法并调用 `insertIntoEditor` 将图片插入到编辑器中。
7. Diff 模式：提供从现有 Markdown 文本中解析已存在文件名的能力，避免重复上传。
8. 前端预览：部分组件（ImageUpload.vue / image-generator）把图片读为 base64 预览并在需要时传递 base64 数据。

## 3. 关键流程与职责

- ImageUploader
  - 等待队列入队：`uploadImage(file)` 返回 Promise，将任务放入 `waitingQueue`。
  - 处理队列：`processQueue()` 负责从 waiting->uploading->(success|failed)，在成功时调用 `insertIntoEditor`。
  - 上传实现：`performUpload(file)` 构建 `FormData`，调用 `fetch`，解析返回的 `UploadResponse`。
  - 重试策略：`shouldRetry` 判断是否重试；失败则 `retryCount++` 并使用 `sleep(Math.pow(2, retryCount) * 1000)` 做指数退避。
  - 进度 UI：`createProgressDialog` / `showProgressDialog` / `updateProgressDialog` 用于显示右上角队列状态和单项重试按钮。

## 4. 示例代码片段（摘录并最小化）

- 入队与调用（调用示例）：

```ts
// 将文件加入上传队列并等待结果
import { uploader, showImageUploadDialog } from './content/uploader'

// 在注入按钮或其他交互中调用：
await showImageUploadDialog()

// 也可直接上传单个文件：
const response = await uploader.uploadImage(file) // 返回 UploadResponse
```

- performUpload 构建 FormData（核心）:

```ts
private async performUpload(file: File): Promise<UploadResponse> {
  const sha1 = await this.calculateSHA1(file)
  const formData = new FormData()
  formData.append('upload_type', 'composer')
  formData.append('relativePath', 'null')
  formData.append('name', file.name)
  formData.append('type', file.type)
  formData.append('sha1_checksum', sha1)
  formData.append('file', file, file.name)

  const csrfToken = this.getCSRFToken()
  const headers: Record<string, string> = { 'X-Csrf-Token': csrfToken }
  if (document.cookie) headers['Cookie'] = document.cookie

  const resp = await fetch('https://linux.do/uploads.json?client_id=...', {
    method: 'POST',
    headers,
    body: formData
  })
  if (!resp.ok) throw await resp.json()
  return await resp.json() as UploadResponse
}
```

- CSRF 提取逻辑（要点）:

```ts
private getCSRFToken(): string {
  const metaToken = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement
  if (metaToken) return metaToken.content
  const match = document.cookie.match(/csrf_token=([^;]+)/)
  if (match) return decodeURIComponent(match[1])
  const hiddenInput = document.querySelector('input[name="authenticity_token"]') as HTMLInputElement
  if (hiddenInput) return hiddenInput.value
  return ''
}
```

- 队列处理与插入编辑器（核心片段）:

```ts
private async processQueue() {
  while (this.waitingQueue.length > 0) {
    const item = this.waitingQueue.shift()!
    this.moveToQueue(item, 'uploading')
    try {
      const result = await this.performUpload(item.file)
      this.moveToQueue(item, 'success')
      item.resolve(result)
      const markdown = `![${result.original_filename}](${result.url})`
      insertIntoEditor(markdown)
    } catch (error) {
      // 失败处理 + 可能重试
    }
  }
}
```

- 前端文件读取（base64 预览）示例（来自 `ImageUpload.vue` / image-generator）：

```ts
const reader = new FileReader()
reader.onload = (e) => {
  const result = e.target?.result as string
  const base64 = result.split(',')[1]
  // 将 base64 交给父组件或直接用于 <img src="data:image/...;base64,...">
}
reader.readAsDataURL(file)
```

## 5. 上传 UI（关键点）

- `createDragDropUploadPanel()` 在 `uploader.ts` 中动态创建上传对话框 DOM：
  - 两个 tab：常规上传（支持多文件拖拽/选择）和 diff 上传（上传不在给定 markdown 中的图片）。
  - 隐藏的 `<input type="file">` 用来触发系统文件选择。
  - 拖拽事件：`dragover`、`dragleave`、`drop` 对样式和上传触发进行处理。
  - diff 上传通过 `parseImageFilenamesFromMarkdown(markdownText)` 判断哪些文件需要上传。

## 6. 其他注意点与边界情况

- 支持格式：UI 文本提示支持 JPG/PNG/GIF，并限制单文件大小（UI 提示为 10MB）。
- 并发控制与速率限制：通过 `shouldRetry` 可以对 rate_limit 错误使用服务端返回的等待秒数来退避。
- CSRF/Cookies：上传依赖页面上下文中的 token 和 cookie，适用于在原始站点 context 中执行的 content script。
- 编辑器插入：实现假定存在可插入的编辑器环境，`insertIntoEditor` 封装了插入逻辑（在不同站点可能需调整）。

## 7. 快速上手示例

- 在页面脚本或注入按钮中打开上传对话框：

```ts
import { showImageUploadDialog } from './content/uploader'

// 弹出上传对话框
await showImageUploadDialog()
```

- 直接上传单个文件并获取返回结果：

```ts
import { uploader } from './content/uploader'

const resp = await uploader.uploadImage(file)
console.log('上传完成，文件 URL：', resp.url)
```

## 8. 建议的后续改进（可选）

- 将上传 endpoint 与 client_id 提取到配置中，避免硬编码。
- 增加更完善的错误分类与用户可见提示（例如区分网络错误、权限、文件过大等）。
- 在单元测试中对 `performUpload` 做 mock fetch 测试，验证重试/退避逻辑。

---

文档生成：已基于 `src/content/uploader.ts`、`src/content/injector.ts`、`src/components/ImageGenerator/ImageUpload.vue`、`src/image-generator.ts` 等文件的实现摘录和整理。
