import { ref } from 'vue'

import { createDatabaseFile, parseDatabaseFile } from '@/utils/cacheExportHelpers'

export function useCacheExportImport(refreshCacheStats: () => Promise<void>) {
  const isExporting = ref(false)
  const isImporting = ref(false)
  const exportImportError = ref('')

  const exportCache = async () => {
    isExporting.value = true
    exportImportError.value = ''

    try {
      // 使用与 UI 统计相同的缓存服务
      const { imageCache } = await import('@/utils/imageCache')
      await imageCache.init()

      // 获取所有缓存数据
      const stats = await imageCache.getCacheStats()
      console.log(`[StatsPage] 准备导出缓存：${stats.totalEntries} 个图片`)

      if (stats.totalEntries === 0) {
        message.warning('没有找到任何缓存数据')
        return
      }

      // 获取所有缓存条目
      const allEntries = await imageCache.getAllEntries()
      console.log(`[StatsPage] 获取到 ${allEntries.length} 个缓存条目`)

      // 分批处理以避免内存问题
      const batchSize = 50
      const processedImages: any[] = []

      for (let i = 0; i < allEntries.length; i += batchSize) {
        const batch = allEntries.slice(i, i + batchSize)
        console.log(
          `[StatsPage] 处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(allEntries.length / batchSize)} (${batch.length} 个图片)`
        )

        const batchResults = await Promise.allSettled(
          batch.map(async entry => {
            try {
              // 使用 FileReader 安全地转换 Blob
              const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve(reader.result as ArrayBuffer)
                reader.onerror = () => reject(new Error('Failed to read blob'))
                reader.readAsArrayBuffer(entry.blob)
              })

              return {
                id: entry.id,
                url: entry.url,
                timestamp: entry.timestamp,
                size: entry.size,
                lastAccessed: entry.lastAccessed,
                accessCount: entry.accessCount,
                data: arrayBuffer,
                mimeType: entry.blob.type
              }
            } catch (error) {
              console.error(`[StatsPage] 处理图片失败 ${entry.url}:`, error)
              return null
            }
          })
        )

        // 过滤成功的结果
        const successfulResults = batchResults
          .filter(
            (result): result is PromiseFulfilledResult<any> =>
              result.status === 'fulfilled' && result.value !== null
          )
          .map(result => result.value)

        processedImages.push(...successfulResults)

        // 添加延迟以避免浏览器压力过大
        if (i + batchSize < allEntries.length) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }

      console.log(
        `[StatsPage] 成功处理 ${processedImages.length} 个图片，失败 ${allEntries.length - processedImages.length} 个`
      )

      // 创建导出数据
      const exportData = {
        metadata: {
          version: '1.0',
          exportDate: new Date().toISOString(),
          totalImages: processedImages.length,
          totalSize: processedImages.reduce((sum, img) => sum + img.size, 0),
          dbName: 'ImageCacheDB',
          storeName: 'images'
        },
        images: processedImages
      }

      // 创建二进制文件
      const dbFile = await createDatabaseFile(exportData)
      const filename = `emoji-cache-${new Date().toISOString().split('T')[0]}.db`

      // 创建下载链接
      const blob = new Blob([dbFile], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      message.success(
        `已导出缓存：${exportData.metadata.totalImages} 个图片，${(exportData.metadata.totalSize / 1024 / 1024).toFixed(2)}MB`
      )
      console.log('Cache export completed:', exportData.metadata)
    } catch (error: any) {
      exportImportError.value = error.message || '导出失败'
      message.error('导出缓存失败')
      console.error('Export cache error:', error)
    } finally {
      isExporting.value = false
    }
  }

  const importCache = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.db'

    input.onchange = async event => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (!file) return

      isImporting.value = true
      exportImportError.value = ''

      try {
        const arrayBuffer = await file.arrayBuffer()
        const importData = await parseDatabaseFile(arrayBuffer)

        // 使用与 UI 统计相同的缓存服务
        const { imageCache } = await import('@/utils/imageCache')
        await imageCache.init()

        let imported = 0
        let skipped = 0
        const errors: string[] = []

        for (const imgData of importData.images) {
          try {
            // 检查是否已存在
            const existing = await (imageCache as any).get(imgData.url)

            if (existing) {
              // 如果已存在，检查是否需要更新
              if (existing.timestamp >= imgData.timestamp) {
                skipped++
                continue
              }
            }

            // 将 ArrayBuffer 转换为 Blob
            try {
              const blob = new Blob([imgData.data], { type: imgData.mimeType })

              // 验证 Blob 是否有效
              if (blob.size === 0) {
                throw new Error('Empty blob created')
              }

              // 缓存图片
              await (imageCache as any).set(imgData.url, blob)
              imported++
              console.log(`[StatsPage] 成功导入：${imgData.url}`)
            } catch (blobError) {
              console.error(`[StatsPage] 创建 Blob 失败 ${imgData.url}:`, blobError)
              errors.push(`创建 Blob 失败 ${imgData.url}: ${blobError}`)
            }
          } catch (error) {
            errors.push(`处理图片失败 ${imgData.url}: ${error}`)
          }
        }

        if (errors.length > 0) {
          message.warning(
            `导入完成：${imported} 个新图片，${skipped} 个已跳过，${errors.length} 个错误`
          )
          console.warn('Import errors:', errors)
        } else {
          message.success(`导入完成：${imported} 个新图片，${skipped} 个已跳过`)
        }

        // 刷新缓存统计
        await refreshCacheStats()
      } catch (error: any) {
        exportImportError.value = error.message || '导入失败'
        message.error('导入缓存失败')
        console.error('Import cache error:', error)
      } finally {
        isImporting.value = false
      }
    }

    input.click()
  }

  return {
    isExporting,
    isImporting,
    exportImportError,
    exportCache,
    importCache
  }
}
