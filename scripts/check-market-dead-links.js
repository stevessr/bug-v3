import fs from 'fs'
import path from 'path'
import https from 'https'
import { URL } from 'url'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 市场元数据文件路径
const MARKET_METADATA_PATH = path.join(__dirname, 'cfworker/public/assets/market/metadata.json')
const MARKET_JSON_DIR = path.join(__dirname, 'cfworker/public/assets/market')

// 并发请求限制
const CONCURRENCY_LIMIT = 50
// 超时时间 (ms)
const TIMEOUT = 10000

// 统计信息
const stats = {
  total: 0,
  checked: 0,
  success: 0,
  failed: 0,
  errors: []
}

/**
 * 检查 URL 是否可访问
 * @param {string} urlStr - 要检查的 URL
 * @returns {Promise<boolean>}
 */
function checkUrl(urlStr) {
  return new Promise(resolve => {
    try {
      const url = new URL(urlStr)

      // 跳过非 http/https 协议
      if (!['http:', 'https:'].includes(url.protocol)) {
        resolve(true) // 认为是有效的，因为我们无法检查
        return
      }

      const req = https.request(
        url,
        {
          method: 'HEAD',
          timeout: TIMEOUT,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        },
        res => {
          // 2xx, 3xx 视为成功
          // 404, 410 等视为失败
          // 403 有可能是防盗链，但也可能是死链，这里保守起见，只把 404/410 明确标记为失效
          // 如果是 429 (Too Many Requests)，视为成功以免误判
          if (res.statusCode === 404 || res.statusCode === 410) {
            resolve(false)
          } else {
            resolve(true)
          }
        }
      )

      req.on('error', err => {
        // 网络错误通常意味着无法连接，可能 DNS 解析失败或超时
        // 对于批量检测，超时可能很常见，为了不误判，我们可以记录警告但不视为必须移除
        // 但如果域名不存在 (ENOTFOUND)，则肯定是死链
        if (err.code === 'ENOTFOUND') {
          resolve(false)
        } else {
          // 其他错误（如超时），暂且放过，或者你可以选择 resolve(false)
          // 这里我们放宽标准，只标记明确的 DNS 错误
          // console.warn(`Warning: checking ${urlStr} failed with ${err.code}`);
          resolve(true)
        }
      })

      req.on('timeout', () => {
        req.destroy()
        resolve(true) // 超时暂不视为死链
      })

      req.end()
    } catch (e) {
      resolve(false)
    }
  })
}

/**
 * 带有并发限制的批量处理
 * @param {Array} items - 要处理的项
 * @param {Function} iteratorFn - 处理函数
 * @param {number} limit - 并发限制
 */
async function asyncPool(items, iteratorFn, limit) {
  const ret = []
  const executing = []

  for (const item of items) {
    const p = Promise.resolve().then(() => iteratorFn(item))
    ret.push(p)

    if (limit <= items.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1))
      executing.push(e)
      if (executing.length >= limit) {
        await Promise.race(executing)
      }
    }
  }

  return Promise.all(ret)
}

/**
 * 主函数
 */
async function main() {
  console.log('开始检查市场图片链接...')

  // 1. 读取 metadata.json 获取所有分组 ID
  if (!fs.existsSync(MARKET_METADATA_PATH)) {
    console.error(`Metadata file not found: ${MARKET_METADATA_PATH}`)
    process.exit(1)
  }

  const metadata = JSON.parse(fs.readFileSync(MARKET_METADATA_PATH, 'utf-8'))
  let groups = metadata.groups || []

  // 命令行参数支持指定分组 ID
  const targetGroupId = process.argv[2]
  if (targetGroupId) {
    console.log(`指定检查分组: ${targetGroupId}`)
    groups = groups.filter(g => g.id === targetGroupId)
    if (groups.length === 0) {
      console.error(`未找到 ID 为 ${targetGroupId} 的分组！`)
      process.exit(1)
    }
  }

  console.log(`找到 ${groups.length} 个分组，准备检查...`)

  // 收集所有需要检查的图片 URL 及其归属信息
  const allImages = []

  // 检查分组图标
  groups.forEach(group => {
    if (group.icon) {
      allImages.push({
        url: group.icon,
        type: 'group_icon',
        groupId: group.id,
        groupName: group.name
      })
    }
  })

  // 读取每个分组的 json 文件获取表情图片
  for (const group of groups) {
    const jsonPath = path.join(MARKET_JSON_DIR, `group-${group.id}.json`)
    if (fs.existsSync(jsonPath)) {
      try {
        const groupData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
        const emojis = groupData.emojis || []

        emojis.forEach(emoji => {
          if (emoji.url) {
            allImages.push({
              url: emoji.url,
              type: 'emoji',
              groupId: group.id,
              groupName: group.name,
              emojiId: emoji.id,
              emojiName: emoji.name
            })
          }
        })
      } catch (e) {
        console.error(`Failed to read group json: ${jsonPath}`, e)
      }
    } else {
      console.warn(`Group JSON file not found: ${jsonPath}`)
    }
  }

  stats.total = allImages.length
  console.log(`总共收集到 ${stats.total} 个图片链接，开始并发检查...`)

  // 并发检查
  await asyncPool(
    allImages,
    async img => {
      // 进度显示
      stats.checked++
      if (stats.checked % 100 === 0) {
        process.stdout.write(
          `进度：${stats.checked}/${stats.total} (${Math.round((stats.checked / stats.total) * 100)}%)\r`
        )
      }

      const isValid = await checkUrl(img.url)

      if (isValid) {
        stats.success++
      } else {
        stats.failed++
        const errorMsg = `[${img.groupId}] ${img.groupName} - ${img.type === 'emoji' ? img.emojiName : 'ICON'} (ID: ${img.emojiId || 'N/A'}): ${img.url}`
        stats.errors.push(errorMsg)
        console.log(`\n❌ 发现死链：${errorMsg}`)
      }
    },
    CONCURRENCY_LIMIT
  )

  console.log('\n\n================ 检查报告 ================')
  console.log(`总数：${stats.total}`)
  console.log(`有效：${stats.success}`)
  console.log(`失效：${stats.failed}`)
  console.log('==========================================')

  if (stats.failed > 0) {
    console.log('\n失效链接列表：')
    stats.errors.forEach(err => console.log(err))

    // 保存报告到文件
    const reportPath = path.join(__dirname, 'dead_links_report.txt')
    fs.writeFileSync(reportPath, stats.errors.join('\n'))
    console.log(`\n详细报告已保存至：${reportPath}`)

    process.exit(1) // 只要有死链就返回非零状态码
  } else {
    console.log('\n✨ 所有图片链接检查通过！')
    process.exit(0)
  }
}

main().catch(err => {
  console.error('Unhandled error:', err)
  process.exit(1)
})
