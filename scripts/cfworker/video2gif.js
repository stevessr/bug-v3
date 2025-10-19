import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

export default {
  async fetch(request, env, ctx) {
    const requestUrl = new URL(request.url);
    
    // 支持根路径和 /api/video2gif 路径
    if (requestUrl.pathname !== '/' && requestUrl.pathname !== '/api/video2gif') {
      return new Response('Not Found', { status: 404 });
    }
    
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // 解析 multipart/form-data
    const formData = await request.formData();
    let inputFile = formData.get('file');
    const url = formData.get('url');
    const fps = formData.get('fps');
    const width = formData.get('width');
    const height = formData.get('height');
    const startTime = formData.get('startTime');
    const duration = formData.get('duration');

    // 若无文件则尝试下载
    if (!inputFile && url) {
      const resp = await fetch(url);
      if (!resp.ok) return new Response('下载失败', { status: 400 });
      inputFile = new File([await resp.arrayBuffer()], 'input.mp4');
    }
    if (!inputFile) return new Response('缺少视频文件', { status: 400 });

    // 初始化 ffmpeg (v0.12.x API)
    const ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
    // Cloudflare Worker 不支持 toBlobURL，直接使用原始 URL
    await ffmpeg.load({
      coreURL: `${baseURL}/ffmpeg-core.js`,
      wasmURL: `${baseURL}/ffmpeg-core.wasm`
    });

    // 写入输入文件
    await ffmpeg.writeFile('input.mp4', await fetchFile(inputFile));

    // 构造参数
    const args = [];
    if (startTime) args.push('-ss', String(startTime));
    args.push('-i', 'input.mp4');
    if (duration) args.push('-t', String(duration));
    const vf = [];
    if (fps) vf.push(`fps=${fps}`);
    if (width) vf.push(`scale=${width}:${height || -1}:flags=lanczos`);
    if (vf.length) args.push('-vf', vf.join(','));
    args.push('-loop', '0', '-f', 'gif', 'output.gif');

    // 执行转码
    await ffmpeg.exec(args);

    // 读取输出
    const data = await ffmpeg.readFile('output.gif');
    return new Response(data, {
      headers: { 'Content-Type': 'image/gif' }
    });
  }
};
