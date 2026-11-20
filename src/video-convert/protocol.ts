import type {
  AnimationOutputFormat,
  GifPaletteProfile,
  VideoConvertProgress
} from '@/utils/video/videoAnimationArgs'

/** Window-level handshake: the parent transfers one MessagePort to this extension page. */
export const VIDEO_CONVERT_INIT_MESSAGE = 'EMOJI_VIDEO_CONVERT_INIT'

export interface VideoConvertRequestOptions {
  format: AnimationOutputFormat
  fps: number
  maxWidth: number
  quality: number
  gifProfile: GifPaletteProfile
  webpLossless: boolean
}

export type VideoConvertPortRequest =
  | { type: 'convert'; id: string; file: File; options: VideoConvertRequestOptions }
  | { type: 'cancel'; id: string }

export type VideoConvertPortResponse =
  | { type: 'ready' }
  | { type: 'progress'; id: string; progress: VideoConvertProgress }
  | { type: 'result'; id: string; file: File; warning?: string }
  | { type: 'error'; id: string; message: string; aborted?: boolean }
