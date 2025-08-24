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

    this.ffmpeg.on('progress', ({ progress, time }) => {
      const progressContainer = document.getElementById('progress-container') as HTMLElement
      const progressFill = document.getElementById('progress-fill') as HTMLElement
      const progressText = document.getElementById('progress-text') as HTMLElement
      const progressInfo = document.getElementById('progress-info') as HTMLElement
      
      if (progressContainer && progressFill && progressText && progressInfo) {
        const percentage = Math.round(progress * 100)
        
        progressContainer.style.display = 'block'
        progressFill.style.width = `${percentage}%`
        progressText.textContent = `${percentage}%`
        
        // Show detailed progress information
        if (time && time > 0) {
          const timeString = this.formatTime(time)
          progressInfo.textContent = `处理中... 已处理时长: ${timeString}`
        } else {
          progressInfo.textContent = `处理中... ${percentage}%`
        }
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

  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  private showProgress(message: string = '处理中...', percentage: number = 0) {
    const progressContainer = document.getElementById('progress-container') as HTMLElement
    const progressFill = document.getElementById('progress-fill') as HTMLElement
    const progressText = document.getElementById('progress-text') as HTMLElement
    const progressInfo = document.getElementById('progress-info') as HTMLElement
    
    if (progressContainer && progressFill && progressText && progressInfo) {
      progressContainer.style.display = 'block'
      progressFill.style.width = `${percentage}%`
      progressText.textContent = `${percentage}%`
      progressInfo.textContent = message
    }
  }

  private hideProgress() {
    const progressContainer = document.getElementById('progress-container') as HTMLElement
    if (progressContainer) {
      progressContainer.style.display = 'none'
    }
  }

  async convertFormat(file: File, outputFormat: string, options: any = {}) {
    if (!this.isLoaded) {
      throw new Error('FFmpeg not loaded yet')
    }

    const fileName = file.name
    const outputFileName = `output.${outputFormat}`
    const fileSize = (file.size / 1024 / 1024).toFixed(2) // MB

    try {
      this.showProgress(`准备处理文件: ${fileName} (${fileSize}MB)`, 0)

      // Write input file to FFmpeg
      await this.ffmpeg.writeFile(fileName, await fetchFile(file))
      this.showProgress(`文件已加载，开始转换...`, 10)

      // Build FFmpeg command
      const args = ['-i', fileName]
      
      if (options.fps) args.push('-r', options.fps.toString())
      if (options.scale) args.push('-vf', `scale=${options.scale}:-1`)
      if (options.quality) {
        if (outputFormat === 'gif') {
          args.push('-vf', 'palettegen=reserve_transparent=1')
        }
      }
      
      args.push(outputFileName)

      // Execute conversion
      await this.ffmpeg.exec(args)
      this.showProgress(`转换完成，准备下载...`, 95)

      // Read output file
      const data = await this.ffmpeg.readFile(outputFileName)
      const outputBlob = new Blob([data], { 
        type: outputFormat === 'gif' ? 'image/gif' : 'image/png' 
      })

      this.showProgress(`处理完成！文件大小: ${(outputBlob.size / 1024 / 1024).toFixed(2)}MB`, 100)
      
      // Hide progress after a short delay
      setTimeout(() => this.hideProgress(), 2000)

      return outputBlob
    } catch (error) {
      this.hideProgress()
      throw error
    }
  }

  async splitFrames(file: File) {
    if (!this.isLoaded) {
      throw new Error('FFmpeg not loaded yet')
    }

    const fileName = file.name
    const fileSize = (file.size / 1024 / 1024).toFixed(2) // MB

    try {
      this.showProgress(`准备分离帧: ${fileName} (${fileSize}MB)`, 0)

      await this.ffmpeg.writeFile(fileName, await fetchFile(file))
      this.showProgress(`文件已加载，开始分离帧...`, 20)

      // Extract frames
      await this.ffmpeg.exec(['-i', fileName, 'frame_%04d.png'])
      this.showProgress(`帧分离完成，读取帧文件...`, 80)

      // Get all frame files
      const files = await this.ffmpeg.listDir('/')
      const frameFiles = files.filter(f => f.name.startsWith('frame_'))
      
      const frames: Blob[] = []
      for (let i = 0; i < frameFiles.length; i++) {
        const frameFile = frameFiles[i]
        const data = await this.ffmpeg.readFile(frameFile.name)
        frames.push(new Blob([data], { type: 'image/png' }))
        
        const progress = 80 + (i / frameFiles.length) * 15
        this.showProgress(`读取帧 ${i + 1}/${frameFiles.length}`, Math.round(progress))
      }

      this.showProgress(`完成！共提取 ${frames.length} 帧`, 100)
      setTimeout(() => this.hideProgress(), 2000)

      return frames
    } catch (error) {
      this.hideProgress()
      throw error
    }
  }

  async mergeFrames(files: File[], outputFormat: string, fps: number = 10) {
    if (!this.isLoaded) {
      throw new Error('FFmpeg not loaded yet')
    }

    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2)

    try {
      this.showProgress(`准备合并 ${files.length} 个帧文件 (${totalSizeMB}MB)`, 0)

      // Write all frame files
      for (let i = 0; i < files.length; i++) {
        const fileName = `frame_${String(i + 1).padStart(4, '0')}.png`
        await this.ffmpeg.writeFile(fileName, await fetchFile(files[i]))
        
        const progress = (i / files.length) * 40
        this.showProgress(`上传帧 ${i + 1}/${files.length}`, Math.round(progress))
      }

      this.showProgress(`所有帧已上传，开始合并动画...`, 40)

      const outputFileName = `output.${outputFormat}`
      
      // Create animation from frames
      await this.ffmpeg.exec([
        '-framerate', fps.toString(),
        '-i', 'frame_%04d.png',
        '-y',
        outputFileName
      ])

      this.showProgress(`动画合并完成，准备输出...`, 90)

      // Read output file
      const data = await this.ffmpeg.readFile(outputFileName)
      const outputBlob = new Blob([data], { 
        type: outputFormat === 'gif' ? 'image/gif' : 'image/png' 
      })

      const outputSizeMB = (outputBlob.size / 1024 / 1024).toFixed(2)
      this.showProgress(`完成！输出文件大小: ${outputSizeMB}MB`, 100)
      setTimeout(() => this.hideProgress(), 2000)

      return outputBlob
    } catch (error) {
      this.hideProgress()
      throw error
    }
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