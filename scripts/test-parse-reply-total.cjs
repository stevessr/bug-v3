const fs = require('fs')
const path = require('path')

const p = path.join(__dirname, '../docs/referense/reply.json')
const raw = fs.readFileSync(p, 'utf8')
const data = JSON.parse(raw)

function extractPostsAndTotal(data) {
  let posts = []
  let totalCount = 0
  if (data && data.post_stream && Array.isArray(data.post_stream.posts)) {
    posts = data.post_stream.posts
    if (posts.length > 0 && typeof posts[0].posts_count === 'number') {
      totalCount = posts[0].posts_count
    }
  }
  if ((!posts || posts.length === 0) && data && Array.isArray(data.posts)) posts = data.posts
  if (!totalCount) {
    if (data && typeof data.highest_post_number === 'number') totalCount = data.highest_post_number
    else if (data && typeof data.posts_count === 'number') totalCount = data.posts_count
    else if (posts && posts.length > 0) totalCount = posts.length
  }
  return { posts, totalCount }
}

const { posts, totalCount } = extractPostsAndTotal(data)
console.log('posts.length =', posts.length)
console.log('totalCount =', totalCount)

const total = totalCount || posts.length
const postNumbers = []
for (let n = 1; n <= total; n++) postNumbers.push(n)
console.log('postNumbers sample (first 20):', postNumbers.slice(0, 20))

const BATCH_SIZE = 7
for (let i = 0; i < postNumbers.length && i < 21; i += BATCH_SIZE) {
  const batch = postNumbers.slice(i, i + BATCH_SIZE)
  const timings = {}
  for (const pn of batch) timings[pn] = 1000
  console.log('batch timings:', timings)
}
