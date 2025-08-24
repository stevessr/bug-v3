import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

class AnimationConverter {
  private ffmpeg: FFmpeg
  private isLoaded = false

  constructor() {
    this.ffmpeg = new FFmpeg()
    this.setupFFmpeg()
  }

  private async setupFFmpeg() {
    // Load FFmpeg
    this.ffmpeg.on('log', ({ message }) => {
      console.log(message)
    })

    this.ffmpeg.on('progress', ({ progress }) => {
      const progressBar = document.getElementById('progress-bar') as HTMLElement
      const progressText = document.getElementById('progress-text') as HTMLElement
      if (progressBar && progressText) {
        progressBar.style.width = `${progress * 100}%`
        progressText.textContent = `处理中... ${Math.round(progress * 100)}%`
      }
    })

    try {
      // Use bundled FFmpeg core files
      await this.ffmpeg.load()
      this.isLoaded = true
      console.log('FFmpeg loaded successfully')
    } catch (error) {
      console.error('Failed to load FFmpeg:', error)
    }
  }

  async convertFormat(file: File, outputFormat: string, options: any = {}) {
    if (!this.isLoaded) {
      throw new Error('FFmpeg not loaded yet')
    }

    const fileName = file.name
    const outputFileName = `output.${outputFormat}`

    // Write input file to FFmpeg
    await this.ffmpeg.writeFile(fileName, await fetchFile(file))

    // Build FFmpeg command
    const args = ['-i', fileName]
    
    if (options.fps) {
      args.push('-r', options.fps.toString())
    }
    
    if (options.quality) {
      args.push('-q:v', options.quality.toString())
    }
    
    if (options.width && options.height) {
      args.push('-s', `${options.width}x${options.height}`)
    }

    args.push(outputFileName)

    // Run conversion
    await this.ffmpeg.exec(args)

    // Read output file
    const data = await this.ffmpeg.readFile(outputFileName)
    const blob = new Blob([data], { type: `image/${outputFormat}` })

    return blob
  }

  async splitFrames(file: File) {
    if (!this.isLoaded) {
      throw new Error('FFmpeg not loaded yet')
    }

    const fileName = file.name
    await this.ffmpeg.writeFile(fileName, await fetchFile(file))

    // Extract frames
    await this.ffmpeg.exec(['-i', fileName, 'frame_%04d.png'])

    // Get all frame files
    const files = await this.ffmpeg.listDir('/')
    const frameFiles = files.filter(f => f.name.startsWith('frame_'))
    
    const frames: Blob[] = []
    for (const frameFile of frameFiles) {
      const data = await this.ffmpeg.readFile(frameFile.name)
      frames.push(new Blob([data], { type: 'image/png' }))
    }

    return frames
  }

  async mergeFrames(files: File[], outputFormat: string, fps: number = 10) {
    if (!this.isLoaded) {
      throw new Error('FFmpeg not loaded yet')
    }

    // Write all frame files
    for (let i = 0; i < files.length; i++) {
      const fileName = `frame_${String(i + 1).padStart(4, '0')}.png`
      await this.ffmpeg.writeFile(fileName, await fetchFile(files[i]))
    }

    const outputFileName = `output.${outputFormat}`
    
    // Create animation from frames
    await this.ffmpeg.exec([
      '-framerate', fps.toString(),
      '-i', 'frame_%04d.png',
      '-y',
      outputFileName
    ])

    // Read output
    const data = await this.ffmpeg.readFile(outputFileName)
    return new Blob([data], { type: `image/${outputFormat}` })
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const converter = new AnimationConverter()

  // Tab switching
  const tabButtons = document.querySelectorAll('.tab-btn')
  const tabContents = document.querySelectorAll('.tab-content')

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab')
      
      tabButtons.forEach(btn => btn.classList.remove('active'))
      tabContents.forEach(content => content.classList.remove('active'))
      
      button.classList.add('active')
      document.getElementById(targetTab!)?.classList.add('active')
    })
  })

  // File upload handling
  function setupFileUpload(inputId: string, dropZoneId: string, callback: (file: File) => void) {
    const input = document.getElementById(inputId) as HTMLInputElement
    const dropZone = document.getElementById(dropZoneId) as HTMLElement

    input?.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files
      if (files && files[0]) {
        callback(files[0])
      }
    })

    dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault()
      dropZone.classList.add('drag-over')
    })

    dropZone?.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over')
    })

    dropZone?.addEventListener('drop', (e) => {
      e.preventDefault()
      dropZone.classList.remove('drag-over')
      const files = e.dataTransfer?.files
      if (files && files[0]) {
        callback(files[0])
      }
    })
  }

  // Setup converters
  setupFileUpload('convert-input', 'convert-drop-zone', (file) => {
    const preview = document.getElementById('convert-preview') as HTMLElement
    preview.innerHTML = `<p>已选择文件: ${file.name}</p>`
  })

  setupFileUpload('split-input', 'split-drop-zone', (file) => {
    const preview = document.getElementById('split-preview') as HTMLElement
    preview.innerHTML = `<p>已选择文件: ${file.name}</p>`
  })

  // Convert button
  document.getElementById('convert-btn')?.addEventListener('click', async () => {
    const input = document.getElementById('convert-input') as HTMLInputElement
    const formatSelect = document.getElementById('format-select') as HTMLSelectElement
    const qualityInput = document.getElementById('quality-input') as HTMLInputElement
    const fpsInput = document.getElementById('fps-input') as HTMLInputElement
    const widthInput = document.getElementById('width-input') as HTMLInputElement

    if (!input.files || !input.files[0]) {
      alert('请选择一个文件')
      return
    }

    const file = input.files[0]
    const outputFormat = formatSelect.value
    const options = {
      quality: qualityInput.value,
      fps: fpsInput.value,
      width: widthInput.value ? parseInt(widthInput.value) : undefined,
      height: widthInput.value ? parseInt(widthInput.value) : undefined
    }

    try {
      const result = await converter.convertFormat(file, outputFormat, options)
      
      // Create download link
      const url = URL.createObjectURL(result)
      const a = document.createElement('a')
      a.href = url
      a.download = `converted.${outputFormat}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Conversion failed:', error)
      alert('转换失败: ' + (error as Error).message)
    }
  })

  // Split frames button
  document.getElementById('split-btn')?.addEventListener('click', async () => {
    const input = document.getElementById('split-input') as HTMLInputElement

    if (!input.files || !input.files[0]) {
      alert('请选择一个文件')
      return
    }

    try {
      const frames = await converter.splitFrames(input.files[0])
      
      // Download all frames
      frames.forEach((frame, index) => {
        const url = URL.createObjectURL(frame)
        const a = document.createElement('a')
        a.href = url
        a.download = `frame_${String(index + 1).padStart(4, '0')}.png`
        a.click()
        URL.revokeObjectURL(url)
      })
    } catch (error) {
      console.error('Frame splitting failed:', error)
      alert('分帧失败: ' + (error as Error).message)
    }
  })
})