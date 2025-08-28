import { ref, onMounted, onBeforeUnmount, readonly, type Ref } from 'vue'
import {
  loadContainerSize,
  saveContainerSize,
  type ContainerSizeSettings,
} from '../../data/update/storage'

export function useResizableContainer(containerRef: Ref<HTMLElement | undefined>) {
  const containerHeight = ref(400) // 默认高度
  const isResizing = ref(false)
  const isDragging = ref(false)
  const minHeight = 200
  const maxHeight = ref(0)

  // 加载保存的高度设置
  onMounted(async () => {
    // 设置最大高度为窗口高度的100倍
    maxHeight.value = window.innerHeight * 100

    try {
      const savedSize = await loadContainerSize()
      if (savedSize && savedSize.height) {
        const height = Math.min(Math.max(savedSize.height, minHeight), maxHeight.value)
        containerHeight.value = height
        console.log('[ResizableContainer] Restored height:', height)
      }
    } catch (error) {
      console.warn('[ResizableContainer] Failed to load saved container size:', error)
    }

    // 监听窗口大小变化，更新最大高度
    const updateMaxHeight = async () => {
      maxHeight.value = window.innerHeight * 0.8
      // 如果当前高度超过新的最大高度，则调整
      if (containerHeight.value > maxHeight.value) {
        containerHeight.value = maxHeight.value
        await saveHeight()
      }
    }

    window.addEventListener('resize', updateMaxHeight)

    // 清理函数
    onBeforeUnmount(() => {
      window.removeEventListener('resize', updateMaxHeight)
    })
  })

  // 保存高度设置
  const saveHeight = async () => {
    try {
      const sizeSettings: ContainerSizeSettings = {
        height: containerHeight.value,
        isUserModified: true,
        lastModified: new Date(),
      }
      await saveContainerSize(sizeSettings)
      console.log('[ResizableContainer] Saved height:', containerHeight.value)
    } catch (error) {
      console.warn('[ResizableContainer] Failed to save container size:', error)
    }
  }

  // 拖拽处理
  const startResize = (event: MouseEvent) => {
    event.preventDefault()
    isResizing.value = true
    isDragging.value = true

    const startY = event.clientY
    const startHeight = containerHeight.value

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.value) return

      const deltaY = e.clientY - startY
      const newHeight = Math.min(Math.max(startHeight + deltaY, minHeight), maxHeight.value)
      containerHeight.value = newHeight
    }

    const handleMouseUp = async () => {
      if (!isDragging.value) return

      isResizing.value = false
      isDragging.value = false
      await saveHeight()

      // 清理事件监听器
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)

      // 防止文本选择
      document.body.style.userSelect = ''
      document.body.style.pointerEvents = ''
    }

    // 防止文本选择
    document.body.style.userSelect = 'none'
    document.body.style.pointerEvents = 'none'

    // 添加事件监听器
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // 重置为默认大小
  const resetToDefault = async () => {
    containerHeight.value = 400
    await saveHeight()
  }

  // 设置特定高度
  const setHeight = async (height: number) => {
    const newHeight = Math.min(Math.max(height, minHeight), maxHeight.value)
    containerHeight.value = newHeight
    await saveHeight()
  }

  // 获取当前约束信息
  const getConstraints = () => ({
    min: minHeight,
    max: maxHeight.value,
    current: containerHeight.value,
  })

  return {
    containerHeight: readonly(containerHeight),
    isResizing: readonly(isResizing),
    isDragging: readonly(isDragging),
    minHeight,
    maxHeight: readonly(maxHeight),
    startResize,
    resetToDefault,
    setHeight,
    getConstraints,
  }
}
