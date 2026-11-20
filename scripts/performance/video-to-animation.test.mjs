import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildApngArgs,
  buildGifTwoPassArgs,
  buildTrimInputArgs,
  buildVideoFilter,
  buildWebpArgs,
  clampFps,
  clampQuality,
  formatTrimSeconds,
  getOutputFormatMeta,
  isGifInput,
  resolveAnimationFileName,
  resolveInputExtension,
  validateAnimationOutputMagic
} from '../../src/utils/video/videoAnimationArgs.ts'

test('clamps fps and quality within safe bounds', () => {
  assert.equal(clampFps(undefined), 12)
  assert.equal(clampFps(0), 1)
  assert.equal(clampFps(120), 30)
  assert.equal(clampFps(14.6), 15)

  assert.equal(clampQuality(undefined), 75)
  assert.equal(clampQuality(-10), 1)
  assert.equal(clampQuality(150), 100)
})

test('builds lanczos scale filters and clamps dimensions between 2 and 4096', () => {
  assert.equal(buildVideoFilter({ fps: 12 }), 'fps=12')
  assert.equal(
    buildVideoFilter({ fps: 10, maxWidth: 320 }),
    "fps=10,scale='min(320,iw)':-2:flags=lanczos"
  )
  assert.equal(
    buildVideoFilter({ fps: 15, maxHeight: 240 }),
    "fps=15,scale=-2:'min(240,ih)':flags=lanczos"
  )
  assert.equal(
    buildVideoFilter({ fps: 15, maxWidth: 320, maxHeight: 240 }),
    "fps=15,scale='min(320,iw)':'min(240,ih)':force_original_aspect_ratio=decrease:flags=lanczos"
  )
  assert.equal(
    buildVideoFilter({ fps: 12, maxWidth: 1 }),
    "fps=12,scale='min(2,iw)':-2:flags=lanczos"
  )
  assert.equal(
    buildVideoFilter({ fps: 12, maxWidth: 99999 }),
    "fps=12,scale='min(4096,iw)':-2:flags=lanczos"
  )
})

test('fps 0 keeps the source frame rate by omitting the fps filter', () => {
  assert.equal(buildVideoFilter({ fps: 0 }), 'null')
  assert.equal(buildVideoFilter({ fps: 0, maxWidth: 0 }), 'null')
  assert.equal(buildVideoFilter({ fps: 0, maxWidth: 320 }), "scale='min(320,iw)':-2:flags=lanczos")
  assert.ok(!buildVideoFilter({ fps: 0, maxWidth: 320 }).includes('fps='))
  const gif = buildGifTwoPassArgs('in.mp4', 'pal.png', 'out.gif', { fps: 0 })
  assert.match(gif.pass1[gif.pass1.indexOf('-vf') + 1], /^null,palettegen/)
  assert.match(gif.pass2[gif.pass2.indexOf('-filter_complex') + 1], /^\[0:v\]null\[x\]/)
  assert.deepEqual(buildApngArgs('in.mp4', 'o.png', { fps: 0 }).slice(0, 4), [
    '-i',
    'in.mp4',
    '-vf',
    'null'
  ])
})

test('builds trim input args before -i and sanitizes non-finite/tiny/excess durations', () => {
  assert.equal(formatTrimSeconds(undefined), null)
  assert.equal(formatTrimSeconds(-1), null)
  assert.equal(formatTrimSeconds(Number.NaN), null)
  assert.equal(formatTrimSeconds(0), null)
  assert.equal(formatTrimSeconds(1e-7), null)
  assert.equal(formatTrimSeconds(1.23456), '1.235')
  assert.equal(formatTrimSeconds(100000), '86400')

  assert.deepEqual(buildTrimInputArgs('in.mp4'), ['-i', 'in.mp4'])
  assert.deepEqual(buildTrimInputArgs('in.mp4', 1.5, 3), ['-ss', '1.5', '-t', '3', '-i', 'in.mp4'])
  assert.deepEqual(buildTrimInputArgs('in.mp4', 0, 2.5), ['-t', '2.5', '-i', 'in.mp4'])
  assert.deepEqual(buildTrimInputArgs('in.mp4', -2, 1e-7), ['-i', 'in.mp4'])
})

test('builds two-pass GIF palettegen and paletteuse commands with trim before -i and non-video strips', () => {
  const high = buildGifTwoPassArgs('in.mp4', 'pal.png', 'out.gif', {
    fps: 12,
    maxWidth: 320,
    startTime: 1,
    duration: 2.5,
    gifProfile: 'high'
  })
  assert.ok(high.pass1.includes('-vf'))
  assert.match(high.pass1[high.pass1.indexOf('-vf') + 1], /palettegen=stats_mode=full/)
  for (const flag of ['-an', '-sn', '-dn']) {
    assert.ok(high.pass1.includes(flag), `pass1 missing ${flag}`)
    assert.ok(high.pass2.includes(flag), `pass2 missing ${flag}`)
  }

  // -t must precede -i in.mp4, NOT sit between -i in.mp4 and -i pal.png
  const pass2TrimIdx = high.pass2.indexOf('-t')
  const pass2InputIdx = high.pass2.indexOf('-i')
  assert.ok(pass2TrimIdx >= 0 && pass2TrimIdx < pass2InputIdx)

  assert.ok(high.pass2.includes('-filter_complex'))
  assert.match(
    high.pass2[high.pass2.indexOf('-filter_complex') + 1],
    /paletteuse=dither=bayer:bayer_scale=3/
  )
  assert.equal(high.pass2.at(-1), 'out.gif')

  const classic = buildGifTwoPassArgs('in.mp4', 'pal.png', 'out.gif', { gifProfile: 'classic' })
  assert.match(
    classic.pass2[classic.pass2.indexOf('-filter_complex') + 1],
    /dither=floyd_steinberg/
  )

  const small = buildGifTwoPassArgs('in.mp4', 'pal.png', 'out.gif', { gifProfile: 'small' })
  assert.match(small.pass1[small.pass1.indexOf('-vf') + 1], /max_colors=64/)

  const fallback = buildGifTwoPassArgs(
    'in.mp4',
    'pal.png',
    'out.gif',
    /** @type {any} */ ({ gifProfile: 'invalid-profile' })
  )
  assert.match(
    fallback.pass2[fallback.pass2.indexOf('-filter_complex') + 1],
    /paletteuse=dither=bayer:bayer_scale=3/
  )
})

test('builds APNG and animated WebP commands stripping audio/subtitle/data streams', () => {
  const apng = buildApngArgs('in.mp4', 'out.png', { fps: 12, maxWidth: 320, loop: 0 })
  for (const flag of ['-an', '-sn', '-dn']) {
    assert.ok(apng.includes(flag), `apng missing ${flag}`)
  }
  assert.deepEqual(
    apng.slice(-6),
    ['-plays', '0', '-pred', 'mixed', '-f', 'apng', '-y', 'out.png'].slice(-6)
  )

  const lossyWebp = buildWebpArgs('in.mp4', 'out.webp', { fps: 15, quality: 82 })
  assert.ok(lossyWebp.includes('libwebp_anim'))
  for (const flag of ['-an', '-sn', '-dn']) {
    assert.ok(lossyWebp.includes(flag), `webp missing ${flag}`)
  }
  assert.equal(lossyWebp[lossyWebp.indexOf('-lossless') + 1], '0')
  assert.equal(lossyWebp[lossyWebp.indexOf('-q:v') + 1], '82')

  const losslessWebp = buildWebpArgs('in.mp4', 'out.webp', { webpLossless: true })
  assert.equal(losslessWebp[losslessWebp.indexOf('-lossless') + 1], '1')
})

test('sanitizes output filenames, resolves MIME metadata and input extensions, and validates output magic', () => {
  assert.equal(resolveAnimationFileName('clip.mp4', 'gif'), 'clip.gif')
  assert.equal(resolveAnimationFileName('clip.mov', 'apng'), 'clip.png')
  assert.equal(resolveAnimationFileName('clip.webm', 'webp'), 'clip.webp')
  assert.equal(resolveAnimationFileName('clip.mp4', 'avif'), 'clip.avif')
  assert.equal(resolveAnimationFileName(undefined, 'gif'), 'animation.gif')
  assert.equal(resolveAnimationFileName('../../foo/bar\n.mov', 'gif'), 'bar.gif')
  assert.equal(resolveAnimationFileName('...\u0000.mp4', 'gif'), 'animation.gif')
  assert.equal(resolveAnimationFileName('..hidden.webm', 'webp'), 'hidden.webp')

  assert.equal(getOutputFormatMeta('apng').mimeType, 'image/apng')
  assert.equal(getOutputFormatMeta('apng').ext, 'png')

  assert.equal(resolveInputExtension('video.MP4', ''), 'mp4')
  assert.equal(resolveInputExtension('blob', 'video/webm;codecs=vp9'), 'webm')
  assert.equal(resolveInputExtension('unknown.bin', ''), 'mp4')

  assert.equal(isGifInput('sample.GIF', ''), true)
  assert.equal(isGifInput('clip.bin', 'image/gif'), true)
  assert.equal(isGifInput('clip.mp4', 'video/mp4'), false)

  assert.equal(validateAnimationOutputMagic(Buffer.from('GIF89a......'), 'gif'), true)
  assert.equal(validateAnimationOutputMagic(Buffer.from('NOTGIF'), 'gif'), false)
  assert.equal(
    validateAnimationOutputMagic(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      'apng'
    ),
    true
  )
  assert.equal(validateAnimationOutputMagic(new Uint8Array([0x89, 0x50, 0x4e]), 'apng'), false)
  assert.equal(validateAnimationOutputMagic(Buffer.from('RIFF1234WEBP....'), 'webp'), true)
  assert.equal(validateAnimationOutputMagic(Buffer.from('RIFF1234PNG '), 'webp'), false)
  assert.equal(validateAnimationOutputMagic(Buffer.from('\x00\x00\x00\x1cftypavis'), 'avif'), true)
  assert.equal(validateAnimationOutputMagic(Buffer.from('\x00\x00\x00\x1cmoovavis'), 'avif'), false)
})

test('video convert settings normalize stale/untrusted data and keep defaults', async () => {
  const { DEFAULT_VIDEO_CONVERT_SETTINGS, normalizeVideoConvertSettings } =
    await import('../../src/utils/video/videoConvertSettings.ts')
  assert.deepEqual(normalizeVideoConvertSettings(null), DEFAULT_VIDEO_CONVERT_SETTINGS)
  assert.deepEqual(normalizeVideoConvertSettings('garbage'), DEFAULT_VIDEO_CONVERT_SETTINGS)

  const normalized = normalizeVideoConvertSettings({
    format: 'webp',
    preset: 'original',
    fps: 0,
    maxWidth: 0,
    quality: 500,
    gifProfile: 'nope',
    webpLossless: 'yes',
    autoConvertOnUpload: false
  })
  assert.equal(normalized.format, 'webp')
  assert.equal(normalized.preset, 'original')
  assert.equal(normalized.fps, 0)
  assert.equal(normalized.maxWidth, 0)
  assert.equal(normalized.quality, 100)
  assert.equal(normalized.gifProfile, 'high')
  assert.equal(normalized.webpLossless, false)
  assert.equal(normalized.autoConvertOnUpload, false)

  assert.equal(normalizeVideoConvertSettings({ format: 'bmp' }).format, 'gif')
  assert.equal(normalizeVideoConvertSettings({ fps: 999 }).fps, 30)
})

test('isVideoFileLike detects videos but not images or GIFs', async () => {
  const { isVideoFileLike } = await import('../../src/utils/video/videoAnimationArgs.ts')
  assert.equal(isVideoFileLike({ name: 'a.mp4', type: 'video/mp4' }), true)
  assert.equal(isVideoFileLike({ name: 'a.MOV', type: '' }), true)
  assert.equal(isVideoFileLike({ name: 'a.gif', type: 'image/gif' }), false)
  assert.equal(isVideoFileLike({ name: 'a.mp4', type: 'image/png' }), false)
  assert.equal(isVideoFileLike({ name: 'a.png', type: '' }), false)
})
