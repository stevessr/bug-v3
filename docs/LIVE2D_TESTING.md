# Live2D Widget 測試指南

## 快速測試步驟

### 1. 構建擴展
```bash
pnpm run build
```

### 2. 載入擴展到瀏覽器

#### Chrome/Edge
1. 打開 `chrome://extensions/` 或 `edge://extensions/`
2. 啟用「開發者模式」
3. 點擊「載入未封裝項目」
4. 選擇項目的 `dist` 資料夾

#### Firefox
1. 打開 `about:debugging#/runtime/this-firefox`
2. 點擊「載入臨時附加元件」
3. 選擇 `dist/manifest.json`

### 3. 訪問測試網頁

打開任意網頁（非 localhost），例如：
- https://www.google.com
- https://github.com
- https://example.com

### 4. 驗證功能

應該能看到：
✅ 右下角出現 Live2D 角色（黑貓）
✅ 角色在玻璃效果的卡片容器中
✅ 懸停時顯示控制按鈕（最小化、關閉）

## 功能測試清單

### 基本顯示
- [ ] Live2D 角色正常顯示
- [ ] 模型動畫流暢播放
- [ ] 容器樣式正確（圓角、陰影、毛玻璃效果）

### 交互功能
- [ ] 可以拖拽移動容器
- [ ] 點擊最小化按鈕可以收起角色
- [ ] 點擊關閉按鈕可以隱藏容器
- [ ] 拖拽時游標變為 grabbing

### 響應式設計
- [ ] 在不同屏幕尺寸下正常顯示
- [ ] 移動設備上縮小顯示（scale: 0.8）
- [ ] 暗色模式下樣式正確

### 性能測試
- [ ] 頁面載入速度無明顯影響
- [ ] 瀏覽器控制台無錯誤
- [ ] CPU 使用率正常
- [ ] 內存使用合理

### 黑名單測試
- [ ] localhost 上不顯示（默認）
- [ ] 127.0.0.1 上不顯示（默認）
- [ ] 其他網站正常顯示

## 控制台測試

### 查看日誌
打開瀏覽器控制台（F12），應該看到：
```
[Live2D] Widget auto-initialized
[Live2D] Loading model from: https://model.hacxy.cn/cat-black/model.json
[Live2D] Model loaded successfully
[Live2D] Model is ready
```

### 程序化測試
在控制台執行：

#### 隱藏 widget
```javascript
document.getElementById('live2d-widget-container').style.display = 'none'
```

#### 顯示 widget
```javascript
document.getElementById('live2d-widget-container').style.display = 'block'
```

#### 檢查元素存在
```javascript
console.log(document.getElementById('live2d-widget-container'))
console.log(document.getElementById('live2d-widget-canvas'))
```

## 已知問題排查

### 問題 1：Live2D 沒有顯示
**可能原因**：
- 在黑名單網站（localhost）
- 網絡問題，無法載入模型
- Content script 未注入

**解決方法**：
1. 檢查網址是否在黑名單
2. 檢查控制台錯誤信息
3. 重新載入擴展

### 問題 2：模型加載失敗
**錯誤信息**：
```
[Live2D] Failed to load model: NetworkError
```

**解決方法**：
1. 檢查網絡連接
2. 確認模型 URL 可訪問
3. 檢查 CORS 設置

### 問題 3：構建警告
**警告信息**：
```
[COMMONJS_VARIABLE_IN_ESM] Warning
```

**說明**：這是正常的，l2d 庫使用 CommonJS 格式，不影響功能。

### 問題 4：拖拽不流暢
**可能原因**：
- 頁面有其他元素干擾
- CSS transform 衝突

**解決方法**：
1. 檢查 z-index 設置（應為 999999）
2. 確認無其他拖拽功能衝突

## 性能測試

### Chrome DevTools Performance
1. 打開 DevTools > Performance
2. 錄製 5 秒
3. 檢查：
   - FPS 應保持 60
   - CPU 使用率合理
   - 無明顯卡頓

### 內存測試
1. 打開 DevTools > Memory
2. 查看堆快照
3. Live2D widget 應佔用 10-20MB

## 兼容性測試

### 瀏覽器
- [ ] Chrome 90+
- [ ] Edge 90+
- [ ] Firefox 88+
- [ ] Safari 14+（如支持）

### 操作系統
- [ ] Windows 10/11
- [ ] macOS 10.15+
- [ ] Linux（Ubuntu 20.04+）

### 設備
- [ ] 桌面電腦（1920x1080）
- [ ] 筆記本（1366x768）
- [ ] 平板（768x1024）
- [ ] 手機（375x667）

## 自動化測試（未來）

### Playwright 測試腳本
```javascript
test('Live2D widget should appear on page', async ({ page }) => {
  await page.goto('https://example.com')
  await page.waitForSelector('#live2d-widget-container')
  
  const widget = await page.$('#live2d-widget-container')
  expect(widget).toBeTruthy()
  
  const canvas = await page.$('#live2d-widget-canvas')
  expect(canvas).toBeTruthy()
})

test('Widget should be draggable', async ({ page }) => {
  await page.goto('https://example.com')
  
  const widget = await page.$('#live2d-widget-container')
  const box = await widget.boundingBox()
  
  await page.mouse.move(box.x + 50, box.y + 50)
  await page.mouse.down()
  await page.mouse.move(box.x + 100, box.y + 100)
  await page.mouse.up()
  
  const newBox = await widget.boundingBox()
  expect(newBox.x).toBeGreaterThan(box.x)
})
```

## 測試報告模板

### 測試環境
- **瀏覽器**：Chrome 120.0.0
- **操作系統**：Windows 11
- **擴展版本**：v1.2.7-patch-4
- **測試日期**：2025-11-29

### 測試結果
| 功能 | 狀態 | 備註 |
|------|------|------|
| 基本顯示 | ✅ | 正常 |
| 拖拽功能 | ✅ | 流暢 |
| 最小化 | ✅ | 正常 |
| 關閉按鈕 | ✅ | 正常 |
| 響應式設計 | ✅ | 正常 |
| 性能 | ✅ | 無影響 |

### 問題記錄
無

---

**測試完成！** 🎉
