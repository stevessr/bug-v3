import assert from 'node:assert/strict'
import test from 'node:test'
import {
  extractMp4Videos,
  isTwimgMp4,
  syndicationToken,
  handleXVideoMedia
} from '../../src/background/handlers/handleXVideoMedia.ts'

const base = 'https://video.twimg.com/ext_tw_video/123/pu/vid/'
const source = { url: 'https://x.com/test/status/1890123456789012345' }

test('select the highest bitrate MP4 in media order, including GIF videos', () => {
  assert.deepEqual(
    extractMp4Videos({
      mediaDetails: [
        {
          type: 'video',
          video_info: {
            variants: [
              { content_type: 'application/x-mpegURL', url: base + 'master.m3u8' },
              { content_type: 'video/mp4', url: base + '360p.mp4', bitrate: 500000 },
              { content_type: 'video/mp4', url: base + '720p.mp4', bitrate: 2200000 }
            ]
          }
        },
        { type: 'animated_gif', video_info: { variants: [{ content_type: 'video/mp4', url: base + 'gif.mp4' }] } }
      ]
    }),
    [base + '720p.mp4', base + 'gif.mp4']
  )
  assert.deepEqual(
    extractMp4Videos({ video: { variants: [{ content_type: 'video/mp4', url: base + 'solo.mp4' }] } }),
    [base + 'solo.mp4']
  )
})

test('reject HLS, blob, non-HTTPS and lookalike CDN domains', () => {
  assert.equal(isTwimgMp4(base + '720p.mp4?tag=12'), true)
  for (const url of [
    base + 'master.m3u8',
    'blob:https://x.com/any',
    'http://video.twimg.com/a.mp4',
    'https://video.twimg.com.attacker.test/a.mp4'
  ]) assert.equal(isTwimgMp4(url), false)
  assert.deepEqual(
    extractMp4Videos({
      video: { variants: [
        { content_type: 'video/mp4', url: 'https://unsafe.test/a.mp4' },
        { content_type: 'application/x-mpegURL', url: base + 'master.m3u8' }
      ] }
    }),
    []
  )
})

test('token calculation is stable', () => {
  const token = syndicationToken('1890123456789012345')
  assert.match(token, /^[a-z0-9]+$/)
  assert.equal(token, syndicationToken('1890123456789012345'))
})

test('background downloads second video and uses selected MP4', async t => {
  const previousFetch = globalThis.fetch
  const previousChrome = globalThis.chrome
  t.after(() => {
    globalThis.fetch = previousFetch
    globalThis.chrome = previousChrome
  })
  let saved = null
  globalThis.chrome = {
    runtime: { lastError: null },
    downloads: { download(options, callback) { saved = options; callback(123) } }
  }
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      user: { screen_name: 'sample_user' },
      mediaDetails: [
        { video_info: { variants: [{ content_type: 'video/mp4', url: base + 'a.mp4', bitrate: 1 }] } },
        { video_info: { variants: [{ content_type: 'video/mp4', url: base + 'b.mp4', bitrate: 2 }] } }
      ]
    })
  })
  let response = null
  await handleXVideoMedia(
    { type: 'X_VIDEO_MEDIA', tweetId: '1890123456789012345', index: 1, action: 'download' },
    source,
    result => { response = result }
  )
  assert.equal(response?.success, true)
  assert.equal(response?.data?.downloadId, 123)
  assert.deepEqual(saved, {
    url: base + 'b.mp4',
    filename: 'sample_user_1890123456789012345_2.mp4',
    conflictAction: 'uniquify',
    saveAs: false
  })
})

test('background rejects requests from unrelated sites', async t => {
  const previousFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = previousFetch })
  globalThis.fetch = async () => { throw Error('fetch must not run') }
  let response = null
  await handleXVideoMedia(
    { type: 'X_VIDEO_MEDIA', tweetId: '1890123456789012345', action: 'download' },
    { url: 'https://attacker.test/' },
    result => { response = result }
  )
  assert.equal(response?.success, false)
  assert.match(response?.error || '', /仅允许/)
})

test('can fall back to direct trusted MP4 if syndication is unavailable', async t => {
  const previousFetch = globalThis.fetch
  const previousChrome = globalThis.chrome
  t.after(() => {
    globalThis.fetch = previousFetch
    globalThis.chrome = previousChrome
  })
  globalThis.fetch = async () => { throw new Error('offline') }
  globalThis.chrome = { runtime: { lastError: null }, downloads: { download() { throw Error('should not download') } } }
  let response = null
  await handleXVideoMedia(
    {
      type: 'X_VIDEO_MEDIA', tweetId: '1890123456789012345', action: 'copy',
      fallbackUrl: base + 'fallback.mp4'
    },
    source,
    result => { response = result }
  )
  assert.equal(response?.success, true)
  assert.equal(response?.data?.url, base + 'fallback.mp4')
})
