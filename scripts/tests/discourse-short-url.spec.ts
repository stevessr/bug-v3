import { expect, test } from '@playwright/test'

import { extractDiscourseUploadMetadata } from '../../src/utils/discourseUpload'
import { shouldUseShortUrl } from '../../src/utils/emojiMarkdown'

test('recovers Discourse upload:// short URL from a rendered short path', () => {
  expect(
    extractDiscourseUploadMetadata(
      'https://linux.do/original/4X/example.png',
      '/uploads/short-url/example.png?dl=1'
    )
  ).toEqual({
    short_url: 'upload://example.png'
  })
})

test('uses upload:// only on the source forum, including the Linux.do CDN alias', () => {
  const linuxDoEmoji = {
    url: 'https://cdn3.ldstatic.com/original/4X/example.png',
    short_url: 'upload://example.png'
  }

  expect(shouldUseShortUrl(linuxDoEmoji, 'linux.do')).toBe(true)
  expect(shouldUseShortUrl(linuxDoEmoji, 'another-forum.example')).toBe(false)
})

test('uses upload:// for a same-host Discourse instance and rejects a different host', () => {
  const emoji = {
    url: 'https://community.example/uploads/default/original/example.png',
    short_url: 'upload://example.png'
  }

  expect(shouldUseShortUrl(emoji, 'community.example')).toBe(true)
  expect(shouldUseShortUrl(emoji, 'other-community.example')).toBe(false)
})

test('can use a stored Discourse short path when a legacy record lacks short_url', () => {
  const emoji = {
    url: 'https://community.example/uploads/default/original/example.png',
    short_path: '/uploads/short-url/example.png'
  }

  expect(shouldUseShortUrl(emoji, 'community.example')).toBe(true)
})
