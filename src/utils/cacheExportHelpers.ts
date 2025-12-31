// 辅助函数：创建数据库文件
export const createDatabaseFile = async (exportData: any): Promise<ArrayBuffer> => {
  // 创建文件头
  const header = new TextEncoder().encode('EMOJI_CACHE_DB_V1.0')

  // 序列化元数据
  const metadataBytes = new TextEncoder().encode(JSON.stringify(exportData.metadata))
  const metadataLength = new Uint32Array([metadataBytes.length])

  // 序列化图片数据
  const imageData = await Promise.all(
    exportData.images.map(async (img: any) => {
      const urlBytes = new TextEncoder().encode(img.url)
      const idBytes = new TextEncoder().encode(img.id)

      return {
        header: {
          id: img.id,
          idLength: idBytes.length,
          urlLength: urlBytes.length,
          hashLength: 0,
          mimeTypeLength: new TextEncoder().encode(img.mimeType).length,
          timestamp: img.timestamp,
          size: img.size,
          lastAccessed: img.lastAccessed,
          accessCount: img.accessCount,
          dataLength: img.data.byteLength
        },
        idBytes,
        urlBytes,
        hashBytes: new Uint8Array(0),
        mimeTypeBytes: new TextEncoder().encode(img.mimeType),
        dataArray: new Uint8Array(img.data)
      }
    })
  )

  // 计算总大小
  let totalSize = header.length + 4 + metadataBytes.length
  for (const img of imageData) {
    totalSize += 64 // fixed header size
    totalSize += img.idBytes.length
    totalSize += img.urlBytes.length
    totalSize += img.hashBytes.length
    totalSize += img.mimeTypeBytes.length
    totalSize += img.dataArray.length
  }

  // 创建 ArrayBuffer
  const buffer = new ArrayBuffer(totalSize)
  const view = new Uint8Array(buffer)
  let offset = 0

  // 写入文件头
  view.set(header, offset)
  offset += header.length

  // 写入元数据长度和元数据
  view.set(new Uint8Array(metadataLength.buffer), offset)
  offset += 4
  view.set(metadataBytes, offset)
  offset += metadataBytes.length

  // 写入图片数据
  for (const img of imageData) {
    // 写入头部信息
    const headerView = new DataView(buffer, offset, 64)
    headerView.setUint32(0, img.header.idLength, true)
    headerView.setUint32(4, img.header.urlLength, true)
    headerView.setUint32(8, img.header.hashLength, true)
    headerView.setUint32(12, img.header.mimeTypeLength, true)
    headerView.setBigUint64(16, BigInt(img.header.timestamp), true)
    headerView.setUint32(24, img.header.size, true)
    headerView.setBigUint64(28, BigInt(img.header.lastAccessed), true)
    headerView.setUint32(36, img.header.accessCount, true)
    headerView.setUint32(40, img.header.dataLength, true)
    offset += 64

    // 写入各个字段
    view.set(img.idBytes, offset)
    offset += img.idBytes.length

    view.set(img.urlBytes, offset)
    offset += img.urlBytes.length

    view.set(img.hashBytes, offset)
    offset += img.hashBytes.length

    view.set(img.mimeTypeBytes, offset)
    offset += img.mimeTypeBytes.length

    view.set(img.dataArray, offset)
    offset += img.dataArray.length
  }

  return buffer
}

// 辅助函数：解析数据库文件
export const parseDatabaseFile = async (
  arrayBuffer: ArrayBuffer
): Promise<{ metadata: any; images: any[] }> => {
  const view = new Uint8Array(arrayBuffer)
  let offset = 0

  // 检查文件头
  const header = new TextDecoder().decode(view.slice(offset, offset + 18))
  if (header !== 'EMOJI_CACHE_DB_V1.0') {
    throw new Error('无效的缓存文件格式')
  }
  offset += 18

  // 读取元数据
  const metadataLength = new DataView(arrayBuffer, offset, 4).getUint32(0, true)
  offset += 4
  const metadataBytes = view.slice(offset, offset + metadataLength)
  const metadata = JSON.parse(new TextDecoder().decode(metadataBytes))
  offset += metadataLength

  // 读取图片数据
  const images: any[] = []
  const endOffset = arrayBuffer.byteLength

  while (offset < endOffset) {
    const headerView = new DataView(arrayBuffer, offset, 64)
    const idLength = headerView.getUint32(0, true)
    const urlLength = headerView.getUint32(4, true)
    const hashLength = headerView.getUint32(8, true)
    const mimeTypeLength = headerView.getUint32(12, true)
    const timestamp = Number(headerView.getBigUint64(16, true))
    const size = headerView.getUint32(24, true)
    const lastAccessed = Number(headerView.getBigUint64(28, true))
    const accessCount = headerView.getUint32(36, true)
    const dataLength = headerView.getUint32(40, true)
    offset += 64

    const id = new TextDecoder().decode(view.slice(offset, offset + idLength))
    offset += idLength

    const url = new TextDecoder().decode(view.slice(offset, offset + urlLength))
    offset += urlLength

    offset += hashLength // 跳过哈希

    const mimeType = new TextDecoder().decode(view.slice(offset, offset + mimeTypeLength))
    offset += mimeTypeLength

    const data = view.slice(offset, offset + dataLength).buffer
    offset += dataLength

    images.push({
      id,
      url,
      mimeType,
      timestamp,
      size,
      lastAccessed,
      accessCount,
      data
    })
  }

  return { metadata, images }
}
