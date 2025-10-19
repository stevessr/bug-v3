import express from 'express';
import multer from 'multer';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';
import ffmpegPath from 'ffmpeg-static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const upload = multer({ dest: tmpdir() });

// 静态文件服务（首页）
app.use(express.static(join(__dirname, 'public')));

// API 端点
app.post('/api/video2gif', upload.single('file'), async (req, res) => {
  let inputPath = '';
  const cleanup = [];

  try {
    // 获取视频文件
    if (req.file) {
      inputPath = req.file.path;
      cleanup.push(() => fs.unlink(inputPath));
    } else if (req.body.url) {
      const response = await fetch(req.body.url);
      if (!response.ok) {
        return res.status(400).send('下载视频失败');
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      inputPath = join(tmpdir(), `input-${Date.now()}.mp4`);
      await fs.writeFile(inputPath, buffer);
      cleanup.push(() => fs.unlink(inputPath));
    } else {
      return res.status(400).send('缺少视频文件或 URL');
    }

    // 构造 ffmpeg 参数
    const outputPath = join(tmpdir(), `output-${Date.now()}.gif`);
    cleanup.push(() => fs.unlink(outputPath));

    const args = [];
    if (req.body.startTime) args.push('-ss', req.body.startTime);
    args.push('-i', inputPath);
    if (req.body.duration) args.push('-t', req.body.duration);

    const vf = [];
    if (req.body.fps) vf.push(`fps=${req.body.fps}`);
    if (req.body.width) {
      const height = req.body.height || -1;
      vf.push(`scale=${req.body.width}:${height}:flags=lanczos`);
    }
    if (vf.length) args.push('-vf', vf.join(','));
    args.push('-loop', '0', '-f', 'gif', outputPath);

    // 执行 ffmpeg
    await new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath, args);
      let stderr = '';
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg 失败：${stderr}`));
      });
    });

    // 返回 GIF
    const gif = await fs.readFile(outputPath);
    res.set('Content-Type', 'image/gif');
    res.send(gif);

    // 清理临时文件
    await Promise.all(cleanup.map(fn => fn().catch(() => {})));
  } catch (error) {
    console.error('转码错误：', error);
    res.status(500).send(error.message || '转码失败');
    await Promise.all(cleanup.map(fn => fn().catch(() => {})));
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`视频转 GIF API 运行在 http://localhost:${PORT}`);
});
