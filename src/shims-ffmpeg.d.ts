/* eslint-disable */
declare module '@ffmpeg/ffmpeg' {
  // declaration-only shim for build-time types
  export function createFFmpeg(_options?: any): any
  export function fetchFile(_input: any): any
}
