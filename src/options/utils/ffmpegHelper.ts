/* eslint-disable */
// Helpers to initialize ffmpeg-wasm at runtime and convert videos to animated outputs
export async function createAndLoadFFmpeg(): Promise<{ ffmpeg: unknown; mod: unknown }> {
  // Try to use the newer @ffmpeg/ffmpeg API first with local files to avoid CSP issues
  let mod: any = null
  try {
    console.log('[FFmpeg] Attempting to import @ffmpeg/ffmpeg (new API)...')
    mod = await import('@ffmpeg/ffmpeg')

    const FFmpeg = mod.FFmpeg || mod.default?.FFmpeg
    if (!FFmpeg) {
      throw new Error('FFmpeg constructor not found in module')
    }

    const ffmpeg = new FFmpeg()

    // Use direct local file URLs to avoid blob URL CSP violations
    const baseURL = chrome.runtime.getURL('js/')

    console.log('[FFmpeg] Loading with direct local file URLs...')
    await ffmpeg.load({
      coreURL: baseURL + 'ffmpeg-core-compat.js',
      wasmURL: baseURL + 'ffmpeg-core.wasm'
      // Note: workerURL is optional, let FFmpeg handle worker creation internally
    })

    console.log('[FFmpeg] FFmpeg loaded successfully with new API using local files')
    return { ffmpeg, mod }
  } catch (err) {
    console.warn('[FFmpeg] New API failed, falling back to legacy approach:', err)
    // Fall back to legacy approach with local files
    try {
      return await createAndLoadFFmpegLegacy()
    } catch (legacyErr) {
      console.error('[FFmpeg] Both new and legacy APIs failed:', { newErr: err, legacyErr })
      throw new Error(`FFmpeg initialization failed: ${legacyErr}`)
    }
  }
}

// Legacy fallback function for older FFmpeg API
async function createAndLoadFFmpegLegacy(): Promise<{ ffmpeg: unknown; mod: unknown }> {
  let mod: any = null

  if (typeof window !== 'undefined') {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      // Use local copy instead of CDN to avoid CSP issues
      script.src = chrome.runtime.getURL('js/ffmpeg-core-compat.js')
      script.onload = () => {
        console.log('[FFmpeg] Compat script loaded successfully')
        resolve()
      }
      script.onerror = () => reject(new Error('Failed to load ffmpeg from local files'))
      document.head.appendChild(script)
    })

    // Wait a bit for the script to fully initialize
    await new Promise(resolve => setTimeout(resolve, 100))

    // Check for available FFmpeg exports
    mod = {
      FFmpeg: (window as any).FFmpeg,
      createFFmpeg: (window as any).createFFmpeg,
      fetchFile: (window as any).fetchFile
    }

    console.log('[FFmpeg] Available exports:', Object.keys(mod))
  }

  // Try to find a creator function
  const creator = mod?.createFFmpeg ?? mod?.FFmpeg
  if (!creator) {
    console.error('[FFmpeg] Available mod properties:', mod ? Object.keys(mod) : 'mod is null')
    throw new Error('createFFmpeg not found in module')
  }

  let ffmpeg: any
  try {
    if (typeof creator === 'function') {
      // Try as constructor first
      try {
        ffmpeg = new creator({ log: true })
      } catch {
        // Try as function
        ffmpeg = creator({ log: true })
      }
    } else {
      throw new Error('Creator is not a function')
    }
  } catch (err) {
    console.error('[FFmpeg] Failed to create instance:', err)
    throw new Error(`Failed to create FFmpeg instance: ${err}`)
  }

  // load the wasm if available
  try {
    if (typeof ffmpeg.load === 'function') {
      console.log('[FFmpeg] Loading FFmpeg...')
      await ffmpeg.load()
      console.log('[FFmpeg] FFmpeg loaded successfully')

      // Check if FS is available after loading
      if (typeof ffmpeg.FS !== 'function' && typeof ffmpeg.FS !== 'object') {
        console.warn('[FFmpeg] FS API is not available, but continuing with mock')
      }
    }
  } catch (err) {
    console.error('[FFmpeg] Load error:', err)
    // Don't throw here for mock implementation
    console.warn('[FFmpeg] Continuing with mock implementation')
  }

  return { ffmpeg, mod }
}

export async function convertVideoToAnimated(
  file: File,
  ffmpegInstance: any,
  mod: any,
  target: 'gif' | 'apng',
  opts?: { fps?: number; scale?: number }
) {
  const nameBase = file.name.replace(/\.[^.]+$/, '')
  const inName =
    `in_${Date.now()}_${nameBase}` +
    (file.name.match(/\.mp4$|\.webm$/i) ? file.name.match(/\.mp4$|\.webm$/i)![0] : '.mp4')
  const outName = `out_${Date.now()}_${nameBase}.${target}`

  // fetchFile helper may not exist on all module shapes
  let data: Uint8Array
  if (mod && typeof (mod as any).fetchFile === 'function') {
    data = await (mod as any).fetchFile(file)
  } else {
    const ab = await file.arrayBuffer()
    data = new Uint8Array(ab)
  }

  // ensure FS helper exists; if missing try to recreate a proper instance from the module
  if (typeof ffmpegInstance.FS !== 'function' && typeof ffmpegInstance.FS !== 'object') {
    // try to construct a fresh ffmpeg using module exports
    const creator =
      mod &&
      ((mod as any).createFFmpeg ??
        (mod as any).default?.createFFmpeg ??
        (mod as any).FFmpeg ??
        (mod as any).default?.FFmpeg)
    if (creator && typeof creator === 'function') {
      try {
        let newInst: any
        try {
          newInst = (creator as any)({ log: true })
        } catch {
          newInst = new (creator as any)()
        }
        if (typeof newInst.load === 'function') await newInst.load()
        // Check again if FS is available after loading
        if (typeof newInst.FS !== 'function' && typeof newInst.FS !== 'object') {
          throw new Error('ffmpeg instance has no FS after loading')
        }
        ffmpegInstance = newInst
      } catch (err) {
        throw new Error(`Failed to initialize ffmpeg instance: ${err}`)
      }
    } else {
      throw new Error('ffmpeg instance has no FS and no creator found')
    }
  }

  ffmpegInstance.FS('writeFile', inName, data)

  const fps = opts?.fps ?? 10
  const scale = opts?.scale ?? 480
  const vf = `fps=${fps},scale=${scale}:-1:flags=lanczos`

  if (target === 'gif') {
    await ffmpegInstance.run('-i', inName, '-vf', vf, '-loop', '0', outName)
  } else {
    await ffmpegInstance.run('-i', inName, '-vf', vf, '-plays', '0', outName)
  }

  const outData = ffmpegInstance.FS('readFile', outName)
  const blob = new Blob([outData.buffer], { type: target === 'gif' ? 'image/gif' : 'image/apng' })
  const url = URL.createObjectURL(blob)

  try {
    ffmpegInstance.FS('unlink', inName)
  } catch {}
  try {
    ffmpegInstance.FS('unlink', outName)
  } catch {}

  return { url, name: `${nameBase}.${target}` }
}

export async function mergeImagesToAnimated(
  files: File[],
  ffmpegInstance: any,
  mod: any,
  target: 'gif' | 'apng',
  opts?: { delay?: number; scale?: number }
) {
  if (!files || files.length === 0) throw new Error('No frames provided')
  const base = `frames_${Date.now()}`
  // write sequential frames frame001.png ...
  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    const idx = String(i + 1).padStart(3, '0')
    const name = `frame${idx}.png`
    let data: Uint8Array
    if (mod && typeof (mod as any).fetchFile === 'function') data = await (mod as any).fetchFile(f)
    else data = new Uint8Array(await f.arrayBuffer())
    // ensure FS exists (some caller-supplied instances may be module objects)
    if (typeof ffmpegInstance.FS !== 'function' && typeof ffmpegInstance.FS !== 'object') {
      const creator =
        mod &&
        ((mod as any).createFFmpeg ??
          (mod as any).default?.createFFmpeg ??
          (mod as any).FFmpeg ??
          (mod as any).default?.FFmpeg)
      if (creator && typeof creator === 'function') {
        try {
          let newInst: any
          try {
            newInst = (creator as any)({ log: true })
          } catch {
            newInst = new (creator as any)()
          }
          if (typeof newInst.load === 'function') await newInst.load()
          // Check again if FS is available after loading
          if (typeof newInst.FS !== 'function' && typeof newInst.FS !== 'object') {
            throw new Error('ffmpeg instance has no FS after loading')
          }
          ffmpegInstance = newInst
        } catch (err) {
          throw new Error(`Failed to initialize ffmpeg instance: ${err}`)
        }
      } else {
        throw new Error('ffmpeg instance has no FS and no creator found')
      }
    }

    ffmpegInstance.FS('writeFile', name, data)
  }

  const delay = opts?.delay ?? 100
  const fps = Math.max(1, Math.round(1000 / delay))
  const scale = opts?.scale ?? 480
  const outName = `${base}.${target}`

  // use image2 pattern
  await ffmpegInstance.run(
    '-framerate',
    String(fps),
    '-i',
    'frame%03d.png',
    '-vf',
    `scale=${scale}:-1:flags=lanczos`,
    outName
  )

  const outData = ffmpegInstance.FS('readFile', outName)
  const blob = new Blob([outData.buffer], { type: target === 'gif' ? 'image/gif' : 'image/apng' })
  const url = URL.createObjectURL(blob)

  // cleanup
  for (let i = 0; i < files.length; i++) {
    const name = `frame${String(i + 1).padStart(3, '0')}.png`
    try {
      ffmpegInstance.FS('unlink', name)
    } catch {}
  }
  try {
    ffmpegInstance.FS('unlink', outName)
  } catch {}

  return { url, name: outName }
}
