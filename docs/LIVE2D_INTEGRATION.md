# Live2D Widget 整合文檔

## 概述

本擴展已整合 Live2D 功能，可在所有網頁上自動顯示一個可交互的 Live2D 看板娘小部件。

## 功能特性

### ✨ 核心功能
- **自動注入**：擴展安裝後自動在網頁右下角顯示 Live2D 角色
- **拖拽移動**：可以拖拽 Live2D 小部件到任意位置
- **最小化**：點擊最小化按鈕可以收起角色
- **關閉**：點擊關閉按鈕可以隱藏小部件
- **響應式設計**：自適應不同屏幕尺寸
- **暗色主題支持**：自動適配系統暗色模式

### 🎨 視覺效果
- 毛玻璃背景效果（backdrop-filter）
- 柔和陰影和懸停動畫
- 平滑過渡動效
- 圓角卡片設計

## 技術實現

### 依賴庫
- **l2d** (v1.0.1) - Live2D 核心庫
- 來源：https://github.com/hacxy/l2d

### 文件結構
```
src/content/
├── live2d-widget.ts      # 主要邏輯
└── live2d-widget.css     # 樣式文件

dist/
├── js/
│   └── live2d-widget.js  # 構建輸出 (~4.7KB)
└── assets/
    └── live2d-widget.css # 樣式輸出 (~2.5KB)
```

### 配置文件
1. **vite.config.ts** - 構建配置
   - 添加了 `live2d-widget` 入口點
   
2. **public/manifest.json** - 擴展清單
   - 註冊為獨立的 content script
   - 匹配所有 URL：`<all_urls>`
   - 運行時機：`document_idle`

## 使用方法

### 基本使用
擴展安裝後會自動工作，無需額外配置。

### 自定義配置

#### 1. 更改模型
編輯 `src/content/live2d-widget.ts` 中的 `DEFAULT_CONFIG`：

```typescript
const DEFAULT_CONFIG: Live2DConfig = {
  modelPath: 'https://model.hacxy.cn/cat-black/model.json', // 更改此 URL
  position: [0, 10],
  scale: 0.15,
  canvasWidth: 300,
  canvasHeight: 400,
  enabled: true
}
```

#### 2. 黑名單/白名單
在 `checkIfShouldEnable()` 函數中配置：

```typescript
function checkIfShouldEnable(): boolean {
  const blacklist = ['localhost', '127.0.0.1', 'example.com']
  const hostname = window.location.hostname
  
  if (blacklist.some(domain => hostname.includes(domain))) {
    return false
  }
  
  return true
}
```

#### 3. 禁用功能
方法 1：在 `DEFAULT_CONFIG` 中設置 `enabled: false`

方法 2：在 `manifest.json` 中移除 Live2D content script 條目

## 模型資源

### 官方模型庫
- https://model.hacxy.cn/
  - cat-black（黑貓）
  - cat-white（白貓）
  - 其他模型...

### 自定義模型
可以使用任何符合 Live2D Cubism 格式的模型：
- model.json（必需）
- 紋理文件（.png）
- 動作文件（.mtn）
- 表情文件

## API 使用

### 程序化控制
在頁面中可以通過全局變量訪問 widget：

```javascript
// 顯示 widget
if (window.live2dWidget) {
  window.live2dWidget.show()
}

// 隱藏 widget
if (window.live2dWidget) {
  window.live2dWidget.destroy()
}

// 更新配置
if (window.live2dWidget) {
  window.live2dWidget.updateConfig({
    modelPath: 'https://model.hacxy.cn/cat-white/model.json'
  })
}
```

## 構建說明

### 構建命令
```bash
pnpm run build
```

### 構建輸出
- `dist/js/live2d-widget.js` - 主腳本（~4.7KB）
- `dist/assets/live2d-widget.css` - 樣式（~2.5KB）

### 已知警告
構建時會出現 l2d 庫的 CommonJS 警告：
```
[COMMONJS_VARIABLE_IN_ESM] Warning: The CommonJS `module` variable...
[COMMONJS_VARIABLE_IN_ESM] Warning: The CommonJS `exports` variable...
```

**這些警告是正常的**，不影響功能。l2d 庫使用了 CommonJS 格式，Vite 會自動處理兼容性。

## 性能考慮

### 優化措施
1. **延遲加載**：在 `document_idle` 時才注入
2. **黑名單機制**：避免在開發環境（localhost）運行
3. **輕量級構建**：僅 ~7KB（JS + CSS）
4. **獨立運行**：不依賴頁面其他組件

### 性能影響
- 初始化時間：<100ms
- 內存佔用：~10-20MB（包含 WebGL 上下文）
- CPU 使用：動畫播放時輕微增加

## 疑難解答

### Q: Live2D 沒有顯示？
A: 檢查：
1. 是否在黑名單中（localhost 默認禁用）
2. 瀏覽器控制台是否有錯誤
3. 網絡連接是否正常（模型需要從網絡加載）

### Q: 模型加載失敗？
A: 確認：
1. 模型 URL 可訪問
2. CORS 設置正確
3. 模型格式符合 Live2D Cubism 規範

### Q: 影響頁面性能？
A: 可以：
1. 添加當前網站到黑名單
2. 暫時禁用功能
3. 使用更輕量的模型

## 未來計劃

- [ ] 添加設置界面（Options 頁面）
- [ ] 支持多個模型切換
- [ ] 添加互動功能（點擊觸發動作）
- [ ] 語音支持
- [ ] 自定義對話氣泡
- [ ] 本地模型支持

## 相關資源

- **l2d 文檔**：https://l2d.hacxy.cn/
- **Live2D Cubism**：https://www.live2d.com/
- **模型資源**：https://model.hacxy.cn/

## 貢獻

歡迎提交 Issue 和 Pull Request 來改進 Live2D 功能！

---

**版本**：v1.0.0  
**更新日期**：2025-11-29  
**作者**：stevessr
