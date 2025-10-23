/**
 * X (Twitter) 功能配置
 * 控制各项注入功能的开关
 */

export const xConfig = {
  /**
   * 图片注入功能配置
   * 控制是否在 X (Twitter) 的不同场景下注入"添加表情"按钮
   */
  imageInjection: {
    /**
     * 轮播图图片
     * 包括：[role="group"][aria-roledescription="carousel"]
     */
    enableCarousel: true,

    /**
     * 推文中的图片
     * 包括：article[data-testid="tweet"] 中的图片
     */
    enableTweetImages: false,

    /**
     * 对话框/模态框中的图片
     * 包括：[role="dialog"], [aria-modal="true"]
     */
    enableDialogImages: true,

    /**
     * 列表项图片
     * 包括：li[role="listitem"]
     */
    enableListItemImages: false,

    /**
     * 滑动关闭元素中的图片
     * 包括：[data-testid="swipe-to-dismiss"]
     */
    enableSwipeToDismissImages: false,

    /**
     * 独立媒体页面图片
     * 访问 pbs.twimg.com 图片链接时
     */
    enableStandaloneMediaImages: true
  }
} as const

/**
 * 图片类型枚举
 */
export enum ImageType {
  Carousel = 'carousel',
  Tweet = 'tweet',
  Dialog = 'dialog',
  ListItem = 'listItem',
  SwipeToDismiss = 'swipeToDismiss',
  StandaloneMedia = 'standaloneMedia'
}

/**
 * 检查特定类型的图片注入是否启用
 */
export function isImageInjectionEnabled(type?: ImageType): boolean {
  // 如果没有指定类型，检查是否至少有一个类型启用
  if (!type) {
    return (
      xConfig.imageInjection.enableCarousel ||
      xConfig.imageInjection.enableTweetImages ||
      xConfig.imageInjection.enableDialogImages ||
      xConfig.imageInjection.enableListItemImages ||
      xConfig.imageInjection.enableSwipeToDismissImages ||
      xConfig.imageInjection.enableStandaloneMediaImages
    )
  }

  // 根据类型返回对应的配置
  switch (type) {
    case ImageType.Carousel:
      return xConfig.imageInjection.enableCarousel
    case ImageType.Tweet:
      return xConfig.imageInjection.enableTweetImages
    case ImageType.Dialog:
      return xConfig.imageInjection.enableDialogImages
    case ImageType.ListItem:
      return xConfig.imageInjection.enableListItemImages
    case ImageType.SwipeToDismiss:
      return xConfig.imageInjection.enableSwipeToDismissImages
    case ImageType.StandaloneMedia:
      return xConfig.imageInjection.enableStandaloneMediaImages
    default:
      return false
  }
}
