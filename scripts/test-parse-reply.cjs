const fs = require('fs')
const path = require('path')

const p = path.join(__dirname, '../docs/referense/reply.json')
const raw = fs.readFileSync(p, 'utf8')
const data = JSON.parse(raw)

function extractPosts(data) {
  if (data && data.post_stream && Array.isArray(data.post_stream.posts)) return data.post_stream.posts
  if (data && Array.isArray(data.posts)) return data.posts
  return []
}

const posts = extractPosts(data)
console.log('posts.length =', posts.length)
if (posts.length > 0) {
  console.log('first post id:', posts[0].id)
  console.log('first post post_number:', posts[0].post_number)
}

// simulate building timings for a batch of ids
const ids = posts.map(p => p.id).filter(v => typeof v === 'number')
const BATCH_SIZE = 7
const batch = ids.slice(0, BATCH_SIZE)
const timings = {}
for (const id of batch) {
  const post = posts.find(p => p.id === id)
  const pn = post && typeof post.post_number === 'number' ? post.post_number : null
  const key = pn !== null ? pn : id
  timings[key] = 1000
}
console.log('timings sample:', timings)
