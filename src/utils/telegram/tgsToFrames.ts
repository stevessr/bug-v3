export interface TgsRenderedFrames {
  frames: Blob[]
  fps: number
  width: number
  height: number
}

const cleanupContainer = (container: HTMLDivElement) => {
  try {
    container.remove()
  } catch {
    // ignore
  }
}

export async function gunzipTgsBlob(blob: Blob): Promise<ArrayBuffer> {
  if (typeof DecompressionStream === 'function') {
    const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'))
    return await new Response(stream).arrayBuffer()
  }

  throw new Error('当前环境不支持 .tgs gzip 解压')
}

async function captureCanvasAsPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('Failed to capture TGS frame as PNG'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })
}

export async function renderTgsToPngFrames(
  tgsBlob: Blob,
  options: {
    maxFrames?: number
    signal?: AbortSignal
  } = {}
): Promise<TgsRenderedFrames> {
  const arrayBuffer = await gunzipTgsBlob(tgsBlob)
  const jsonText = new TextDecoder('utf-8').decode(arrayBuffer)
  const animationJson = JSON.parse(jsonText) as {
    fr?: number
    ip?: number
    op?: number
    w?: number
    h?: number
  }

  const lottieModule = await import('lottie-web')
  const lottie = lottieModule.default ?? lottieModule

  return await new Promise<TgsRenderedFrames>((resolve, reject) => {
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.left = '-99999px'
    container.style.top = '-99999px'
    container.style.pointerEvents = 'none'
    container.style.width = `${animationJson.w || 512}px`
    container.style.height = `${animationJson.h || 512}px`
    document.body.appendChild(container)

    const fps = animationJson.fr || 30
    const startFrame = typeof animationJson.ip === 'number' ? animationJson.ip : 0
    const endFrame = typeof animationJson.op === 'number' ? animationJson.op : startFrame + fps * 3
    const totalFrames = Math.max(1, endFrame - startFrame)
    const maxFrames = Math.max(1, options.maxFrames ?? 120)
    const step = Math.max(1, Math.ceil(totalFrames / maxFrames))
    const frameNumbers: number[] = []
    for (let frame = startFrame; frame < endFrame; frame += step) {
      frameNumbers.push(frame)
    }

    const animation = lottie.loadAnimation({
      container,
      renderer: 'canvas',
      loop: false,
      autoplay: false,
      animationData: animationJson,
      rendererSettings: {
        preserveAspectRatio: 'xMidYMid meet',
        clearCanvas: true
      }
    })

    const fail = (error: unknown) => {
      try {
        animation.destroy()
      } catch {
        // ignore
      }
      cleanupContainer(container)
      reject(error)
    }

    const onLoaded = async () => {
      try {
        const canvas = container.querySelector('canvas')
        if (!canvas) {
          throw new Error('Lottie canvas not found for TGS rendering')
        }

        const frames: Blob[] = []
        for (const frameNumber of frameNumbers) {
          if (options.signal?.aborted) {
            throw new DOMException('TGS rendering aborted', 'AbortError')
          }

          animation.goToAndStop(frameNumber, true)
          await new Promise<void>(resolveFrame => requestAnimationFrame(() => resolveFrame()))
          frames.push(await captureCanvasAsPng(canvas))
        }

        animation.destroy()
        cleanupContainer(container)

        resolve({
          frames,
          fps: Math.max(1, Math.round(fps / step)),
          width: canvas.width || animationJson.w || 512,
          height: canvas.height || animationJson.h || 512
        })
      } catch (error) {
        fail(error)
      }
    }

    animation.addEventListener('DOMLoaded', onLoaded)
    setTimeout(() => {
      if (!container.querySelector('canvas')) {
        return
      }
      void onLoaded()
    }, 250)
  })
}
