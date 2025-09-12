// Import and expose initPixiv to window object instead of exporting
import { initPixiv } from './index'

    // Expose init function to window for content wrapper
    ; (window as any).__emoji_pixiv_init = initPixiv
