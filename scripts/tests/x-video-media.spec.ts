import { expect, test } from '@playwright/test'
import {
  extractMp4Videos,
  isTwimgMp4,
  syndicationToken
} from '../../src/background/handlers/handleXVideoMedia'

const base = 'https://video.twimg.com/ext_tw_video/123/pu/vid/'

test('only progressive MP4 variants are selected, ordered by bitrate', () => {
  const data = {
    mediaDetails: [
      {
        type: 'photo'
      },
      {
        type: 'video',
        video_info: {
          variants: [
            { content_type: 'application/x-mpegURL', url: base + 'playlist.m3u8' },
            { content_type: 'video/mp4', bitrate: 832000, url: base + '480x270/low.mp4' },
            { content_type: 'video/mp4', bitrate: 2176000, url: base + '1280x720/high.mp4' }
          ]
        }
      },
      {
        type: 'animated_gif',
        video_info: {
          variants: [{ content_type: 'video/mp4', url: base + '640x360/gif.mp4' }]
        }
      }
    ]
  }

  expect(extractMp4Videos(data)).toEqual([
    base + '1280x720/high.mp4',
    base + '640x360/gif.mp4'
  ])
})

test('syndication video fallback works without mediaDetails', () => {
  expect(
    extractMp4Videos({
      video: {
        variants: [{ content_type: 'video/mp4', url: base + '640x360/video.mp4' }]
      }
    })
  ).toEqual([base + '640x360/video.mp4'])
})

test('reject unsafe/streaming video URLs and avoid downloading a raw HLS track', () => {
  expect(isTwimgMp4(base + '1280x720/clip.mp4?tag=12')).toBe(true)
  expect(isTwimgMp4('https://video.twimg.com.attacker.test/clip.mp4')).toBe(false)
  expect(isTwimgMp4('http://video.twimg.com/clip.mp4')).toBe(false)
  expect(isTwimgMp4('blob:https://x.com/abc')).toBe(false)
  expect(isTwimgMp4(base + 'playlist.m3u8')).toBe(false)
  expect(
    extractMp4Videos({
      mediaDetails: [
        {
          video_info: {
            variants: [
              { content_type: 'video/mp4', url: 'https://attacker.test/clip.mp4' },
              { content_type: 'application/x-mpegURL', url: base + 'playlist.m3u8' }
            ]
          }
        }
      ]
    })
  ).toEqual([])
})

test('tweet syndication token is stable and URL-safe', () => {
  const token = syndicationToken('1890123456789012345')
  expect(token).toMatch(/^[a-z0-9]+$/)
  expect(token).toBe(syndicationToken('1890123456789012345'))
})
