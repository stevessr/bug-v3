import {
  applyExtensionSurfaceClass,
  resolveExtensionSurface
} from './utils/appMode'
import './styles/main.css'

const { surface } = resolveExtensionSurface(window.location.search, window.location.hash)
applyExtensionSurfaceClass(surface)

// Keep the shared HTML entry tiny. Loading Vue, Pinia, Vue Router, Ant Design,
// stores, and the AI agent only happens after the requested browser surface is
// known, so opening the popup no longer parses options/sidebar code.
switch (surface) {
  case 'options':
    await import('./options/main')
    break
  case 'sidebar':
    await import('./sidebar/main')
    break
  case 'popup':
  default:
    await import('./popup/main')
    break
}
