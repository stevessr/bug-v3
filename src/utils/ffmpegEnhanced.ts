/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Enhanced FFmpeg WASM helper with proper format support and error handling
 * Supports PNG, APNG, WebP, GIF conversion and animation synthesis
 */

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

export interface ConversionOptions {
  fps?: number
  scale?: number
  quality?: number
  loop?: boolean
  duration?: number
  outputFormat?: 'gif' | 'apng' | 'webp' | 'mp4' | 'webm'
}

export interface FrameExtractionOptions {
  interval?: number // seconds between frames
  maxFrames?: number
  startTime?: number
  endTime?: number
  quality?: number
}

export interface AnimationSynthesisOptions {
  frameDelay?: number // milliseconds
  loop?: boolean
  quality?: number
  scale?: number
}

export class EnhancedFFmpegProcessor {
  private ffmpeg: FFmpeg | null = null
  private isLoaded = false

  async initialize(): Promise<void> {
    if (this.isLoaded && this.ffmpeg) return

    this.ffmpeg = new FFmpeg()
    
    // Configure proper loading with local files to avoid CSP issues
    const baseURL = '/js/'
    
    await this.ffmpeg.load({
      coreURL: baseURL + 'ffmpeg-core.js',
      wasmURL: baseURL + 'ffmpeg-core.wasm',
      // Use custom worker URL if available
      workerURL: baseURL + 'ffmpeg-worker.js'
    })
    
    this.isLoaded = true
    console.log('[Enhanced FFmpeg] Initialization complete')
  }

  /**
   * Convert video to animated format with proper encoding
   */
  async convertVideoToAnimation(
    file: File,
    options: ConversionOptions = {}
  ): Promise<{ url: string; name: string; size: number }> {
    if (!this.ffmpeg || !this.isLoaded) {
      throw new Error('FFmpeg not initialized. Call initialize() first.')
    }

    const {
      fps = 10,
      scale = 480,
      quality = 80,
      loop = true,
      outputFormat = 'gif'
    } = options

    const inputName = `input_${Date.now()}.${this.getFileExtension(file.name)}`
    const outputName = `output_${Date.now()}.${outputFormat}`

    try {
      // Write input file
      await this.ffmpeg.writeFile(inputName, await fetchFile(file))

      // Build FFmpeg command based on output format
      const args = ['-i', inputName]

      // Add video filters
      const filters: string[] = []
      
      if (scale > 0) {
        filters.push(`scale=${scale}:-1:flags=lanczos`)
      }
      
      if (fps > 0) {
        filters.push(`fps=${fps}`)
      }

      if (filters.length > 0) {
        args.push('-vf', filters.join(','))
      }

      // Format-specific options
      switch (outputFormat) {
        case 'gif':
          args.push('-f', 'gif')
          if (loop) args.push('-loop', '0')
          break
        case 'apng':
          args.push('-f', 'apng')
          if (loop) args.push('-plays', '0')
          break
        case 'webp':
          args.push('-f', 'webp')
          args.push('-quality', quality.toString())
          if (loop) args.push('-loop', '0')
          break
        case 'mp4':
          args.push('-c:v', 'libx264', '-crf', (100 - quality).toString())
          break
        case 'webm':
          args.push('-c:v', 'libvpx-vp9', '-crf', (100 - quality).toString())
          break
      }

      args.push(outputName)

      // Execute conversion
      await this.ffmpeg.exec(args)

      // Read output file
      const data = await this.ffmpeg.readFile(outputName)
      const blob = new Blob([data], { 
        type: this.getMimeType(outputFormat) 
      })
      
      // Cleanup
      await this.cleanup([inputName, outputName])

      return {
        url: URL.createObjectURL(blob),
        name: this.generateOutputName(file.name, outputFormat),
        size: blob.size
      }
    } catch (error) {
      // Cleanup on error
      await this.cleanup([inputName, outputName])
      throw new Error(`Video conversion failed: ${error}`)
    }
  }

  /**
   * Extract frames from video with intelligent sampling
   */
  async extractVideoFrames(
    file: File,
    options: FrameExtractionOptions = {}
  ): Promise<{ frames: Blob[]; names: string[] }> {
    if (!this.ffmpeg || !this.isLoaded) {
      throw new Error('FFmpeg not initialized. Call initialize() first.')
    }

    const {
      interval = 1, // Extract 1 frame per second by default
      maxFrames = 60,
      startTime = 0,
      quality = 90
    } = options

    const inputName = `input_${Date.now()}.${this.getFileExtension(file.name)}`
    const outputPattern = `frame_%03d.png`

    try {
      // Write input file
      await this.ffmpeg.writeFile(inputName, await fetchFile(file))

      // Get video info first
      const probeArgs = ['-i', inputName, '-f', 'null', '-']
      await this.ffmpeg.exec(probeArgs)

      // Build extraction command
      const args = ['-i', inputName]
      
      if (startTime > 0) {
        args.push('-ss', startTime.toString())
      }

      // Extract frames at specified interval
      args.push('-vf', `fps=1/${interval}`)
      args.push('-q:v', Math.round((100 - quality) / 10).toString())
      
      // Limit number of frames
      if (maxFrames > 0) {
        args.push('-vframes', maxFrames.toString())
      }

      args.push(outputPattern)

      // Execute extraction
      await this.ffmpeg.exec(args)

      // Read extracted frames
      const frames: Blob[] = []
      const names: string[] = []
      
      for (let i = 1; i <= maxFrames; i++) {
        const frameName = `frame_${i.toString().padStart(3, '0')}.png`
        try {
          const data = await this.ffmpeg.readFile(frameName)
          frames.push(new Blob([data], { type: 'image/png' }))
          names.push(this.generateFrameName(file.name, i))
          
          // Cleanup frame file
          await this.ffmpeg.deleteFile(frameName)
        } catch {
          // No more frames
          break
        }
      }

      // Cleanup input
      await this.ffmpeg.deleteFile(inputName)

      return { frames, names }
    } catch (error) {
      await this.cleanup([inputName])
      throw new Error(`Frame extraction failed: ${error}`)
    }
  }

  /**
   * Synthesize animation from image frames
   */
  async synthesizeAnimation(
    frames: File[],
    options: AnimationSynthesisOptions = {}
  ): Promise<{ url: string; name: string; size: number }> {
    if (!this.ffmpeg || !this.isLoaded) {
      throw new Error('FFmpeg not initialized. Call initialize() first.')
    }

    if (frames.length === 0) {
      throw new Error('No frames provided for animation synthesis')
    }

    const {
      frameDelay = 100, // 100ms = 10fps
      loop = true,
      quality = 80,
      scale = 480
    } = options

    const outputFormat = 'gif' // Default to GIF for frame synthesis
    const outputName = `animation_${Date.now()}.${outputFormat}`
    const fps = 1000 / frameDelay

    try {
      // Write all frame files
      const frameNames: string[] = []
      for (let i = 0; i < frames.length; i++) {
        const frameName = `frame_${(i + 1).toString().padStart(3, '0')}.png`
        await this.ffmpeg.writeFile(frameName, await fetchFile(frames[i]))
        frameNames.push(frameName)
      }

      // Build synthesis command
      const args = [
        '-framerate', fps.toString(),
        '-i', 'frame_%03d.png',
        '-vf', `scale=${scale}:-1:flags=lanczos`,
        '-f', 'gif'
      ]

      if (loop) {
        args.push('-loop', '0')
      }

      args.push(outputName)

      // Execute synthesis
      await this.ffmpeg.exec(args)

      // Read output
      const data = await this.ffmpeg.readFile(outputName)
      const blob = new Blob([data], { type: 'image/gif' })

      // Cleanup
      await this.cleanup([...frameNames, outputName])

      return {
        url: URL.createObjectURL(blob),
        name: `animation_${Date.now()}.gif`,
        size: blob.size
      }
    } catch (error) {
      await this.cleanup([outputName, ...Array.from({ length: frames.length }, (_, i) => 
        `frame_${(i + 1).toString().padStart(3, '0')}.png`
      )])
      throw new Error(`Animation synthesis failed: ${error}`)
    }
  }

  /**
   * Convert between image formats
   */
  async convertImageFormat(
    file: File,
    targetFormat: 'png' | 'jpg' | 'webp' | 'bmp',
    quality = 90
  ): Promise<{ url: string; name: string; size: number }> {
    if (!this.ffmpeg || !this.isLoaded) {
      throw new Error('FFmpeg not initialized. Call initialize() first.')
    }

    const inputName = `input_${Date.now()}.${this.getFileExtension(file.name)}`
    const outputName = `output_${Date.now()}.${targetFormat}`

    try {
      await this.ffmpeg.writeFile(inputName, await fetchFile(file))

      const args = ['-i', inputName]

      // Format-specific options
      if (targetFormat === 'jpg') {
        args.push('-q:v', Math.round((100 - quality) / 10).toString())
      } else if (targetFormat === 'webp') {
        args.push('-quality', quality.toString())
      }

      args.push(outputName)

      await this.ffmpeg.exec(args)

      const data = await this.ffmpeg.readFile(outputName)
      const blob = new Blob([data], { 
        type: this.getMimeType(targetFormat) 
      })

      await this.cleanup([inputName, outputName])

      return {
        url: URL.createObjectURL(blob),
        name: this.generateOutputName(file.name, targetFormat),
        size: blob.size
      }
    } catch (error) {
      await this.cleanup([inputName, outputName])
      throw new Error(`Image conversion failed: ${error}`)
    }
  }

  /**
   * Get video/image metadata
   */
  async getMediaInfo(file: File): Promise<{
    duration?: number
    width?: number
    height?: number
    fps?: number
    format?: string
    codec?: string
  }> {
    if (!this.ffmpeg || !this.isLoaded) {
      throw new Error('FFmpeg not initialized. Call initialize() first.')
    }

    const inputName = `probe_${Date.now()}.${this.getFileExtension(file.name)}`

    try {
      await this.ffmpeg.writeFile(inputName, await fetchFile(file))

      // Use ffprobe-like functionality
      const args = ['-i', inputName, '-f', 'null', '-']
      await this.ffmpeg.exec(args)

      // Parse logs for metadata (simplified approach)
      // In a real implementation, you'd parse the actual ffmpeg output
      await this.ffmpeg.deleteFile(inputName)

      return {
        // Return placeholder metadata
        format: this.getFileExtension(file.name)
      }
    } catch (error) {
      await this.cleanup([inputName])
      throw new Error(`Media info extraction failed: ${error}`)
    }
  }

  private async cleanup(files: string[]): Promise<void> {
    if (!this.ffmpeg) return

    for (const file of files) {
      try {
        await this.ffmpeg.deleteFile(file)
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || 'bin'
  }

  private getMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      gif: 'image/gif',
      apng: 'image/apng',
      webp: 'image/webp',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      bmp: 'image/bmp',
      mp4: 'video/mp4',
      webm: 'video/webm'
    }
    return mimeTypes[format] || 'application/octet-stream'
  }

  private generateOutputName(originalName: string, format: string): string {
    const baseName = originalName.replace(/\.[^.]+$/, '')
    return `${baseName}_converted.${format}`
  }

  private generateFrameName(originalName: string, frameNumber: number): string {
    const baseName = originalName.replace(/\.[^.]+$/, '')
    return `${baseName}_frame_${frameNumber.toString().padStart(3, '0')}.png`
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    if (this.ffmpeg) {
      // Clean up any remaining files
      this.ffmpeg = null
      this.isLoaded = false
    }
  }
}

// Singleton instance
let enhancedProcessor: EnhancedFFmpegProcessor | null = null

export async function getEnhancedFFmpegProcessor(): Promise<EnhancedFFmpegProcessor> {
  if (!enhancedProcessor) {
    enhancedProcessor = new EnhancedFFmpegProcessor()
    await enhancedProcessor.initialize()
  }
  return enhancedProcessor
}