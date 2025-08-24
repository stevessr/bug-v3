// External emoji import utilities
export interface TenorGif {
  id: string
  content_description: string
  media_formats: {
    tinygif: {
      url: string
    }
  }
}

export interface WalineEmojis {
  [name: string]: string
}

export class ExternalEmojiImporter {
  async searchTenorGifs(query: string): Promise<TenorGif[]> {
    if (!query.trim()) {
      throw new Error('请输入搜索关键词')
    }

    const response = await fetch(
      `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&limit=20`
    )
    const data = await response.json()
    return data.results || []
  }

  async importWalineEmojis(url: string): Promise<WalineEmojis> {
    if (!url.trim()) {
      throw new Error('请输入 Waline 表情包 URL')
    }

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`请求失败: ${response.status} ${response.statusText}`)
    }

    const emojis = await response.json()
    
    if (typeof emojis !== 'object' || emojis === null) {
      throw new Error('Waline 表情包格式不正确')
    }

    return emojis as WalineEmojis
  }

  processLocalFile(file: File): Promise<{ name: string; url: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        resolve({
          name: file.name.replace(/\.[^/.]+$/, ''),
          url: dataUrl
        })
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  createEmoji(name: string, url: string, groupId?: string) {
    return {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      name,
      url,
      groupId,
      addedAt: Date.now()
    }
  }

  createGroupIfNotExists(groupName: string, icon: string, existingGroups: any[]) {
    let group = existingGroups.find(g => g.name === groupName)
    if (!group) {
      group = {
        id: Date.now().toString(),
        name: groupName,
        icon,
        emojis: []
      }
      existingGroups.push(group)
    }
    return group
  }
}