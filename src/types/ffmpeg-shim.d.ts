// Minimal FFmpeg type shims for build-time checks
declare module '@ffmpeg/ffmpeg' {
  /** Factory to create an ffmpeg-like instance */
  export function createFFmpeg(options?: any): any
  /** Helper to fetch files into ffmpeg FS */
  export function fetchFile(input: any): any
}
