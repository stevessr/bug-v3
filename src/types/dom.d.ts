/**
 * DOM API type declarations that may not be in the TypeScript lib
 */

/** CompressionStream API - https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream */
declare global {
  interface CompressionStream {
    readonly readable: ReadableStream<Uint8Array>
    readonly writable: WritableStream<BufferSource>
  }

  interface CompressionStreamConstructor {
    new (format: 'deflate' | 'deflate-raw' | 'gzip' | 'bzip2' | 'xz'): CompressionStream
  }

  var CompressionStream: CompressionStreamConstructor
}

export {}
