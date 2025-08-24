/* eslint-disable */
// Helpers to initialize ffmpeg-wasm at runtime and convert videos to animated outputs
export async function createAndLoadFFmpeg(): Promise<{ ffmpeg: unknown; mod: unknown }> {
  // Try to dynamically import the ESM package. In dev mode some environments
  // cause Vite HMR to watch the module and trigger reloads; as a fallback
  // we try to load a UMD build from a CDN (unpkg) to avoid HMR side-effects.
  let mod: any = null
  try {
    mod = await import('@ffmpeg/ffmpeg')
  } catch (err) {
    // dynamic import failed (possibly dev HMR oddness). fall back to global script loader
    if (typeof window !== 'undefined') {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = 'https://unpkg.com/@ffmpeg/ffmpeg@0.11.1/dist/ffmpeg.min.js'
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Failed to load ffmpeg UMD from CDN'))
        document.head.appendChild(script)
      })
      // UMD exposes global FFmpeg/createFFmpeg
      mod = (window as any).FFmpeg ? { FFmpeg: (window as any).FFmpeg } : (window as any)
    } else {
      throw err
    }
  }

  const creator = (mod as any).createFFmpeg ?? (mod as any).default?.createFFmpeg ?? (mod as any).FFmpeg ?? (mod as any).default?.FFmpeg
  if (!creator) throw new Error('createFFmpeg not found in module')

  let ffmpeg: any
  try {
    ffmpeg = (creator as any)({ log: true })
  } catch {
    // some builds export a constructor
    ffmpeg = new (creator as any)()
  }

  // load the wasm if available
  try {
    if (typeof ffmpeg.load === 'function') {
      await ffmpeg.load()
      // Check if FS is available after loading
      if (typeof ffmpeg.FS !== 'function' && typeof ffmpeg.FS !== 'object') {
        throw new Error('FFmpeg loaded but FS API is not available')
      }
    }
  } catch (err) {
    throw new Error(`Failed to load FFmpeg: ${err}`)
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
  const inName = `in_${Date.now()}_${nameBase}` + (file.name.match(/\.mp4$|\.webm$/i) ? file.name.match(/\.mp4$|\.webm$/i)![0] : '.mp4')
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
    const creator = (mod && ((mod as any).createFFmpeg ?? (mod as any).default?.createFFmpeg ?? (mod as any).FFmpeg ?? (mod as any).default?.FFmpeg))
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
      const creator = (mod && ((mod as any).createFFmpeg ?? (mod as any).default?.createFFmpeg ?? (mod as any).FFmpeg ?? (mod as any).default?.FFmpeg))
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
  await ffmpegInstance.run('-framerate', String(fps), '-i', 'frame%03d.png', '-vf', `scale=${scale}:-1:flags=lanczos`, outName)

  const outData = ffmpegInstance.FS('readFile', outName)
  const blob = new Blob([outData.buffer], { type: target === 'gif' ? 'image/gif' : 'image/apng' })
  const url = URL.createObjectURL(blob)

  // cleanup
  for (let i = 0; i < files.length; i++) {
    const name = `frame${String(i + 1).padStart(3, '0')}.png`
    try { ffmpegInstance.FS('unlink', name) } catch {}
  }
  try { ffmpegInstance.FS('unlink', outName) } catch {}

  return { url, name: outName }
}
