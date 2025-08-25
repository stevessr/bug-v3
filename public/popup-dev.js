const ports = [5173, 5174, 5175, 5176, 5177, 5178]
const vitePath = '/dev-popup.html'
const statusEl = document.getElementById('status')
const actionsEl = document.getElementById('actions')
function setStatus(text) {
  statusEl.textContent = text
}

async function findAndLoad() {
  for (const p of ports) {
    const url = `http://localhost:${p}${vitePath}`
    try {
      const res = await fetch(url, { method: 'GET', mode: 'cors' })
      if (res.ok) {
        setStatus('本地 Vite 服务器可用，正在在 iframe 中加载开发版本...')
        const iframe = document.createElement('iframe')
        iframe.src = url
        iframe.style.width = '360px'
        iframe.style.height = '640px'
        iframe.style.border = 'none'
        document.body.appendChild(iframe)
        setStatus('')
        return
      }
    } catch (e) {
      // try next
    }
  }
  setStatus('无法连接到本地 Vite 服务器。')
  const btnDev = document.createElement('button')
  btnDev.textContent = '打开本地开发页面（新窗口）'
  btnDev.onclick = () => window.open(`http://localhost:${ports[0]}${vitePath}`, '_blank')
  const btnFallback = document.createElement('button')
  btnFallback.textContent = '使用打包内置 popup.html'
  btnFallback.onclick = () => (window.location.href = 'popup.html')
  actionsEl.appendChild(btnDev)
  actionsEl.appendChild(btnFallback)
}

findAndLoad()
