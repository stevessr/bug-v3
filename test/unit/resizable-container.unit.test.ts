import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useResizableContainer } from '../../src/options/composables/useResizableContainer'
import { loadContainerSize, saveContainerSize, type ContainerSizeSettings } from '../../src/data/update/storage'

// Mock the storage functions
vi.mock('../../src/data/update/storage', () => ({
  loadContainerSize: vi.fn(),
  saveContainerSize: vi.fn(),
}))

// Mock window properties
Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 1000,
})

describe('useResizableContainer - 容器大小调整功能测试', () => {
  let containerRef: any
  let resizableContainer: any

  beforeEach(() => {
    // 重置模拟函数
    vi.clearAllMocks()

    // 创建容器引用
    containerRef = ref<HTMLElement>()

    // 模拟 DOM 元素
    const mockElement = {
      style: {},
      offsetHeight: 400,
    } as HTMLElement

    containerRef.value = mockElement

    // 初始化 useResizableContainer
    resizableContainer = useResizableContainer(containerRef)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('初始化', () => {
    it('应该设置默认高度为400px', () => {
      expect(resizableContainer.containerHeight.value).toBe(400)
    })

    it('应该设置最大高度为窗口高度的80%', () => {
      expect(resizableContainer.maxHeight.value).toBe(800) // 1000 * 0.8
    })

    it('应该从存储中恢复保存的高度', () => {
      const mockSavedSize: ContainerSizeSettings = {
        height: 500,
        isUserModified: true,
        lastModified: new Date(),
      }

      vi.mocked(loadContainerSize).mockReturnValue(mockSavedSize)

      // 重新初始化
      const newResizableContainer = useResizableContainer(containerRef)

      expect(newResizableContainer.containerHeight.value).toBe(500)
    })

    it('保存的高度超过最大值时应该调整为最大值', () => {
      const mockSavedSize: ContainerSizeSettings = {
        height: 1500, // 超过最大值
        isUserModified: true,
        lastModified: new Date(),
      }

      vi.mocked(loadContainerSize).mockReturnValue(mockSavedSize)

      const newResizableContainer = useResizableContainer(containerRef)

      expect(newResizableContainer.containerHeight.value).toBe(800) // 应该被限制为最大值
    })
  })

  describe('拖拽调整大小', () => {
    it('应该能够开始拖拽调整', () => {
      const mockEvent = {
        preventDefault: vi.fn(),
        clientY: 100,
      } as any

      // 开始拖拽
      resizableContainer.startResize(mockEvent)

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(resizableContainer.isResizing.value).toBe(true)
      expect(resizableContainer.isDragging.value).toBe(true)
    })

    it('拖拽过程中应该更新容器高度', () => {
      const startEvent = {
        preventDefault: vi.fn(),
        clientY: 100,
      } as any

      // 开始拖拽
      resizableContainer.startResize(startEvent)

      // 模拟鼠标移动事件
      const moveEvent = new MouseEvent('mousemove', {
        clientY: 150, // 向下移动50px
      })

      document.dispatchEvent(moveEvent)

      // 高度应该增加50px
      expect(resizableContainer.containerHeight.value).toBe(450)
    })

    it('拖拽时应该遵守最小高度限制', () => {
      const startEvent = {
        preventDefault: vi.fn(),
        clientY: 100,
      } as any

      // 开始拖拽
      resizableContainer.startResize(startEvent)

      // 模拟向上大幅移动（试图缩小到最小值以下）
      const moveEvent = new MouseEvent('mousemove', {
        clientY: -300, // 向上移动400px，应该被限制为最小值
      })

      document.dispatchEvent(moveEvent)

      // 高度应该被限制为最小值200px
      expect(resizableContainer.containerHeight.value).toBe(200)
    })

    it('拖拽时应该遵守最大高度限制', () => {
      const startEvent = {
        preventDefault: vi.fn(),
        clientY: 100,
      } as any

      // 开始拖拽
      resizableContainer.startResize(startEvent)

      // 模拟向下大幅移动（试图放大到最大值以上）
      const moveEvent = new MouseEvent('mousemove', {
        clientY: 1000, // 向下移动900px，应该被限制为最大值
      })

      document.dispatchEvent(moveEvent)

      // 高度应该被限制为最大值800px
      expect(resizableContainer.containerHeight.value).toBe(800)
    })

    it('结束拖拽时应该保存高度设置', () => {
      const startEvent = {
        preventDefault: vi.fn(),
        clientY: 100,
      } as any

      // 开始拖拽
      resizableContainer.startResize(startEvent)

      // 模拟鼠标抬起事件
      const upEvent = new MouseEvent('mouseup')
      document.dispatchEvent(upEvent)

      // 应该保存高度设置
      expect(saveContainerSize).toHaveBeenCalledWith(
        expect.objectContaining({
          height: expect.any(Number),
          isUserModified: true,
          lastModified: expect.any(Date),
        })
      )

      // 状态应该重置
      expect(resizableContainer.isResizing.value).toBe(false)
      expect(resizableContainer.isDragging.value).toBe(false)
    })
  })

  describe('程序化高度设置', () => {
    it('应该能够重置为默认高度', () => {
      // 先设置为其他高度
      resizableContainer.setHeight(500)
      expect(resizableContainer.containerHeight.value).toBe(500)

      // 重置为默认
      resizableContainer.resetToDefault()

      expect(resizableContainer.containerHeight.value).toBe(400)
      expect(saveContainerSize).toHaveBeenCalled()
    })

    it('应该能够设置特定高度', () => {
      resizableContainer.setHeight(300)

      expect(resizableContainer.containerHeight.value).toBe(300)
      expect(saveContainerSize).toHaveBeenCalledWith(
        expect.objectContaining({
          height: 300,
          isUserModified: true,
        })
      )
    })

    it('设置高度时应该遵守约束', () => {
      // 测试最小值约束
      resizableContainer.setHeight(100) // 小于最小值200
      expect(resizableContainer.containerHeight.value).toBe(200)

      // 测试最大值约束
      resizableContainer.setHeight(1000) // 大于最大值800
      expect(resizableContainer.containerHeight.value).toBe(800)
    })
  })

  describe('约束信息', () => {
    it('应该返回正确的约束信息', () => {
      const constraints = resizableContainer.getConstraints()

      expect(constraints).toEqual({
        min: 200,
        max: 800,
        current: 400,
      })
    })

    it('约束信息应该随容器高度变化更新', () => {
      resizableContainer.setHeight(500)

      const constraints = resizableContainer.getConstraints()

      expect(constraints.current).toBe(500)
    })
  })

  describe('窗口大小变化响应', () => {
    it('窗口大小变化时应该更新最大高度', () => {
      // 模拟窗口大小变化
      Object.defineProperty(window, 'innerHeight', {
        value: 1200,
      })

      // 触发resize事件
      window.dispatchEvent(new Event('resize'))

      // 等待事件处理
      setTimeout(() => {
        expect(resizableContainer.maxHeight.value).toBe(960) // 1200 * 0.8
      }, 0)
    })

    it('当前高度超过新最大高度时应该调整', () => {
      // 设置较大的高度
      resizableContainer.setHeight(700)

      // 模拟窗口变小
      Object.defineProperty(window, 'innerHeight', {
        value: 600, // 最大高度变为480
      })

      // 触发resize事件
      window.dispatchEvent(new Event('resize'))

      // 等待事件处理
      setTimeout(() => {
        expect(resizableContainer.containerHeight.value).toBe(480)
        expect(saveContainerSize).toHaveBeenCalled()
      }, 0)
    })
  })

  describe('错误处理', () => {
    it('存储操作失败时应该继续正常工作', () => {
      // 模拟存储失败
      vi.mocked(saveContainerSize).mockImplementation(() => {
        throw new Error('Storage failed')
      })

      // 设置高度不应该抛出错误
      expect(() => {
        resizableContainer.setHeight(300)
      }).not.toThrow()
    })

    it('加载存储失败时应该使用默认值', () => {
      // 模拟加载失败
      vi.mocked(loadContainerSize).mockImplementation(() => {
        throw new Error('Load failed')
      })

      // 重新初始化
      const newResizableContainer = useResizableContainer(containerRef)

      // 应该使用默认高度
      expect(newResizableContainer.containerHeight.value).toBe(400)
    })
  })

  describe('响应式属性', () => {
    it('containerHeight应该是只读的', () => {
      expect(() => {
        // @ts-expect-error - 测试运行时行为
        resizableContainer.containerHeight.value = 999
      }).toThrow()
    })

    it('isResizing应该是只读的', () => {
      expect(() => {
        // @ts-expect-error - 测试运行时行为
        resizableContainer.isResizing.value = true
      }).toThrow()
    })

    it('isDragging应该是只读的', () => {
      expect(() => {
        // @ts-expect-error - 测试运行时行为
        resizableContainer.isDragging.value = true
      }).toThrow()
    })
  })
})