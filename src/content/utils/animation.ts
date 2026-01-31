import { DHA, createE } from './createEl'

// Animation duration in milliseconds
export const ANIMATION_DURATION = 200

// Inject animation styles once
let animationStylesInjected = false
export function injectAnimationStyles() {
  if (animationStylesInjected) return
  animationStylesInjected = true

  const style = createE('style', {
    text: `
    /* Desktop picker animations */
    .emoji-picker-enter {
      opacity: 0 !important;
      transform: scale(0.95) translateY(-8px) !important;
    }
    .emoji-picker-enter-active {
      opacity: 1 !important;
      transform: scale(1) translateY(0) !important;
      transition: opacity ${ANIMATION_DURATION}ms ease-out, transform ${ANIMATION_DURATION}ms ease-out !important;
    }
    .emoji-picker-exit {
      opacity: 1 !important;
      transform: scale(1) translateY(0) !important;
    }
    .emoji-picker-exit-active {
      opacity: 0 !important;
      transform: scale(0.95) translateY(-8px) !important;
      transition: opacity ${ANIMATION_DURATION}ms ease-in, transform ${ANIMATION_DURATION}ms ease-in !important;
    }

    /* Mobile modal animations */
    .emoji-modal-enter {
      opacity: 0 !important;
      transform: translateY(100%) !important;
    }
    .emoji-modal-enter-active {
      opacity: 1 !important;
      transform: translateY(0) !important;
      transition: opacity ${ANIMATION_DURATION}ms ease-out, transform ${ANIMATION_DURATION}ms ease-out !important;
    }
    .emoji-modal-exit {
      opacity: 1 !important;
      transform: translateY(0) !important;
    }
    .emoji-modal-exit-active {
      opacity: 0 !important;
      transform: translateY(100%) !important;
      transition: opacity ${ANIMATION_DURATION}ms ease-in, transform ${ANIMATION_DURATION}ms ease-in !important;
    }

    /* Backdrop animations */
    .emoji-backdrop-enter {
      opacity: 0 !important;
    }
    .emoji-backdrop-enter-active {
      opacity: 1 !important;
      transition: opacity ${ANIMATION_DURATION}ms ease-out !important;
    }
    .emoji-backdrop-exit {
      opacity: 1 !important;
    }
    .emoji-backdrop-exit-active {
      opacity: 0 !important;
      transition: opacity ${ANIMATION_DURATION}ms ease-in !important;
    }
  `,
  })
  DHA(style)
}

/**
 * Animate element entry
 */
export function animateEnter(element: HTMLElement, type: 'picker' | 'modal' | 'backdrop') {
  injectAnimationStyles()
  const prefix =
    type === 'picker' ? 'emoji-picker' : type === 'modal' ? 'emoji-modal' : 'emoji-backdrop'
  element.classList.add(`${prefix}-enter`)

  // Force reflow to ensure the initial state is applied
  void element.offsetHeight

  element.classList.remove(`${prefix}-enter`)
  element.classList.add(`${prefix}-enter-active`)

  // Clean up after animation
  setTimeout(() => {
    element.classList.remove(`${prefix}-enter-active`)
  }, ANIMATION_DURATION)
}

/**
 * Animate element exit and remove it
 */
export function animateExit(
  element: HTMLElement,
  type: 'picker' | 'modal' | 'backdrop',
  onComplete?: () => void
): void {
  injectAnimationStyles()
  const prefix =
    type === 'picker' ? 'emoji-picker' : type === 'modal' ? 'emoji-modal' : 'emoji-backdrop'
  element.classList.add(`${prefix}-exit`)

  // Force reflow
  void element.offsetHeight

  element.classList.remove(`${prefix}-exit`)
  element.classList.add(`${prefix}-exit-active`)

  setTimeout(() => {
    element.remove()
    onComplete?.()
  }, ANIMATION_DURATION)
}
