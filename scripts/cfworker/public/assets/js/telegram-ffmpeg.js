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
        // forward to console and optional UI callback
        if (message && (message.toLowerCase().includes('error') || message.toLowerCase().includes('fail'))) {
          console.error(`[FFmpeg] ${message}`);
        } else {
          console.log(`[FFmpeg] ${message}`);
        }
        try {
          if (window.TelegramFFmpeg && typeof window.TelegramFFmpeg._onLog === 'function') {
            window.TelegramFFmpeg._onLog(String(message));
          }
        } catch (e) {
          console.warn('Error forwarding FFmpeg log to UI callback', e);
        }
      });

      ffmpeg.on('progress', ({ progress, time }) => {
        console.log(`FFmpeg conversion progress: ${(progress * 100).toFixed(2)}%`);
        try {
          if (window.TelegramFFmpeg && typeof window.TelegramFFmpeg._onProgress === 'function') {
            window.TelegramFFmpeg._onProgress({ progress, time });
          }
        } catch (e) {
          console.warn('Error forwarding FFmpeg progress to UI callback', e);
        }
      });

  const localBase = '/assets/ffmpeg';
  // Use the same core version as bundled in assets (0.12.10) to avoid API/runtime mismatches
  const cdnBase = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';

      let wasmURL = `${localBase}/ffmpeg-core.wasm`;
      try {
        // First try a HEAD to see if the resource exists and has a wasm-like content-type
        const headResp = await fetch(wasmURL, { method: 'HEAD' });
        if (headResp.ok) {
          const ctype = headResp.headers.get('content-type') || '';
          // If server reports wasm content-type, accept it
          if (/application\/wasm/i.test(ctype)) {
            // keep local wasmURL
          } else {
            // Content-Type is not wasm (could be HTML fallback). Try to fetch only first 4 bytes
            try {
              const rangeResp = await fetch(wasmURL, { method: 'GET', headers: { Range: 'bytes=0-3' } });
              if (rangeResp.ok) {
                const ab = await rangeResp.arrayBuffer();
                if (ab && ab.byteLength >= 4) {
                  const dv = new DataView(ab);
                  // wasm magic: 0x00 0x61 0x73 0x6d
                  if (!(dv.getUint8(0) === 0x00 && dv.getUint8(1) === 0x61 && dv.getUint8(2) === 0x73 && dv.getUint8(3) === 0x6d)) {
                    // not wasm
                    wasmURL = `${cdnBase}/ffmpeg-core.wasm`;
                  }
                } else {
                  wasmURL = `${cdnBase}/ffmpeg-core.wasm`;
                }
              } else {
                wasmURL = `${cdnBase}/ffmpeg-core.wasm`;
              }
            } catch (e) {
              // Range request failed or returned non-wasm
              wasmURL = `${cdnBase}/ffmpeg-core.wasm`;
            }
          }
        } else {
          wasmURL = `${cdnBase}/ffmpeg-core.wasm`;
        }
      } catch (e) {
        wasmURL = `${cdnBase}/ffmpeg-core.wasm`;
      }

      // Log which wasm URL we're using to help debugging CDN vs local issues
      console.log('FFmpeg: using wasmURL =', wasmURL);
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

      // Attach a temporary progress forwarder that includes stickerIndex context
      const progressHandler = ({ progress, time }) => {
        try {
          if (window.TelegramFFmpeg && typeof window.TelegramFFmpeg._onProgress === 'function') {
            window.TelegramFFmpeg._onProgress({ stickerIndex, totalStickers, progress, time });
          }
        } catch (e) {
          console.warn('Error in progressHandler:', e);
        }
      };
      if (ffmpeg && typeof ffmpeg.on === 'function') {
        ffmpeg.on('progress', progressHandler);
      }

      const execResult = await ffmpeg.exec([
        '-i', 'input.webm',
        '-c:v', 'libwebp_anim',
        '-lossless', '0',
        '-q:v', '100',
        '-compression_level', '6',
        '-f', 'webp',
        '-y',
        'output.webp'
      ]);

      // remove temporary progress handler if off is supported
      try {
        if (ffmpeg && typeof ffmpeg.off === 'function') {
          ffmpeg.off('progress', progressHandler);
        }
      } catch (e) {
        // ignore
      }

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

  // Convert a series of image frames (Uint8Array or ArrayBuffer per frame) to animated WebP
  // frames: Array of ArrayBuffer/Uint8Array/Blob
  // fps: frames per second (optional, default 30)
  async function convertTGStoWebP(frames, stickerIndex = null, totalStickers = 0, fps = 30) {
    if (ffmpegFailed) {
      console.debug('FFmpeg permanently failed, cannot convert TGS');
      return null;
    }

    if (!ffmpegLoaded || !ffmpeg || !ffmpeg.loaded) {
      if (!(await initFFmpeg())) {
        console.warn('FFmpeg not available for TGS conversion');
        return null;
      }
    }

    if (!ffmpeg || !ffmpeg.loaded) {
      console.warn('FFmpeg not properly loaded for TGS conversion');
      return null;
    }

    try {
      // Write each frame to the FFmpeg FS as frameNNN.png
      for (let i = 0; i < frames.length; i++) {
        const name = `frame${String(i).padStart(3, '0')}.png`;
        let data = frames[i];
        if (data instanceof Blob) data = await data.arrayBuffer();
        if (data instanceof ArrayBuffer) data = new Uint8Array(data);
        else if (!(data instanceof Uint8Array)) data = new Uint8Array(data);
        await ffmpeg.writeFile(name, data);
      }

      // progress handler forwarding sticker context
      const progressHandler = ({ progress, time }) => {
        try {
          if (window.TelegramFFmpeg && typeof window.TelegramFFmpeg._onProgress === 'function') {
            window.TelegramFFmpeg._onProgress({ stickerIndex, totalStickers, progress, time });
          }
        } catch (e) {
          console.warn('Error in progressHandler for TGS:', e);
        }
      };
      if (ffmpeg && typeof ffmpeg.on === 'function') ffmpeg.on('progress', progressHandler);

      // Build ffmpeg arguments to take sequential images and encode animated webp
      // using libwebp_anim. Use -framerate to set input FPS.
      const inputPattern = 'frame%03d.png';
      const args = [
        '-framerate', String(fps),
        '-i', inputPattern,
        '-c:v', 'libwebp_anim',
        '-lossless', '0',
        '-q:v', '100',
        '-compression_level', '6',
        '-f', 'webp',
        '-y',
        'output.webp'
      ];

      // Run ffmpeg.exec with a timeout safeguard to avoid indefinite hangs in wasm
      const execPromise = (async () => {
        try {
          return await ffmpeg.exec(args)
        } catch (e) {
          console.error('FFmpeg exec threw:', e)
          throw e
        }
      })()

      const TIMEOUT_MS = 90000; // 90s timeout for encoding; adjust if needed

      let execResult
      try {
        execResult = await Promise.race([
          execPromise,
          new Promise((_, rej) => setTimeout(() => rej(new Error('FFmpeg exec timeout')), TIMEOUT_MS))
        ])
      } catch (raceErr) {
        console.warn('FFmpeg exec promise race failed or timed out:', raceErr)
        // try to read partial output if any
        try {
          const maybe = await ffmpeg.readFile('output.webp')
          if (maybe && maybe.length) {
            console.warn('Found partial output.webp after timeout')
            const webpBlob = new Blob([maybe], { type: 'image/webp' })
            try { await ffmpeg.deleteFile('output.webp') } catch (e) { /* ignore */ }
            try { if (ffmpeg && typeof ffmpeg.off === 'function') ffmpeg.off('progress', progressHandler); } catch (e) { /* ignore */ }
            // cleanup frames
            try {
              for (let i = 0; i < frames.length; i++) {
                await ffmpeg.deleteFile(`frame${String(i).padStart(3, '0')}.png`);
              }
            } catch (cleanupErr) { /* ignore */ }
            return webpBlob
          }
        } catch (readErr) {
          console.warn('Could not read output.webp after timeout:', readErr)
        }
        try { if (ffmpeg && typeof ffmpeg.off === 'function') ffmpeg.off('progress', progressHandler); } catch (e) { /* ignore */ }
        // As a last resort, return null to indicate failure/timeout
        return null
      }

      try {
        if (ffmpeg && typeof ffmpeg.off === 'function') ffmpeg.off('progress', progressHandler);
      } catch (e) {
        // ignore
      }

      if (execResult !== 0 && execResult !== undefined) {
        console.warn('FFmpeg exec returned error code for TGS conversion:', execResult);
        // cleanup frames
        try {
          for (let i = 0; i < frames.length; i++) {
            await ffmpeg.deleteFile(`frame${String(i).padStart(3, '0')}.png`);
          }
        } catch (cleanupErr) { /* ignore */ }
        return null;
      }

      const webpData = await ffmpeg.readFile('output.webp');
      const webpBlob = new Blob([webpData], { type: 'image/webp' });

      // cleanup temporary files
      try {
        await ffmpeg.deleteFile('output.webp');
        for (let i = 0; i < frames.length; i++) {
          await ffmpeg.deleteFile(`frame${String(i).padStart(3, '0')}.png`);
        }
      } catch (cleanupError) {
        console.warn('Error cleaning up ffmpeg files after TGS conversion:', cleanupError);
      }

      return webpBlob;
    } catch (error) {
      console.error('Error converting TGS frames to WebP:', error);
      return null;
    }
  }

  // Expose API on window
  window.TelegramFFmpeg = {
    initFFmpeg,
    convertWebMtoWebP,
    convertTGStoWebP,
    compressData
  };
})();
