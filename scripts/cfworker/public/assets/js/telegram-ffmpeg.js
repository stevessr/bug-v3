// FFmpeg helper module for telegram-sticker-downloader
// Exposes: initFFmpeg(), convertWebMtoWebP(webmBlob, stickerIndex, totalStickers), compressData(data)
(function () {
  let ffmpeg = null;
  let ffmpegLoaded = false;
  let ffmpegFailed = false; // Flag to track if FFmpeg has permanently failed to initialize

  async function initFFmpeg() {
    // If FFmpeg has permanently failed before, don't try again
    if (ffmpegFailed) {
      return false;
    }

    if (ffmpegLoaded) return true;

    try {
      // Dynamically import FFmpeg
      const { FFmpeg } = await import('/assets/ffmpeg/esm/index.js');

      ffmpeg = new FFmpeg();

      ffmpeg.on('log', ({ message }) => {
        if (message.toLowerCase().includes('error') || message.toLowerCase().includes('fail')) {
          console.error(`[FFmpeg] ${message}`);
        }
      });

      ffmpeg.on('progress', ({ progress }) => {
        console.log(`FFmpeg conversion progress: ${(progress * 100).toFixed(2)}%`);
      });

      const localBase = '/assets/ffmpeg';
      const cdnBase = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.2/dist/esm';

      let wasmURL = `${localBase}/ffmpeg-core.wasm`;
      try {
        const response = await fetch(wasmURL, { method: 'HEAD' });
        if (!response.ok) {
          wasmURL = `${cdnBase}/ffmpeg-core.wasm`;
        }
      } catch (e) {
        wasmURL = `${cdnBase}/ffmpeg-core.wasm`;
      }

      await ffmpeg.load({
        coreURL: `${localBase}/ffmpeg-core.js`,
        wasmURL: wasmURL,
        workerURL: `${localBase}/worker.js`
      });

      ffmpegLoaded = true;
      ffmpegFailed = false;
      console.log('FFmpeg initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing FFmpeg:', error);
      ffmpegFailed = true;
      return false;
    }
  }

  // Compress data using the Compression Streams API
  async function compressData(data) {
    if (typeof CompressionStream === 'undefined') {
      console.warn('CompressionStream not supported, returning original data as blob');
      return new Blob([data], { type: 'application/octet-stream' });
    }

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      }
    });

    try {
      const compressionStream = new CompressionStream('gzip');
      const compressedStream = stream.pipeThrough(compressionStream);
      const chunks = [];
      const reader = compressedStream.getReader();
      let done = false;
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) chunks.push(value);
      }
      let totalLength = 0;
      for (const chunk of chunks) totalLength += chunk.length;
      const concatenated = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        concatenated.set(chunk, offset);
        offset += chunk.length;
      }
      return new Blob([concatenated], { type: 'application/gzip' });
    } catch (error) {
      console.error('Error during compression, returning original data as blob:', error);
      return new Blob([data], { type: 'application/octet-stream' });
    }
  }

  // Convert WebM blob to WebP using FFmpeg
  async function convertWebMtoWebP(webmBlob, stickerIndex = null, totalStickers = 0) {
    if (ffmpegFailed) {
      console.debug('FFmpeg permanently failed, returning original blob');
      return webmBlob;
    }

    if (!ffmpegLoaded || !ffmpeg || !ffmpeg.loaded) {
      if (!(await initFFmpeg())) {
        console.warn('FFmpeg not available for conversion, returning original blob');
        return webmBlob;
      }
    }

    if (!ffmpeg || !ffmpeg.loaded) {
      console.warn('FFmpeg is not properly loaded, returning original blob');
      return webmBlob;
    }

    try {
      const webmArrayBuffer = await webmBlob.arrayBuffer();
      await ffmpeg.writeFile('input.webm', new Uint8Array(webmArrayBuffer));

      const execResult = await ffmpeg.exec([
        '-i', 'input.webm',
        '-c:v', 'libwebp_anim',
        '-lossless', '0',
        '-q:v', '85',
        '-compression_level', '6',
        '-f', 'webp',
        '-y',
        'output.webp'
      ]);

      if (execResult !== 0 && execResult !== undefined) {
        console.warn(`FFmpeg exec returned error code: ${execResult}, returning original blob`);
        return webmBlob;
      }

      const webpData = await ffmpeg.readFile('output.webp');
      const webpBlob = new Blob([webpData], { type: 'image/webp' });

      try {
        await ffmpeg.deleteFile('input.webm');
        await ffmpeg.deleteFile('output.webp');
      } catch (cleanupError) {
        console.warn('Error during FFmpeg cleanup:', cleanupError);
      }

      return webpBlob;
    } catch (error) {
      console.error('Error converting WebM to WebP, returning original blob:', error);
      return webmBlob;
    }
  }

  // Expose API on window
  window.TelegramFFmpeg = {
    initFFmpeg,
    convertWebMtoWebP,
    compressData
  };
})();
