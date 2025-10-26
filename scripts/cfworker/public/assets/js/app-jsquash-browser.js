function $(id) { return document.getElementById(id); }


// 官方 @jsquash 模块的默认 unpkg ESM URL 映射（会尝试动态 import）
const DEFAULT_JSQUASH_MODULES = {
  avif: 'https://unpkg.com/@jsquash/avif@latest?module',
  jpeg: 'https://unpkg.com/@jsquash/jpeg@latest?module',
  jxl:  'https://unpkg.com/@jsquash/jxl@latest?module',
  png:  'https://unpkg.com/@jsquash/png@latest?module',
  webp: 'https://unpkg.com/@jsquash/webp@latest?module',
};

async function loadDefaultJsquashModules() {
  window.jSquashModules = window.jSquashModules || {};
  for (const [k, url] of Object.entries(DEFAULT_JSQUASH_MODULES)) {
    try {
      // try dynamic import
      const mod = await import(/* @vite-ignore */ url);
      window.jSquashModules[k] = mod.default || mod;
      log('已加载 jSquash 模块：' + k);
    } catch (e) {
      console.warn('加载 jSquash 模块 ' + k + ' 失败：', e.message);
      log('加载 jSquash 模块 ' + k + ' 失败：' + e.message);
    }
  }
  // 在加载模块后自动为每个模块构建能力适配器
  try {
    buildModuleAdapters();
  } catch (e) {
    console.warn('buildModuleAdapters error:', e.message);
  }
}

function buildModuleAdapters() {
  window.jSquashAdapters = window.jSquashAdapters || {};
  if (!window.jSquashModules) return;
  for (const [name, mod] of Object.entries(window.jSquashModules)) {
    const adapter = {
      name,
      hasEncodeFrames: typeof mod.encodeFrames === 'function',
      hasEncode: typeof mod.encode === 'function' || (mod.default && typeof mod.default.encode === 'function'),
      hasEncodeImage: typeof mod.encodeImage === 'function' || (mod.default && typeof mod.default.encodeImage === 'function'),
      // some modules export single-frame encoders under default
      encodesMultiple: false,
    };
    // Heuristic: if encode accepts 2 args and name suggests animation (webp), assume multi
    try {
      const fn = mod.encode || (mod.default && mod.default.encode);
      if (fn && fn.length >= 2) adapter.encodesMultiple = true;
    } catch (e) {
      // ignore
    }
    window.jSquashAdapters[name] = adapter;
    log('Adapter for ' + name + ': ' + JSON.stringify(adapter));
  }
  // 构建完成后刷新页面模块状态显示（如果存在）
  try { refreshModuleStatus(); } catch (e) { /* ignore */ }
}

function refreshModuleStatus() {
  const container = document.getElementById('moduleSupport');
  if (!container) return;
  container.innerHTML = '';
  const modules = window.jSquashModules || {};
  const adapters = window.jSquashAdapters || {};
  const table = document.createElement('div');
  table.style.display = 'grid';
  table.style.gridTemplateColumns = '1fr 1fr 1fr';
  table.style.gap = '6px';

  const header = document.createElement('div'); header.textContent = 'Format'; header.style.fontWeight='600'; table.appendChild(header);
  const header2 = document.createElement('div'); header2.textContent = 'Loaded'; header2.style.fontWeight='600'; table.appendChild(header2);
  const header3 = document.createElement('div'); header3.textContent = 'Capabilities'; header3.style.fontWeight='600'; table.appendChild(header3);

  const allKeys = new Set([...Object.keys(DEFAULT_JSQUASH_MODULES), ...Object.keys(modules), ...Object.keys(adapters)]);
  Array.from(allKeys).sort().forEach((k) => {
    const mod = modules[k];
    const adapter = adapters[k];
    const nameCell = document.createElement('div'); nameCell.textContent = k;
    const loadedCell = document.createElement('div'); loadedCell.textContent = mod ? 'yes' : 'no';
    const capCell = document.createElement('div');
    if (adapter) {
      const caps = [];
      if (adapter.hasEncodeFrames) caps.push('encodeFrames');
      if (adapter.hasEncode) caps.push('encode');
      if (adapter.hasEncodeImage) caps.push('encodeImage');
      if (adapter.encodesMultiple) caps.push('multi-frame(heuristic)');
      capCell.textContent = caps.join(', ');
    } else if (mod) {
      capCell.textContent = 'unknown (module loaded)';
    } else {
      capCell.textContent = '';
    }
    table.appendChild(nameCell);
    table.appendChild(loadedCell);
    table.appendChild(capCell);
  });
  container.appendChild(table);
}

// 官方模块风格的 decode / encode 包装（参考官方加载方法）
async function decodeWithModule(sourceType, fileBuffer) {
  const mod = window.jSquashModules && window.jSquashModules[sourceType];
  if (!mod) throw new Error('Module not loaded: ' + sourceType);
  if (typeof mod.decode === 'function') {
    return await mod.decode(fileBuffer);
  }
  if (mod.default && typeof mod.default.decode === 'function') {
    return await mod.default.decode(fileBuffer);
  }
  throw new Error('模块不支持 decode: ' + sourceType);
}

async function encodeWithModule(outputType, imageData, opts) {
  const mod = window.jSquashModules && window.jSquashModules[outputType];
  if (!mod) throw new Error('Module not loaded: ' + outputType);
  if (typeof mod.encode === 'function') return await mod.encode(imageData, opts);
  if (mod.default && typeof mod.default.encode === 'function') return await mod.default.encode(imageData, opts);
  throw new Error('模块不支持 encode: ' + outputType);
}

function log(msg) {
  const el = $('log');
  const time = new Date().toLocaleTimeString();
  el.textContent += `[${time}] ${msg}\n`;
  el.scrollTop = el.scrollHeight;
}

function setStatus(text) { $('status').textContent = text; }

function showResult(url) {
  const container = $('result');
  container.innerHTML = '';
  const a = document.createElement('a');
  a.href = url;
  a.textContent = '下载/打开 转换结果';
  a.target = '_blank';
  container.appendChild(a);
  const img = document.createElement('img');
  img.src = url;
  img.style.maxWidth = '100%';
  img.style.display = 'block';
  img.style.marginTop = '10px';
  container.appendChild(img);
}

function applyPreset(p) {
  if (p === 'high') { $('fps').value = 15; $('width').value = 720; }
  if (p === 'medium') { $('fps').value = 10; $('width').value = 480; }
  if (p === 'low') { $('fps').value = 8; $('width').value = 360; }
  if (p === 'emoji') { $('fps').value = 12; $('width').value = 320; }
}

// 使用原视频参数：宽高直接使用视频的 natural size，尝试估算帧率
async function useOriginalParams() {
  const fileInput = $('fileInput');
  const url = $('urlInput').value.trim();
  const file = fileInput.files && fileInput.files[0];
  if (!file && !url) { setStatus('请先选择本地文件或输入远程 URL 再使用原视频参数'); return; }

  setStatus('正在读取视频元数据...');
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';

  let revoke = null;
  if (file) { revoke = URL.createObjectURL(file); video.src = revoke; }
  else video.src = url;

  try {
    await videoLoaded(video);
  } catch (err) {
    setStatus('无法读取视频元数据：' + err.message);
    if (revoke) URL.revokeObjectURL(revoke);
    return;
  }

  // 设置宽高
  $('width').value = video.videoWidth || $('width').value;
  // 使用视频原始高度（不再使用 -1 自动模式）
  $('height').value = video.videoHeight || $('height').value;

  // 尝试估算帧率：优先使用 requestVideoFrameCallback，如果不可用则回退到无法估算
  const estimated = await estimateFps(video);
  if (estimated) {
    $('fps').value = Math.round(estimated);
    log('已估算原始帧率：' + estimated.toFixed(2) + ' fps');
    setStatus('已应用原视频参数（包含估算帧率）');
  } else {
    setStatus('已应用原视频分辨率（帧率无法估算，保留当前 FPS）');
  }

  if (revoke) URL.revokeObjectURL(revoke);
}

// 估算视频帧率：使用 requestVideoFrameCallback（现代浏览器）或返回 null
function estimateFps(video) {
  return new Promise((resolve) => {
    if (typeof video.requestVideoFrameCallback !== 'function') {
      resolve(null);
      return;
    }

    let times = [];
    let attempts = 0;
    const maxAttempts = 10;

    const cb = (now, metadata) => {
      times.push(metadata.presentedFrames != null ? metadata.expectedDisplayTime || now : now);
      if (times.length >= 2) {
        const dt = times[1] - times[0];
        if (dt > 0) {
          resolve(1000 / dt);
          return;
        }
      }
      attempts++;
      if (attempts > maxAttempts) {
        resolve(null);
        return;
      }
      try { video.requestVideoFrameCallback(cb); } catch (e) { resolve(null); }
    };

    // 尝试触发 callbacks: play briefly muted if paused
    const wasPaused = video.paused;
    const cleanup = () => { try { video.pause(); } catch (_) {} };
    video.requestVideoFrameCallback(cb);
    // If paused, try a short play so frames are delivered
    if (wasPaused) {
      const p = video.play();
      if (p && p.catch) p.catch(() => {});
      setTimeout(() => { cleanup(); }, 500);
    }
    // safety timeout
    setTimeout(() => resolve(null), 1200);
  });
}

function reset() {
  $('fileInput').value = '';
  $('urlInput').value = '';
  $('fps').value = 10;
  $('quality').value = 1;
  $('qualityValue').textContent = '1%';
  $('width').value = 480;
  $('height').value = -1;
  $('startTime').value = '';
  $('duration').value = '';
  $('result').innerHTML = '';
  $('log').textContent = '';
  setStatus('已重置');
}

async function analyzeVideoFromUrl() {
  const url = $('urlInput').value.trim();
  if (!url) return;
  setStatus('尝试分析远程视频并自动填充参数（CORS 可能限制）。');
  log('分析 URL: ' + url);
  try {
    await applyOriginalParamsForSource(url);
    $('convertBtn').disabled = false;
  } catch (e) {
    log('分析远程视频失败：' + e.message);
    setStatus('分析远程视频失败（可能为 CORS 限制）。你仍然可以尝试开始转换。');
    $('convertBtn').disabled = false;
  }
}

// 通用：根据文件对象或远程 URL 读取视频并自动填入参数
async function applyOriginalParamsForSource(source) {
  // source 可以是 File 对象或 URL 字符串
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';

  let revokeUrl = null;
  if (typeof source === 'string') {
    video.src = source;
    log('applyOriginalParams: 使用远程 URL ' + source);
  } else if (source instanceof File) {
    const blobUrl = URL.createObjectURL(source);
    revokeUrl = blobUrl;
    video.src = blobUrl;
    log('applyOriginalParams: 使用本地文件 ' + source.name);
  } else {
    throw new Error('Unsupported source for applyOriginalParams');
  }

  try {
    await videoLoaded(video);
  } catch (err) {
    if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    throw err;
  }

  // 填充尺寸
  const w = video.videoWidth || parseInt($('width').value, 10) || 480;
  const h = video.videoHeight || parseInt($('height').value, 10) || -1;
  $('width').value = w;
  $('height').value = h;

  // 估算帧率
  const estimated = await estimateFps(video);
  if (estimated) {
    $('fps').value = Math.round(estimated);
    log('applyOriginalParams: 估算帧率 ' + estimated.toFixed(2) + ' fps');
    setStatus('已自动填充原视频参数（包含帧率）');
  } else {
    setStatus('已自动填充原视频分辨率（帧率无法估算）');
  }

  if (revokeUrl) URL.revokeObjectURL(revokeUrl);
}

async function convert() {
  const fileInput = $('fileInput');
  const url = $('urlInput').value.trim();
  const file = fileInput.files && fileInput.files[0];

  if (!file && !url) { setStatus('请提供文件或 URL'); return; }
  // 检查目标格式的可用性。GIF 已被移除（gif.js），请使用 webp/avif/jpeg/png/jxl/qoi 等由 jSquash 提供的格式。
  const desiredFormat = $('format').value;
  if (desiredFormat === 'gif') {
    setStatus('GIF 输出已不再受支持；请选择 WebP/AVIF/JPEG/PNG/JXL/QOI 等格式。');
    return;
  }
  let moduleAvailable = (window.jSquashModules && window.jSquashModules[desiredFormat]) || (window.jSquashModule && (typeof window.jSquashModule.encode === 'function' || window.jSquashModule[desiredFormat]));
  if (!moduleAvailable) {
    // 在尝试转换前尽量自动加载所需模块以提高成功率
    setStatus('正在尝试加载所需的 jSquash 模块：' + desiredFormat + ' …');
    log('模块 ' + desiredFormat + ' 尚未加载，尝试动态加载官方模块');
    try {
      await loadDefaultJsquashModules();
      try { refreshModuleStatus(); } catch (e) { /* ignore */ }
      moduleAvailable = (window.jSquashModules && window.jSquashModules[desiredFormat]) || (window.jSquashModule && (typeof window.jSquashModule.encode === 'function' || window.jSquashModule[desiredFormat]));
    } catch (e) {
      console.warn('动态加载默认 jSquash 模块失败：', e.message || e);
    }
    if (!moduleAvailable) {
      setStatus('编码器未加载：' + desiredFormat + '。请点击“刷新模块状态”或确保网络/CDN 可用后重试。');
      $('convertBtn').disabled = false;
      return;
    }
  }

  setStatus('准备转换...');
  $('convertBtn').disabled = true;

  // 创建 video 元素
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';

  let revokeUrl = null;
  if (file) {
    const blobUrl = URL.createObjectURL(file);
    revokeUrl = blobUrl;
    video.src = blobUrl;
    log(`使用本地文件：${file.name}`);
  } else {
    video.src = url;
    log(`使用远程 URL：${url}`);
  }

  try {
    await videoLoaded(video);
  } catch (err) {
    setStatus('视频加载失败：' + err.message);
    $('convertBtn').disabled = false;
    if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    return;
  }

  const fps = Math.max(1, parseInt($('fps').value || '10', 10));
  const start = parseFloat($('startTime').value || '0');
  const durationVal = $('duration').value ? parseFloat($('duration').value) : (video.duration - start);
  const end = Math.min(video.duration, start + durationVal);

  // 计算尺寸
  const targetW = parseInt($('width').value, 10) || video.videoWidth;
  let targetH = parseInt($('height').value, 10);
  if (targetH <= 0) {
    targetH = Math.round(targetW * (video.videoHeight / video.videoWidth));
  }

  setStatus(`视频就绪：时长 ${video.duration.toFixed(2)}s，采样 ${fps} fps，输出 ${targetW}x${targetH}`);

  // 创建画布
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  // 多次使用 getImageData 时设置 willReadFrequently 可提高性能并消除控制台警告
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // 逐帧采集并构造帧数组（用于 jSquash 编码）
  const frameInterval = 1 / fps;
  let t = start;
  const maxFrames = Math.ceil((end - start) * fps);
  log('将采集约 ' + maxFrames + ' 帧');

  const frames = [];
  for (let i = 0; t < end - 1e-6; i++) {
    try {
      await seekTo(video, start + i * frameInterval);
    } catch (err) {
      console.warn('seek 错误，跳过帧', err);
      break;
    }
    ctx.drawImage(video, 0, 0, targetW, targetH);
    const im = ctx.getImageData(0, 0, targetW, targetH);
    frames.push({ data: im.data.slice(0), width: targetW, height: targetH, delay: Math.round(1000 / fps) });
    log('已采集帧 ' + (i + 1));
    t = start + (i + 1) * frameInterval;
    if (i > 2000) { log('达到采集帧上限，停止'); break; }
  }

  // 如果采集了多帧但所选格式/模块不支持多帧编码，则中断并提示用户
  if (frames.length > 1 && !supportsMultiFrame(desiredFormat)) {
    setStatus('所选格式或其已加载模块不支持多帧动画：' + desiredFormat + '。请选择支持动画的格式（例如 WebP/AVIF）或点击“刷新模块状态”加载支持的模块。');
    log('Abort: desired format does not support multi-frame encoding: ' + desiredFormat);
    $('convertBtn').disabled = false;
    if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    return;
  }

  setStatus('开始使用 jSquash 编码（不使用 gif.js）...');
  try {
    const format = $('format').value;
    const out = await encodeWithJsquash(frames, format, { quality: parseInt($('quality').value || '1', 10) });
    if (!out) throw new Error('jSquash 未返回有效数据');

    let blob;
    if (out instanceof Blob) blob = out;
    else if (out instanceof Uint8Array) blob = new Blob([out.buffer], { type: mimeTypeFor(format) });
    else if (out instanceof ArrayBuffer) blob = new Blob([out], { type: mimeTypeFor(format) });
    else throw new Error('未知的 jSquash 输出类型');

    const outUrl = URL.createObjectURL(blob);
    setStatus('jSquash 编码完成');
    showResult(outUrl);
      log('Generated ' + format.toUpperCase() + ' size: ' + blob.size + ' bytes');
  } catch (err) {
    console.error(err);
    setStatus('jSquash 编码失败：' + err.message);
    log(err.stack || err.message);
  } finally {
    $('convertBtn').disabled = false;
    if (revokeUrl) URL.revokeObjectURL(revokeUrl);
  }
}

function mimeTypeFor(format) {
  switch (format) {
    case 'webp': return 'image/webp';
    case 'avif': return 'image/avif';
    case 'jpeg': return 'image/jpeg';
    case 'jxl': return 'image/jxl';
    case 'png': case 'oxipng': return 'image/png';
    case 'qoi': return 'application/octet-stream';
    default: return 'application/octet-stream';
  }
}

// 尝试加载 jSquash bundle（用户在页面输入 URL）
async function loadJsquash(url) {
  if (!url) throw new Error('需要 jSquash bundle URL');
  setStatus('正在加载 jSquash：' + url);
  log('加载 jSquash: ' + url);

  try {
    // 尝试 ESM 动态导入
    const mod = await import(/* @vite-ignore */ url);
    window.jSquashModule = mod.default || mod;
    setStatus('jSquash 已通过 ESM 加载');
    log('jSquash 模块（ESM）加载成功');
    return window.jSquashModule;
  } catch (e) {
    // 回退：通过 script 标签加载（期望挂载到 window.jSquash）
    log('ESM 导入失败，尝试通过 script 标签加载：' + e.message);
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('脚本加载失败'));
      document.head.appendChild(s);
    });
    if (window.jSquash) {
      window.jSquashModule = window.jSquash;
      setStatus('jSquash 已通过全局变量加载');
      log('jSquash 全局加载成功');
      return window.jSquashModule;
    }
    throw new Error('加载 jSquash 后未找到导出（请确认 bundle 在浏览器环境下导出全局或为 ESM）');
  }
}

// 通用适配器：根据常见的 jSquash 浏览器 API 做尝试性调用
async function encodeWithJsquash(frames, format, opts) {
  const js = window.jSquashModule;

  // 构造输入对象：{ width, height, frames: [Uint8Array], delays: [] }
  const width = frames[0].width;
  const height = frames[0].height;
  const frameBuffers = frames.map(f => (f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data.buffer || f.data)));
  const delays = frames.map(f => f.delay || 100);

  // 优先使用按格式加载的模块（来自 @jsquash/* 官方包）
  if (window.jSquashModules && window.jSquashModules[format]) {
    const mod = window.jSquashModules[format];
    const adapter = (window.jSquashAdapters && window.jSquashAdapters[format]) || {};
    // 优先使用明确支持多帧的接口
    if (adapter.hasEncodeFrames) {
      try { return await mod.encodeFrames(frameBuffers, { width, height, delays, quality: opts.quality }); } catch (e) { log('adapter encodeFrames failed: ' + e.message); }
    }
    // 如果模块被探测为可编码多帧（heuristic），尝试使用 encode with frames
    if (adapter.encodesMultiple && typeof mod.encode === 'function') {
      try { return await mod.encode(frameBuffers, { width, height, delays, quality: opts.quality }); } catch (e) { log('adapter encode(frames) failed: ' + e.message); }
    }
    // 退回到单帧 encode：尝试多种常见调用签名以兼容不同模块实现
    if (adapter.hasEncode) {
      const encoder = (typeof mod.encode === 'function') ? mod.encode : (mod.default && mod.default.encode);
      if (encoder) {
        const tryCalls = [
          // raw Uint8Array + opts
          async () => encoder(frameBuffers[0], { width, height, quality: opts.quality }),
          // ArrayBuffer view
          async () => encoder(frameBuffers[0].buffer || frameBuffers[0], { width, height, quality: opts.quality }),
          // object with data+size
          async () => encoder({ data: frameBuffers[0], width, height }, { quality: opts.quality }),
          // frames container (some encoders accept frames even for single-frame)
          async () => encoder({ width, height, frames: frameBuffers, delays }, { quality: opts.quality }),
        ];
        for (const fn of tryCalls) {
          try {
            const res = await fn();
            return res;
          } catch (e) {
            log('adapter single-frame encode attempt failed: ' + (e && e.message) + ' — trying next signature');
          }
        }
        log('Module only supports single-frame encoding but all tried call signatures failed');
      }
    }
  }

  if (!js) throw new Error('Global jSquash bundle not loaded; per-format module attempts either failed or are not supported. See log for details.');

  // 一：通用 encode(frames, format, opts)
  if (typeof js.encode === 'function') {
    try { return await js.encode({ width, height, frames: frameBuffers, delays }, format, opts); } catch (e) { log('js.encode failed: ' + e.message); }
  }

  // 二：模块化命名：js[format].encode
  if (js[format] && typeof js[format].encode === 'function') {
    try { return await js[format].encode({ width, height, frames: frameBuffers, delays }, opts); } catch (e) { log('js[format].encode failed: ' + e.message); }
  }

  // 三：单图编码接口（仅支持第一帧），例如 js.encodeImage
  if (typeof js.encodeImage === 'function') {
    try { return await js.encodeImage(frameBuffers[0], { width, height, format, quality: opts.quality }); } catch (e) { log('js.encodeImage failed: ' + e.message); }
  }

  // 四：如果 js 有一个 encodeFrames 方法
  if (typeof js.encodeFrames === 'function') {
    try { return await js.encodeFrames(frameBuffers, { width, height, delays, format, quality: opts.quality }); } catch (e) { log('js.encodeFrames failed: ' + e.message); }
  }

  throw new Error('No compatible jSquash encode interface found; check bundle API');
}

// 检查某个格式是否支持多帧（动画）编码
function supportsMultiFrame(format) {
  // 优先检查按格式加载的模块（来自 @jsquash/* 官方包）
  const modules = window.jSquashModules || {};
  if (modules[format]) {
    const mod = modules[format];
    // 如果模块显式提供 encodeFrames，则支持多帧
    if (typeof mod.encodeFrames === 'function') return true;
    // 如果模块导出 encode，则很可能支持 frames 参数（乐观假设），尝试视作支持多帧
    if (typeof mod.encode === 'function' || (mod.default && typeof mod.default.encode === 'function')) return true;
  }

  // 其次查适配器（可能由 earlier probe 填充）
  const adapters = window.jSquashAdapters || {};
  if (adapters[format]) {
    const a = adapters[format];
    if (a.hasEncodeFrames) return true;
    if (a.encodesMultiple) return true;
  }

  // 最后检查全局 jSquash bundle 是否提供多帧接口
  const js = window.jSquashModule || window.jSquash;
  if (js) {
    if (typeof js.encodeFrames === 'function') return true;
    if (typeof js.encode === 'function') {
      if (js.encode.length >= 2) return true;
    }
    if (js[format] && typeof js[format].encode === 'function') return true;
  }

  return false;
}

function videoLoaded(video) {
  return new Promise((resolve, reject) => {
    const onError = (e) => { cleanup(); reject(new Error('视频加载错误')); };
    const onLoaded = () => { cleanup(); resolve(); };
    function cleanup() {
      video.removeEventListener('error', onError);
      video.removeEventListener('loadedmetadata', onLoaded);
    }
    video.addEventListener('error', onError);
    video.addEventListener('loadedmetadata', onLoaded);
    // 尝试加载
    video.load();
  });
}

function seekTo(video, time) {
  return new Promise((resolve, reject) => {
    function onSeeked() { cleanup(); resolve(); }
    function onError() { cleanup(); reject(new Error('seek 失败')); }
    function cleanup() {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    }
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    // clamp time
    const t = Math.min(Math.max(0, time), video.duration - 0.001);
    try { video.currentTime = t; } catch (e) { cleanup(); reject(e); }
    // 在某些浏览器中设置 currentTime 不会立即触发 seeked，seeked 事件会在可用时触发
  });
}

// 绑定 UI
document.addEventListener('DOMContentLoaded', () => {
  $('quality').addEventListener('input', (e) => { $('qualityValue').textContent = e.target.value + '%'; });
  $('urlInput').addEventListener('input', (e) => { $('analyzeBtn').disabled = !e.target.value.trim(); });
  $('fileInput').addEventListener('change', (e) => { if (e.target.files && e.target.files.length) $('convertBtn').disabled = false; });
  // 当选择本地文件时，自动填充原视频参数（宽高和尝试估算帧率）
  $('fileInput').addEventListener('change', async (e) => {
    const files = e.target.files;
    if (files && files.length) {
      try {
        await applyOriginalParamsForSource(files[0]);
      } catch (err) {
        console.warn('从本地文件自动填参失败：', err.message);
      }
      $('convertBtn').disabled = false;
    }
  });


  // 不再自动填充或加载不存在的默认 bundle。用户可在输入框提供 bundle URL 并点击“加载 jSquash”。
  // 不再提供手动 bundle URL 输入或自动加载非官方 bundle；
  // 页面会自动尝试加载官方 @jsquash 模块（unpkg ESM）用于常见格式。
  // 异步尝试加载官方 @jsquash 模块（avif/jpeg/jxl/png/webp），非阻塞（仅调用一次）
  (async () => {
    try {
      await loadDefaultJsquashModules();
      log('已尝试加载官方 @jsquash 模块（如可用）');
    } catch (e) {
      console.warn('加载官方 @jsquash 模块时出错：', e.message);
      log('加载官方 @jsquash 模块时出错：' + e.message);
    }
  })();
  // 绑定刷新按钮：刷新 UI 的同时尝试重新加载官方模块
  const refreshBtn = document.getElementById('refreshModulesBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    setStatus('正在刷新并尝试加载官方模块...');
    try {
      await loadDefaultJsquashModules();
      setStatus('模块刷新完成');
      log('刷新并加载官方模块完成');
    } catch (e) {
      console.warn('刷新模块时出错：', e.message || e);
      setStatus('Error refreshing modules: ' + (e.message || e));
      log('Error refreshing modules: ' + (e.message || e));
    }
    try { refreshModuleStatus(); } catch (e) { /* ignore */ }
    refreshBtn.disabled = false;
  });
});

// 为了兼容使用 HTML onclick 的旧式绑定，将主要函数暴露到全局 window 上
window.convert = convert;
window.reset = reset;
window.analyzeVideoFromUrl = analyzeVideoFromUrl;
window.applyPreset = applyPreset;
window.useOriginalParams = useOriginalParams;

export { convert, reset, analyzeVideoFromUrl, applyPreset };
