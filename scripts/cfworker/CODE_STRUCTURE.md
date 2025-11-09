# 代码结构说明

## 文件组织

项目已将 CSS 和 JavaScript 拆分为独立文件，便于维护和管理。

### 目录结构

```
scripts/cfworker/public/
├── index.html              # 主 HTML 文件（仅包含结构）
└── assets/
    ├── css/
    │   └── style.css      # 所有样式代码
    ├── js/
    │   └── app.js         # 所有 JavaScript 逻辑
    └── ffmpeg/
        └── esm/           # FFmpeg.wasm 相关文件
```

### 文件说明

#### index.html

- 仅包含 HTML 结构
- 通过 `<link>` 引用外部 CSS
- 通过 `<script type="module">` 引用外部 JS

#### assets/css/style.css

- 包含所有页面样式
- 响应式设计
- 按钮、表单、布局等所有 CSS

#### assets/js/app.js

- 使用 ES6 模块语法
- FFmpeg.wasm 集成
- 视频转换逻辑
- WebCodecs AVIF 支持
- UI 交互逻辑

## 开发建议

1. **修改样式**：编辑 `assets/css/style.css`
2. **修改逻辑**：编辑 `assets/js/app.js`
3. **修改结构**：编辑 `index.html`

## 部署

所有文件已优化为静态资源，可直接部署到 Cloudflare Pages 或任何静态托管服务。
