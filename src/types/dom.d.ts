/**
 * DOM API type declarations that may not be in the TypeScript lib
 */

/** Promise.withResolvers — ES2024 API, project lib is ES2020 (https://developer.mozilla.org/en-US/docs/Web/API/Promise/withResolvers) */
declare global {
  interface PromiseWithResolvers<T> {
    promise: Promise<T>
    resolve: (value: T | PromiseLike<T>) => void
    reject: (reason?: unknown) => void
  }

  interface PromiseConstructor {
    withResolvers<T>(): PromiseWithResolvers<T>
  }
}

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
