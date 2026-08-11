import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { createRequire } from 'node:module'

import ts from 'typescript'

const repoRoot = path.resolve(import.meta.dirname, '../..')
const nodeRequire = createRequire(import.meta.url)

function loadTypeScriptModule(relativePath, dependencies = {}) {
  const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true
    },
    fileName: relativePath
  }).outputText
  const module = { exports: {} }
  const localRequire = specifier => {
    if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier]
    return nodeRequire(specifier)
  }
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports)
  return module.exports
}

const navigation = loadTypeScriptModule('src/options/components/discourse/navigation.ts')
const parserContext = loadTypeScriptModule('src/options/components/discourse/parser/context.ts')
const discourseUtils = loadTypeScriptModule('src/options/components/discourse/utils.ts')
const astUtils = loadTypeScriptModule('src/options/components/discourse/parser/astUtils.ts')
const traverse = loadTypeScriptModule('src/options/components/discourse/parser/traverse.ts', {
  './astUtils': astUtils
})
const transformQuotesModule = loadTypeScriptModule(
  'src/options/components/discourse/parser/transformQuotes.ts',
  {
    './context': parserContext,
    './astUtils': astUtils,
    './traverse': traverse
  }
)

test('address input resolves forum paths, hosts, and search text predictably', () => {
  assert.deepEqual(navigation.resolveDiscourseAddressInput('', 'https://linux.do/path'), {
    url: 'https://linux.do',
    origin: 'https://linux.do',
    kind: 'navigation'
  })
  assert.equal(
    navigation.resolveDiscourseAddressInput('/new', 'https://linux.do').url,
    'https://linux.do/new'
  )
  assert.equal(
    navigation.resolveDiscourseAddressInput('//meta.discourse.org/top', 'https://linux.do').url,
    'https://meta.discourse.org/top'
  )
  assert.equal(
    navigation.resolveDiscourseAddressInput('meta.discourse.org/c/support/1', 'https://linux.do')
      .url,
    'https://meta.discourse.org/c/support/1'
  )
  assert.equal(
    navigation.resolveDiscourseAddressInput('localhost:4200/latest', 'http://127.0.0.1').url,
    'http://localhost:4200/latest'
  )

  const search = navigation.resolveDiscourseAddressInput('emoji picker', 'https://linux.do')
  assert.equal(search.kind, 'search')
  assert.equal(search.url, 'https://linux.do/search?q=emoji+picker')
  assert.equal(
    navigation.resolveDiscourseAddressInput('in:title tag:vue', 'https://linux.do').url,
    'https://linux.do/search?q=in%3Atitle+tag%3Avue'
  )
})

test('address input rejects unsafe schemes and embedded credentials', () => {
  assert.throws(
    () => navigation.resolveDiscourseAddressInput('javascript:alert(1)', 'https://linux.do'),
    /HTTP 或 HTTPS/
  )
  assert.throws(
    () =>
      navigation.resolveDiscourseAddressInput('https://user:secret@linux.do', 'https://linux.do'),
    /用户名或密码/
  )
})

test('content navigation resolves only credential-free HTTP links', () => {
  assert.equal(
    navigation.resolveDiscourseHttpUrl('/t/example/1', 'https://linux.do'),
    'https://linux.do/t/example/1'
  )
  assert.equal(
    navigation.resolveDiscourseHttpUrl('//meta.discourse.org/latest', 'https://linux.do'),
    'https://meta.discourse.org/latest'
  )
  assert.equal(
    navigation.resolveDiscourseHttpUrl(
      '//linuxdo-uploads.s3.ldstatic.com/original/4X/7/2/5/725e864d7b0f17ece0b468d5f22140b7de497834.png',
      'https://linux.do'
    ),
    'https://linuxdo-uploads.s3.ldstatic.com/original/4X/7/2/5/725e864d7b0f17ece0b468d5f22140b7de497834.png'
  )
  assert.equal(navigation.resolveDiscourseHttpUrl('javascript:alert(1)', 'https://linux.do'), null)
  assert.equal(
    navigation.resolveDiscourseHttpUrl('https://user:secret@linux.do', 'https://linux.do'),
    null
  )
})

test('Discourse list, nested category, message, and notification routes are parsed', () => {
  assert.equal(navigation.topicListTypeFromPath('/new'), 'new')
  assert.equal(navigation.topicListTypeFromPath('/unread.json'), 'unread')
  assert.equal(navigation.topicListTypeFromPath('/top/weekly'), 'top')
  assert.equal(navigation.topicListTypeFromPath('/new/unknown'), null)
  assert.deepEqual(navigation.topicListRouteFromPath('/top/quarterly.json'), {
    type: 'top',
    period: 'quarterly'
  })
  assert.equal(navigation.topicListRouteFromPath('/top/unsupported'), null)
  assert.equal(
    navigation.buildTopicListApiUrl('https://linux.do', 'top', 'weekly', 2),
    'https://linux.do/top.json?period=weekly&page=2'
  )

  assert.deepEqual(navigation.categoryRouteFromPath('/c/parent/child/42/l/latest'), {
    slug: 'parent/child',
    categoryId: 42
  })
  assert.deepEqual(navigation.categoryRouteFromPath('/c/support.json'), {
    slug: 'support',
    categoryId: null
  })

  assert.equal(navigation.messagesTabFromPath('/u/alice/messages/sent'), 'sent')
  assert.equal(navigation.messagesTabFromPath('/u/alice/private-messages/archive'), 'archive')
  assert.equal(navigation.messagesTabFromPath('/u/alice/messages/unknown'), 'all')

  assert.equal(navigation.normalizeNotificationFilter('mentions'), 'mentions')
  assert.equal(navigation.normalizeNotificationFilter('category:replies'), 'category:replies')
  assert.equal(navigation.normalizeNotificationFilter('unsupported'), 'all')
})

test('parsed media URLs use URL semantics and reject executable protocols', () => {
  const ctx = parserContext.createParseContext('https://linux.do', () => '')
  assert.equal(
    parserContext.resolveUrl(ctx, '/uploads/file.png'),
    'https://linux.do/uploads/file.png'
  )
  assert.equal(
    parserContext.resolveUrl(ctx, 'uploads/file.png'),
    'https://linux.do/uploads/file.png'
  )
  assert.equal(parserContext.resolveUrl(ctx, 'javascript:alert(1)'), '')
  assert.equal(parserContext.resolveUrl(ctx, 'data:text/html,unsafe'), '')
})

test('linux.do avatar templates are rewritten to the CDN to offload the main site', () => {
  // linux.do 主站头像直接改写为 CDN 地址，尺寸抬升到至少 96px（示例 32 → 96）
  assert.equal(
    discourseUtils.getAvatarUrl(
      '/user_avatar/linux.do/atri/{size}/2345717_2.gif',
      'https://linux.do',
      32
    ),
    'https://cdn.ldstatic.com/user_avatar/linux.do/atri/96/2345717_2.gif'
  )
  // 已是 CDN 地址的模板保持原样
  assert.equal(
    discourseUtils.getAvatarUrl(
      '//cdn.ldstatic.com/user_avatar/linux.do/atri/{size}/2345717_2.png',
      'https://linux.do',
      24
    ),
    'https://cdn.ldstatic.com/user_avatar/linux.do/atri/24/2345717_2.png'
  )
  // 其他站点返回的类似物（路径首段为其他论坛名）不改写
  assert.equal(
    discourseUtils.getAvatarUrl('/user_avatar/example/{size}/avatar.png', 'https://linux.do', 48),
    'https://linux.do/user_avatar/example/48/avatar.png'
  )
  // 其他站点主机的类似物不改写
  assert.equal(
    discourseUtils.getAvatarUrl(
      '/user_avatar/meta.discourse.org/atri/{size}/2345717_2.png',
      'https://meta.discourse.org',
      32
    ),
    'https://meta.discourse.org/user_avatar/meta.discourse.org/atri/32/2345717_2.png'
  )
})

test('rewriteAvatarUrlForCdn handles the special case directly', () => {
  assert.equal(
    discourseUtils.rewriteAvatarUrlForCdn(
      'https://linux.do/user_avatar/linux.do/stevessr/32/1589755_2.png'
    ),
    'https://cdn.ldstatic.com/user_avatar/linux.do/stevessr/96/1589755_2.png'
  )
  // 小于 96 的尺寸统一抬升到 96
  assert.equal(
    discourseUtils.rewriteAvatarUrlForCdn(
      'https://linux.do/user_avatar/linux.do/alice/20/100_2.png'
    ),
    'https://cdn.ldstatic.com/user_avatar/linux.do/alice/96/100_2.png'
  )
  // 不小于 96 的尺寸保持不变
  assert.equal(
    discourseUtils.rewriteAvatarUrlForCdn(
      'https://linux.do/user_avatar/linux.do/bob/120/200_2.png'
    ),
    'https://cdn.ldstatic.com/user_avatar/linux.do/bob/120/200_2.png'
  )
  // 非 linux.do 主机 / 非 user_avatar 路径不改写
  assert.equal(
    discourseUtils.rewriteAvatarUrlForCdn('https://linux.do/u/stevessr/avatar/90.png'),
    'https://linux.do/u/stevessr/avatar/90.png'
  )
  assert.equal(
    discourseUtils.rewriteAvatarUrlForCdn(
      'https://linux.do/user_avatar/example/stevessr/32/1589755_2.png'
    ),
    'https://linux.do/user_avatar/example/stevessr/32/1589755_2.png'
  )
})

test('linux.do emoji URLs are rewritten to the CDN to offload the main site', () => {
  // 用户示例：主机换 CDN + 文件名特判映射
  assert.equal(
    discourseUtils.rewriteEmojiUrlForCdn(
      'https://linux.do/images/emoji/twemoji/smiling_face_with_three_hearts.png?v=15'
    ),
    'https://cdn.ldstatic.com/images/emoji/twemoji/heart.png?v=15'
  )
  // 普通表情：仅主机换 CDN，查询串保留
  assert.equal(
    discourseUtils.rewriteEmojiUrlForCdn('https://linux.do/images/emoji/twemoji/heart.png?v=15'),
    'https://cdn.ldstatic.com/images/emoji/twemoji/heart.png?v=15'
  )
  // 非 linux.do 主机的表情不改写
  assert.equal(
    discourseUtils.rewriteEmojiUrlForCdn(
      'https://meta.discourse.org/images/emoji/twemoji/heart.png?v=15'
    ),
    'https://meta.discourse.org/images/emoji/twemoji/heart.png?v=15'
  )
  // 已是 CDN 地址不改写
  assert.equal(
    discourseUtils.rewriteEmojiUrlForCdn(
      'https://cdn.ldstatic.com/images/emoji/twemoji/heart.png?v=15'
    ),
    'https://cdn.ldstatic.com/images/emoji/twemoji/heart.png?v=15'
  )
  // 非表情路径（上传/优化图）不改写
  assert.equal(
    discourseUtils.rewriteEmojiUrlForCdn('https://linux.do/uploads/default/original/1x/abc.png'),
    'https://linux.do/uploads/default/original/1x/abc.png'
  )
})

test('page-fetch concurrency can be adjusted at runtime and clamps to 1..8', () => {
  const original = discourseUtils.getPageFetchMaxConcurrency()
  try {
    assert.ok(original >= 1)
    // 设置 3 后生效
    const updated = discourseUtils.setPageFetchMaxConcurrency(3)
    assert.equal(discourseUtils.getPageFetchMaxConcurrency(), 3)
    assert.equal(updated, 3)
    // 超过上限向下钳制到 8
    assert.equal(discourseUtils.setPageFetchMaxConcurrency(99), 8)
    // 非法值（0/负数/NaN）保持当前值不变
    const before = discourseUtils.getPageFetchMaxConcurrency()
    assert.equal(discourseUtils.setPageFetchMaxConcurrency(0), before)
    assert.equal(discourseUtils.setPageFetchMaxConcurrency(Number.NaN), before)
    // 恢复
    assert.equal(discourseUtils.setPageFetchMaxConcurrency(1), 1)
  } finally {
    discourseUtils.setPageFetchMaxConcurrency(original)
  }
})

test('quoted avatars preserve CDN formats instead of manufacturing a gif URL', () => {
  const tree = {
    type: 'root',
    children: [
      {
        type: 'element',
        tagName: 'aside',
        properties: { className: ['quote'] },
        children: [
          {
            type: 'element',
            tagName: 'div',
            properties: { className: ['title'] },
            children: [
              {
                type: 'element',
                tagName: 'img',
                properties: {
                  className: ['avatar'],
                  src: '//cdn.ldstatic.com/user_avatar/linux.do/atri/24/2345717_2.png'
                },
                children: []
              }
            ]
          }
        ]
      }
    ]
  }

  transformQuotesModule.transformQuotes(
    tree,
    parserContext.createParseContext('https://linux.do', () => '')
  )
  assert.equal(
    tree.children[0].children[0].children[0].properties.src,
    'https://cdn.ldstatic.com/user_avatar/linux.do/atri/24/2345717_2.png'
  )
})
