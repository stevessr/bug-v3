function el(id){ return document.getElementById(id); }
function logTo(elem, html){ elem.innerHTML += html + '\n'; }

function code(s){ return `<code>${s}</code>`; }
function pill(ok){ return `<span style="padding:2px 6px;border-radius:10px;background:${ok?'#d1fae5':'#fee2e2'};color:${ok?'#065f46':'#991b1b'};font-size:12px;">${ok?'支持':'不支持'}</span>`; }

async function detect(){
  const summaryEl = el('summary');
  const detailsEl = el('details');

  const ua = navigator.userAgent;
  const platform = navigator.platform || 'unknown';
  const lang = navigator.language || 'unknown';

  const hasWebCodecsNS = 'VideoDecoder' in window || 'VideoEncoder' in window || 'ImageDecoder' in window || 'ImageEncoder' in window || 'AudioDecoder' in window || 'AudioEncoder' in window;
  const hasImageEncoder = 'ImageEncoder' in window;
  const hasCreateImageBitmap = 'createImageBitmap' in window;
  const hasOffscreenCanvas = 'OffscreenCanvas' in window;

  // Canvas WebP 支持
  const canvas = document.createElement('canvas');
  const canWebP = canvas.toDataURL && canvas.toDataURL('image/webp').startsWith('data:image/webp');

  // ImageEncoder.isConfigSupported 检测
  async function testImageSupport(mime){
    if (!hasImageEncoder || typeof ImageEncoder.isConfigSupported !== 'function') return {supported:false, error:'ImageEncoder 或 isConfigSupported 不可用'};
    try{
      const conf = { type: mime, quality: 0.8, width: 2, height: 2 };
      const res = await ImageEncoder.isConfigSupported(conf);
      return { supported: !!res?.supported, config: res?.config };
    }catch(e){
      return { supported:false, error: e.message || String(e) };
    }
  }

  // VideoEncoder/Decoder 配置支持（部分浏览器实现）
  async function testVideoCodec(codec){
    if (!('VideoEncoder' in window) || typeof VideoEncoder.isConfigSupported !== 'function') return {supported:false, error:'VideoEncoder.isConfigSupported 不可用'};
    try{
      const res = await VideoEncoder.isConfigSupported({ codec, width: 16, height: 16, bitrate: 1_000, framerate: 30 });
      return { supported: !!res?.supported, config: res?.config };
    }catch(e){ return { supported:false, error: e.message || String(e) }; }
  }

  async function testAudioCodec(codec){
    if (!('AudioEncoder' in window) || typeof AudioEncoder.isConfigSupported !== 'function') return {supported:false, error:'AudioEncoder.isConfigSupported 不可用'};
    try{
      const res = await AudioEncoder.isConfigSupported({ codec, sampleRate: 48000, numberOfChannels: 2, bitrate: 64_000 });
      return { supported: !!res?.supported, config: res?.config };
    }catch(e){ return { supported:false, error: e.message || String(e) }; }
  }

  // 执行检测
  const [imgAvif, imgWebp, vAv1, vVp9, vH264, aOpus, aAac] = await Promise.all([
    testImageSupport('image/avif'),
    testImageSupport('image/webp'),
    testVideoCodec('av01.0.04M.08'),
    testVideoCodec('vp09.00.10.08'),
    testVideoCodec('avc1.42001E'),
    testAudioCodec('opus'),
    testAudioCodec('mp4a.40.2')
  ]);

  // 概览
  summaryEl.innerHTML = `
    <p>WebCodecs 命名空间：${pill(hasWebCodecsNS)}</p>
    <p>ImageEncoder：${pill(hasImageEncoder)}</p>
    <p>Canvas WebP：${pill(canWebP)}</p>
    <p>createImageBitmap：${pill(hasCreateImageBitmap)}</p>
    <p>OffscreenCanvas：${pill(hasOffscreenCanvas)}</p>
    <hr>
    <p>UA：${code(ua)}</p>
    <p>Platform：${code(platform)} | Language：${code(lang)}</p>
  `;

  function block(title, rows){
    const list = rows.map(r=>`<tr><td>${r.name}</td><td>${pill(r.ok)}</td><td><pre style="white-space:pre-wrap;word-break:break-all;">${r.note || ''}</pre></td></tr>`).join('');
    return `
      <div style="margin:10px 0;">
        <h3 style="margin:0 0 6px;">${title}</h3>
        <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="6">
          <thead><tr><th>项目</th><th>支持</th><th>说明</th></tr></thead>
          <tbody>${list}</tbody>
        </table>
      </div>
    `;
  }

  detailsEl.innerHTML = [
    block('Image 编码能力', [
      { name: 'AVIF (ImageEncoder)', ok: !!imgAvif.supported, note: imgAvif.supported? JSON.stringify(imgAvif.config, null, 2) : (imgAvif.error || '') },
      { name: 'WebP (ImageEncoder)', ok: !!imgWebp.supported, note: imgWebp.supported? JSON.stringify(imgWebp.config, null, 2) : (imgWebp.error || '') },
      { name: 'Canvas toDataURL WebP', ok: canWebP, note: canWebP? 'toDataURL("image/webp") 支持' : '不支持 WebP 数据导出' }
    ]),
    block('Video 编码能力', [
      { name: 'AV1 (av01)', ok: !!vAv1.supported, note: vAv1.supported? JSON.stringify(vAv1.config, null, 2) : (vAv1.error || '') },
      { name: 'VP9 (vp09)', ok: !!vVp9.supported, note: vVp9.supported? JSON.stringify(vVp9.config, null, 2) : (vVp9.error || '') },
      { name: 'H.264 (avc1)', ok: !!vH264.supported, note: vH264.supported? JSON.stringify(vH264.config, null, 2) : (vH264.error || '') }
    ]),
    block('Audio 编码能力', [
      { name: 'Opus', ok: !!aOpus.supported, note: aOpus.supported? JSON.stringify(aOpus.config, null, 2) : (aOpus.error || '') },
      { name: 'AAC (mp4a.40.2)', ok: !!aAac.supported, note: aAac.supported? JSON.stringify(aAac.config, null, 2) : (aAac.error || '') }
    ])
  ].join('');
}

window.addEventListener('DOMContentLoaded', detect);
