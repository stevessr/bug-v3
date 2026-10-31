// ==UserScript==
// @name         linux-do-voice-msg
// @namespace    https://github.com/chenyu5/linux-do-voice-msg
// @version      1.1.0
// @author       helloai
// @description  为 linux.do 编辑器提供语音录制、播放及支持 WebM/MP4 视频附件的自定义播放器。
// @license      MIT
// @match        https://linux.do/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      self
// @sandbox      raw
// @connect      linuxdo-uploads.s3.ldstatic.com
// @downloadURL https://update.greasyfork.org/scripts/568599/linux-do-voice-msg.user.js
// @updateURL https://update.greasyfork.org/scripts/568599/linux-do-voice-msg.meta.js
// ==/UserScript==

;(function voiceLinuxDoUserscript() {
  'use strict'
  const pageWindow = typeof unsafeWindow === 'undefined' ? window : unsafeWindow

  const INSTALL_GUIDE_URL = 'https://greasyfork.org/zh-CN/scripts/568599-linux-do-voice-msg'
  const MAX_RECORDING_MS = 5 * 60 * 1000
  const MAX_AUDIO_UPLOAD_BYTES = 4 * 1024 * 1024
  const AUDIO_BITRATE = 64_000
  const RECORDING_TIMESLICE_MS = 500
  const EDITOR_TOOLBAR_SELECTOR = '.d-editor-button-bar'
  const INLINE_RECORDER_ATTRIBUTE = 'data-voice-inline'
  const TOOLBAR_ATTRIBUTE = 'data-voice-injected'
  const PROCESSED_ATTACHMENT_ATTRIBUTE = 'data-voice-processed'
  const VIDEO_PROCESSED_ATTRIBUTE = 'data-voice-video-processed'
  const PLAYER_ACTIVATE_EVENT = 'ldvmsg:player-activate'
  const VIDEO_PLAYER_ACTIVATE_EVENT = 'ldvmsg:video-player-activate'
  const VIDEO_CDN_HOST = 'linuxdo-uploads.s3.ldstatic.com'
  const WAVEFORM_BAR_COUNT = 34
  const WAVEFORM_SAMPLE_INTERVAL_MS = 120
  const MAX_TRANSCRIPT_CACHE_ENTRIES = 200
  const TRANSCRIPT_CACHE = new Map()
  const AUDIO_FORMATS = [
    { mimeType: 'audio/webm;codecs=opus', extension: 'opus' },
    { mimeType: 'audio/mpeg', extension: 'mp3' }
  ]
  const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
  const USER_STYLE = String.raw`.ldv-wave-canvas {
  display: block;
  width: 100%;
  background: transparent;
}
.ldv-composer-recorder-shell {
  display: grid;
  gap: 8px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  font-family: var(--ldv-font-family);
}
.ldv-recorder-placeholder,
.ldv-composer-recorder {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto auto auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: 560px;
  min-height: 62px;
  padding: 8px 12px;
  border: 1px solid var(--ldv-outline);
  border-radius: 22px;
  box-sizing: border-box;
  background: var(--ldv-surface);
  box-shadow: var(--ldv-shadow-soft);
  color: var(--ldv-text);
}
.ldv-recorder-placeholder {
  grid-template-columns: minmax(0, 1fr) auto auto;
  color: var(--ldv-muted);
}
.ldv-recorder-wave-slot {
  min-width: 0;
}
.ldv-recorder-wave-slot.is-placeholder {
  opacity: 0.82;
}
.ldv-placeholder-text {
  white-space: nowrap;
  font-size: 0.84rem;
  color: var(--ldv-muted);
}
.ldv-placeholder-icon {
  width: 24px;
  height: 24px;
  display: inline-flex;
  color: var(--ldv-accent);
}
.ldv-placeholder-icon svg {
  width: 100%;
  height: 100%;
}
.ldv-recorder-primary {
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 999px;
  background: var(--ldv-accent);
  color: var(--secondary);
  box-shadow: 0 8px 16px color-mix(in srgb, var(--ldv-accent) 20%, transparent);
  cursor: pointer;
  transition:
    transform 0.16s ease,
    opacity 0.16s ease,
    box-shadow 0.16s ease;
}
.ldv-recorder-primary:hover:not(:disabled),
.ldv-recorder-send:hover:not(:disabled),
.ldv-recorder-icon-button:hover:not(:disabled) {
  transform: translateY(-1px);
}
.ldv-recorder-primary:disabled,
.ldv-recorder-send:disabled,
.ldv-recorder-icon-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ldv-recorder-primary svg {
  width: 18px;
  height: 18px;
}
.ldv-recorder-duration {
  min-width: 64px;
  text-align: center;
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--ldv-accent);
  white-space: nowrap;
}
.ldv-recorder-duration.ldv-near-limit {
  color: var(--ldv-danger);
}
.ldv-recorder-icon-button,
.ldv-recorder-send {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ldv-outline);
  border-radius: 999px;
  background: var(--ldv-surface-muted);
  color: var(--ldv-muted);
  cursor: pointer;
  transition:
    transform 0.16s ease,
    color 0.16s ease,
    background-color 0.16s ease;
}
.ldv-recorder-icon-button:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--ldv-danger) 18%, transparent);
  background: color-mix(in srgb, var(--secondary) 84%, var(--danger) 16%);
}
.ldv-recorder-send {
  color: var(--ldv-accent);
}
.ldv-recorder-icon-button.ldv-recorder-delete {
  color: var(--ldv-danger);
  border-color: color-mix(in srgb, var(--ldv-danger) 16%, transparent);
}
.ldv-recorder-icon-button.ldv-recorder-delete:hover:not(:disabled) {
  color: var(--ldv-danger);
}
.ldv-send-spinner-svg {
  width: 20px;
  height: 20px;
}
.ldv-recorder-icon-image {
  display: block;
  width: 20px;
  height: 20px;
  object-fit: contain;
  flex: none;
}
.ldv-recorder-delete-image {
  width: 22px;
  height: 22px;
}
.ldv-recorder-send-image {
  width: 20px;
  height: 20px;
}
.ldv-recorder-send:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--ldv-accent) 22%, transparent);
  background: color-mix(in srgb, var(--secondary) 82%, var(--tertiary) 18%);
}
.ldv-recorder-divider {
  width: 1px;
  height: 24px;
  background: color-mix(in srgb, var(--primary) 12%, transparent);
}
.ldv-composer-recorder.is-paused .ldv-recorder-wave-slot {
  opacity: 0.86;
}
.ldv-composer-recorder.is-uploading {
  opacity: 0.92;
}
.ldv-send-spinner-svg {
  animation: ldv-recorder-spin 0.8s linear infinite;
}
.ldv-recorder-feedback {
  margin: 0 8px;
  font-size: 0.78rem;
  color: color-mix(in srgb, var(--primary) 64%, transparent);
}
@keyframes ldv-recorder-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 720px) {
  .ldv-recorder-placeholder,
  .ldv-composer-recorder {
    width: 100%;
    gap: 8px;
    padding: 8px 10px;
    min-height: 58px;
  }
  .ldv-recorder-duration {
    min-width: 56px;
    font-size: 0.8rem;
  }
}
@media (max-width: 560px) {
  .ldv-recorder-placeholder,
  .ldv-composer-recorder {
    grid-template-columns: auto minmax(0, 1fr) auto auto auto;
    gap: 8px;
  }
  .ldv-recorder-duration {
    grid-column: 3;
  }
  .ldv-recorder-divider {
    display: none;
  }
  .ldv-recorder-send {
    grid-column: 5;
  }
}
@media (max-width: 480px) {
  .ldv-recorder-placeholder {
    grid-template-columns: 1fr auto;
  }
  .ldv-placeholder-text {
    display: none;
  }
  .ldv-composer-recorder {
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    row-gap: 10px;
  }
  .ldv-recorder-duration {
    grid-column: 3 / 5;
    justify-self: end;
  }
  .ldv-recorder-icon-button {
    grid-column: 3;
  }
  .ldv-recorder-send {
    grid-column: 4;
  }
}
.ldv-toolbar-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--button-height);
  height: var(--button-height);
  border: none;
  border-radius: var(--d-border-radius);
  background: transparent;
  color: var(--ldv-muted);
  box-shadow: none;
  cursor: pointer;
  transition:
    transform 0.16s ease,
    background-color 0.16s ease,
    opacity 0.16s ease;
}
.ldv-toolbar-button:hover:not(:disabled) {
  transform: translateY(-1px);
  background: var(--d-hover);
}
.ldv-toolbar-button:disabled {
  cursor: not-allowed;
}
.ldv-toolbar-button.is-recording {
  animation: ldv-toolbar-pulse 1.2s ease-in-out infinite;
}
.ldv-toolbar-button.is-uploading {
  opacity: 0.78;
}
.ldv-toolbar-button.is-uploading:after {
  content: '';
  position: absolute;
  inset: 4px;
  border: 2px solid color-mix(in srgb, var(--ldv-accent) 18%, transparent);
  border-top-color: currentColor;
  border-radius: 999px;
  animation: ldv-toolbar-spin 0.9s linear infinite;
}
.ldv-toolbar-icon {
  width: 1.28em;
  height: 1.28em;
  display: inline-flex;
}
.ldv-toolbar-image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}
.ldv-toolbar-button.is-recording .ldv-toolbar-image {
  transform: scale(1.03);
}
.ldv-toolbar-button.is-uploading .ldv-toolbar-image {
  opacity: 0.4;
}
@keyframes ldv-toolbar-pulse {
  0%,
  to {
    box-shadow: 0 0 color-mix(in srgb, var(--ldv-accent) 0%, transparent);
  }
  55% {
    box-shadow: 0 0 0 5px color-mix(in srgb, var(--ldv-accent) 14%, transparent);
  }
}
@keyframes ldv-toolbar-spin {
  to {
    transform: rotate(360deg);
  }
}
.ldv-player-wrap {
  display: inline-grid;
  gap: 6px;
  width: min(100%, 420px);
  max-width: 100%;
  font-family: var(--ldv-font-family);
  color: var(--ldv-player-text);
  vertical-align: middle;
}
.ldv-player-card {
  display: grid;
  gap: 0;
  border: 1px solid var(--ldv-player-outline);
  border-radius: 22px;
  background: var(--ldv-player-bg);
  box-shadow: var(--ldv-player-shadow);
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}
.ldv-player-card.is-playing {
  background: var(--ldv-player-bg-active);
  box-shadow: 0 8px 18px color-mix(in srgb, var(--ldv-accent) 10%, transparent);
}
.ldv-player-card.is-paused {
  border-style: dashed;
}
.ldv-player-primary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  padding: 8px 12px;
}
.ldv-player-secondary {
  display: grid;
  gap: 8px;
  padding: 8px 12px 10px;
  border-top: 1px solid color-mix(in srgb, var(--ldv-player-outline) 76%, transparent);
}
.ldv-player-secondary.is-compact {
  gap: 0;
  padding-top: 5px;
  padding-bottom: 6px;
}
.ldv-player-secondary-body {
  display: grid;
  gap: 6px;
  min-height: 0;
}
.ldv-player-main,
.ldv-player-replay {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  cursor: pointer;
  transition:
    transform 0.16s ease,
    border-color 0.16s ease,
    background-color 0.16s ease,
    color 0.16s ease,
    opacity 0.16s ease;
}
.ldv-player-main:hover:not(:disabled),
.ldv-player-replay:hover:not(:disabled) {
  transform: translateY(-1px);
}
.ldv-player-main:disabled,
.ldv-player-replay:disabled {
  opacity: 0.58;
  cursor: not-allowed;
}
.ldv-player-main {
  border: none;
  background: var(--ldv-accent);
  color: var(--secondary);
}
.ldv-player-replay {
  border: 1px solid var(--ldv-player-outline);
  background: var(--ldv-surface-muted);
  color: var(--ldv-accent);
  border-radius: 12px;
}
.ldv-player-main svg,
.ldv-player-spinner-svg {
  width: 18px;
  height: 18px;
}
.ldv-player-replay-image {
  display: block;
  width: 20px;
  height: 20px;
  object-fit: contain;
  flex: none;
}
.ldv-player-spinner-svg {
  animation: ldv-player-spin 0.8s linear infinite;
}
.ldv-player-waveform {
  display: flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
  height: 28px;
  overflow: hidden;
}
.ldv-player-bar {
  flex: 1 1 0;
  min-width: 3px;
  border-radius: 999px;
  background: var(--ldv-wave-inactive);
  transition: background-color 0.12s ease;
}
.ldv-player-bar.is-played {
  background: var(--ldv-wave-color);
}
.ldv-player-time {
  min-width: 72px;
  text-align: right;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--ldv-accent);
  white-space: nowrap;
}
.ldv-player-error {
  margin: 0;
  font-size: 0.76rem;
  color: var(--ldv-danger);
}
.ldv-player-transcript-panel {
  display: grid;
  gap: 6px;
}
.ldv-player-transcript-actions {
  display: inline-flex;
  align-items: center;
  justify-self: end;
  gap: 10px;
  min-height: 20px;
}
.ldv-player-transcript-action {
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--ldv-accent);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  line-height: 1.4;
  transition:
    color 0.16s ease,
    opacity 0.16s ease,
    text-decoration-color 0.16s ease;
}
.ldv-player-transcript-action:hover:not(:disabled) {
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}
.ldv-player-transcript-toggle {
  width: 18px;
  height: 18px;
  flex: none;
}
.ldv-player-transcript-toggle:hover:not(:disabled) {
  text-decoration: none;
}
.ldv-player-transcript-toggle-icon {
  display: block;
  width: 18px;
  height: 18px;
  object-fit: contain;
}
.ldv-player-transcript-action:disabled {
  opacity: 0.58;
  cursor: not-allowed;
  text-decoration: none;
}
.ldv-player-transcript-note,
.ldv-player-transcript-content {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.55;
}
.ldv-player-transcript-note {
  color: var(--ldv-muted);
}
.ldv-player-transcript-note.is-error {
  color: var(--ldv-danger);
}
.ldv-player-transcript-content {
  color: var(--ldv-player-text);
  white-space: pre-wrap;
  word-break: break-word;
}
.ldv-player-transcript-content.is-collapsed {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.ldv-player-transcript-content.is-pending {
  color: color-mix(in srgb, var(--ldv-player-text) 78%, var(--ldv-muted) 22%);
}
@keyframes ldv-player-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 520px) {
  .ldv-player-wrap {
    width: min(100%, 360px);
  }
  .ldv-player-card {
    border-radius: 20px;
  }
  .ldv-player-primary {
    gap: 8px;
    padding: 8px 10px;
  }
  .ldv-player-secondary {
    padding: 8px 10px 10px;
  }
  .ldv-player-secondary.is-compact {
    padding-top: 4px;
    padding-bottom: 5px;
  }
  .ldv-player-time {
    min-width: 64px;
    font-size: 0.78rem;
  }
  .ldv-player-transcript-actions {
    gap: 8px;
  }
}
@media (max-width: 420px) {
  .ldv-player-card {
    gap: 0;
  }
  .ldv-player-primary {
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    gap: 6px;
    padding: 7px 8px;
  }
  .ldv-player-main,
  .ldv-player-replay {
    width: 32px;
    height: 32px;
  }
  .ldv-player-main svg,
  .ldv-player-spinner-svg {
    width: 16px;
    height: 16px;
  }
  .ldv-player-replay-image {
    width: 18px;
    height: 18px;
  }
  .ldv-player-waveform {
    gap: 2px;
    height: 26px;
  }
  .ldv-player-bar {
    min-width: 2px;
  }
  .ldv-player-time {
    min-width: 56px;
    font-size: 0.76rem;
  }
}
:root {
  --ldv-font-family:
    'IBM Plex Sans', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  --ldv-surface: color-mix(in srgb, var(--secondary) 96%, var(--header_background) 4%);
  --ldv-surface-muted: color-mix(in srgb, var(--secondary) 90%, var(--header_background) 10%);
  --ldv-outline: color-mix(in srgb, var(--primary) 12%, transparent);
  --ldv-shadow-soft: 0 8px 18px color-mix(in srgb, var(--primary) 8%, transparent);
  --ldv-text: var(--primary);
  --ldv-muted: color-mix(in srgb, var(--primary) 56%, transparent);
  --ldv-danger: var(--danger);
  --ldv-accent: var(--tertiary);
  --ldv-wave-color: var(--tertiary);
  --ldv-wave-inactive: color-mix(in srgb, var(--primary) 14%, var(--secondary) 86%);
  --ldv-player-bg: var(--ldv-surface);
  --ldv-player-bg-active: color-mix(in srgb, var(--secondary) 86%, var(--highlight) 14%);
  --ldv-player-outline: var(--ldv-outline);
  --ldv-player-text: var(--primary);
  --ldv-player-shadow: var(--ldv-shadow-soft);
}
.ldv-toolbar-button-slot {
  display: inline-flex;
  align-items: center;
}
.ldv-inline-recorder-host {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  margin: 8px 0 6px;
}
.ldv-voice-player-host {
  display: inline-flex;
  width: auto;
  min-width: 0;
  max-width: 100%;
  vertical-align: middle;
}
.ldv-video-player-host {
  display: block;
  width: min(100%, 720px);
  max-width: 100%;
  margin: 8px 0;
  font-family: var(--ldv-font-family);
}
.ldv-video-player {
  overflow: hidden;
  border: 1px solid var(--ldv-player-outline);
  border-radius: 16px;
  background: #111;
  color: #fff;
  box-shadow: var(--ldv-player-shadow);
}
.ldv-video-player-screen {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
}
.ldv-video-player-video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}
.ldv-video-player-load {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  min-width: 96px;
  min-height: 42px;
  border: 0;
  border-radius: 999px;
  padding: 9px 16px;
  background: var(--ldv-accent);
  color: var(--secondary);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.ldv-video-player-load:disabled,
.ldv-video-player-control:disabled {
  opacity: 0.56;
  cursor: not-allowed;
}
.ldv-video-player-status {
  position: absolute;
  right: 10px;
  bottom: 10px;
  left: 10px;
  margin: 0;
  color: #fff;
  font-size: 0.8rem;
  text-align: center;
  text-shadow: 0 1px 4px #000;
  pointer-events: none;
}
.ldv-video-player-controls {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  background: var(--ldv-player-bg);
  color: var(--ldv-player-text);
}
.ldv-video-player-control {
  min-width: 38px;
  min-height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 0.82rem;
  cursor: pointer;
}
.ldv-video-player-control:hover:not(:disabled) {
  background: color-mix(in srgb, var(--ldv-accent) 14%, transparent);
}
.ldv-video-player-seek {
  width: 100%;
  accent-color: var(--ldv-accent);
}
.ldv-video-player-time {
  min-width: 78px;
  color: var(--ldv-player-text);
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}
.ldv-video-player-fallback {
  display: inline-block;
  margin: 5px 2px 0;
  color: var(--ldv-muted);
  font-size: 0.8rem;
}
.ldv-video-player-fallback a {
  color: var(--ldv-accent);
}
.ldv-video-player-error {
  color: var(--ldv-danger);
}
@media (max-width: 520px) {
  .ldv-video-player-controls {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 6px;
    padding: 8px;
  }
  .ldv-video-player-fullscreen {
    display: none;
  }
  .ldv-video-player-time {
    min-width: 64px;
    font-size: 0.72rem;
  }
}

[hidden] {
  display: none !important;
}
`

  const ICON_MARKUP = {
    microphone:
      '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3m-4 0h8"/>',
    pause:
      '<rect x="7" y="5" width="3.5" height="14" rx="1"/><rect x="13.5" y="5" width="3.5" height="14" rx="1"/>',
    play: '<path d="M8 5.7v12.6a.8.8 0 0 0 1.2.7l9-6.3a.8.8 0 0 0 0-1.3l-9-6.3a.8.8 0 0 0-1.2.6Z" fill="currentColor" stroke="none"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 4v5m4-5v5"/>',
    send: '<path d="M4 12 20 4l-5 16-3.5-6.5L4 12Zm7.5 1.5L20 4"/>',
    replay: '<path d="M4.5 11a7.5 7.5 0 1 1 .5 4m-.5-8v4h4M12 8v4l2.5 1.5"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    chevronUp: '<path d="m6 15 6-6 6 6"/>',
    spinner:
      '<circle cx="12" cy="12" r="8.5" opacity=".25"/><path d="M20.5 12A8.5 8.5 0 0 0 12 3.5"/>',
    microphoneOutline:
      '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3m-4 0h8"/>',
    warning: '<path d="M12 3 2.8 19h18.4L12 3Zm0 6v5m0 3h.01"/>'
  }

  const toolbarInstances = new Map()
  const playerInstances = new Map()
  const videoPlayerInstances = new Map()
  const toolbarStateListeners = new Set()
  let toolbarState = 'idle'
  let activeRecorderView = null
  let editorObserver = null
  let playerObserver = null
  let playerScanTimer = null

  function installStyles() {
    if (document.getElementById('ldv-voice-styles')) return
    const style = document.createElement('style')
    style.id = 'ldv-voice-styles'
    style.textContent = USER_STYLE
    ;(document.head || document.documentElement).appendChild(style)
  }

  function createIcon(name, scopeClass, extraClass = '') {
    const icon = document.createElementNS(SVG_NAMESPACE, 'svg')
    icon.setAttribute('viewBox', '0 0 24 24')
    icon.setAttribute('fill', 'none')
    icon.setAttribute('stroke', 'currentColor')
    icon.setAttribute('stroke-width', '1.8')
    icon.setAttribute('stroke-linecap', 'round')
    icon.setAttribute('stroke-linejoin', 'round')
    icon.setAttribute('aria-hidden', 'true')
    if (scopeClass) icon.classList.add(scopeClass)
    if (extraClass) icon.classList.add(extraClass)
    icon.innerHTML = ICON_MARKUP[name] || ICON_MARKUP.warning
    return icon
  }

  function setButtonIcon(button, name, scopeClass, extraClass = '') {
    const iconKey = `${name}|${scopeClass}|${extraClass}`
    if (button.dataset.iconKey === iconKey) return
    button.dataset.iconKey = iconKey
    button.replaceChildren(createIcon(name, scopeClass, extraClass))
  }

  function createButton(className, label, iconName, scopeClass, iconExtraClass = '') {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = className
    button.setAttribute('aria-label', label)
    button.title = label
    setButtonIcon(button, iconName, scopeClass, iconExtraClass)
    return button
  }

  function setRecorderToolbarState(state) {
    toolbarState = state
    for (const listener of [...toolbarStateListeners]) listener(state)
  }

  function subscribeToolbarState(listener) {
    toolbarStateListeners.add(listener)
    listener(toolbarState)
    return () => toolbarStateListeners.delete(listener)
  }

  function formatMediaTime(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
    const roundedSeconds = Math.max(0, Math.round(seconds))
    return `${Math.floor(roundedSeconds / 60)}:${String(roundedSeconds % 60).padStart(2, '0')}`
  }

  function formatRecordingTime(milliseconds) {
    const elapsed = Math.max(0, milliseconds)
    const minutes = Math.floor(elapsed / 60_000)
    const seconds = Math.floor((elapsed % 60_000) / 1000)
    const tenths = Math.floor((elapsed % 1000) / 100)
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value))
  }

  function randomHex(length = 8) {
    const bytes = new Uint8Array(length)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, byte => (byte % 16).toString(16)).join('')
  }

  function normalizeUrl(value, base = window.location.origin) {
    try {
      return new URL(value, base).href
    } catch {
      return ''
    }
  }

  function getSupportedAudioFormat() {
    if (typeof MediaRecorder === 'undefined') return null
    if (typeof MediaRecorder.isTypeSupported !== 'function') return AUDIO_FORMATS[0]
    return AUDIO_FORMATS.find(format => MediaRecorder.isTypeSupported(format.mimeType)) || null
  }

  function getComposerContext(toolbar) {
    const root = toolbar.closest('.d-editor') || document
    const wrapper = root.querySelector('.d-editor-textarea-wrapper')
    const textarea = root.querySelector('textarea.d-editor-input')
    const richEditor = root.querySelector('.ProseMirror')
    const mountAnchor =
      root.querySelector(
        '.ProseMirror-container, .d-editor-input.--rich-editor-enabled, .d-editor-input:not(textarea)'
      ) ||
      textarea ||
      richEditor
    if (!wrapper || !mountAnchor) return null
    return { root, wrapper, mountAnchor, textarea, richEditor }
  }

  function findDirectChild(parent, node) {
    let directChild = node
    while (directChild && directChild.parentElement !== parent) {
      directChild = directChild.parentElement
    }
    return directChild || parent.firstElementChild
  }

  function getAppEvents() {
    const events = pageWindow.Discourse?.lookup?.('service:app-events')
    return events && typeof events.trigger === 'function' ? events : null
  }

  function insertIntoActiveComposer(eventName, text) {
    const appEvents = getAppEvents()
    if (!appEvents) return false
    appEvents.trigger(eventName, text)
    return true
  }

  function insertIntoTextarea(textarea, text) {
    const start = textarea.selectionStart ?? textarea.value.length
    const end = textarea.selectionEnd ?? start
    textarea.value = `${textarea.value.slice(0, start)}${text}${textarea.value.slice(end)}`
    const cursor = start + text.length
    textarea.selectionStart = cursor
    textarea.selectionEnd = cursor
    textarea.focus()
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    textarea.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function insertIntoComposer(text, context) {
    if (context.richEditor) context.richEditor.focus()
    if (context.richEditor && insertIntoActiveComposer('composer:insert-block', text)) {
      insertIntoActiveComposer('composer:insert-text', '\n\n')
      return
    }
    if (context.textarea) {
      insertIntoTextarea(context.textarea, text)
      return
    }
    if (insertIntoActiveComposer('composer:insert-block', text)) return
    throw new Error('没有找到可用的编辑器，无法插入内容。')
  }

  function readCsrfTokenFromMeta() {
    const token = document.querySelector('meta[name="csrf-token"]')?.content?.trim()
    return token || null
  }

  let cachedCsrfToken = null

  async function getCsrfToken(forceRefresh = false) {
    if (!forceRefresh) {
      const metaToken = readCsrfTokenFromMeta()
      if (metaToken) {
        cachedCsrfToken = metaToken
        return metaToken
      }
      if (cachedCsrfToken) return cachedCsrfToken
    }

    const response = await fetch('/session/csrf', {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
    if (!response.ok) throw new Error('无法获取论坛上传令牌，请刷新页面后重试。')

    const payload = await response.json()
    if (!payload.csrf) throw new Error('论坛未返回有效的上传令牌。')
    cachedCsrfToken = payload.csrf
    return cachedCsrfToken
  }

  function uploadFileOnce(blob, fileName, csrfToken, onProgress) {
    const formData = new FormData()
    formData.append('type', 'composer')
    formData.append('upload_type', 'composer')
    formData.append('file', blob, fileName)

    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest()
      request.open('POST', '/uploads.json', true)
      request.responseType = 'json'
      request.setRequestHeader('X-CSRF-Token', csrfToken)
      request.setRequestHeader('X-Requested-With', 'XMLHttpRequest')
      request.upload.addEventListener('progress', event => {
        if (!onProgress) return
        const total = event.total || blob.size
        const loaded = event.loaded
        const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0
        onProgress({ loaded, total, percent })
      })
      request.addEventListener('error', () => reject(new Error('上传失败，请检查网络连接后重试。')))
      request.addEventListener('timeout', () => reject(new Error('上传超时，请稍后重试。')))
      request.addEventListener('load', () => {
        const payload = request.response
        if (request.status >= 200 && request.status < 300 && payload && 'short_url' in payload) {
          onProgress?.({ loaded: blob.size, total: blob.size, percent: 100 })
          resolve(payload)
          return
        }
        const firstError = Array.isArray(payload?.errors) ? payload.errors[0] : null
        reject(new Error(firstError || '上传失败，论坛没有返回可用的附件地址。'))
      })
      request.timeout = 60_000
      request.send(formData)
    })
  }

  async function uploadFile(blob, fileName, onProgress) {
    try {
      return await uploadFileOnce(blob, fileName, await getCsrfToken(), onProgress)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!/csrf|令牌|token/i.test(message)) throw error
      return uploadFileOnce(blob, fileName, await getCsrfToken(true), onProgress)
    }
  }

  function formatVoiceMessage(shortUrl) {
    return `\n[语音消息|attachment](${shortUrl})➔[安装插件播放](${INSTALL_GUIDE_URL})\n\n`
  }

  function formatVideoAttachment(fileName, upload) {
    if (typeof upload.short_url !== 'string' || !upload.short_url.startsWith('upload://')) {
      throw new Error('上传响应缺少可下载的 Discourse 附件地址。')
    }
    const mediaType = /\.webm$/i.test(fileName) ? 'WebM' : 'MP4'
    const safeFileName = `${fileName}.zip（原始 ${mediaType}，下载后移除 .zip 后缀）`
      .replace(/[\r\n]/g, ' ')
      .replace(/\\/g, '_')
      .replace(/\[/g, '_')
      .replace(/\]/g, '_')
      .replace(/\|/g, '_')
      .replace(/</g, '_')
      .replace(/>/g, '_')
    return `\n[${safeFileName}|attachment](${upload.short_url})\n\n`
  }

  class VoiceRecorder {
    constructor() {
      this.snapshot = {
        phase: 'idle',
        durationMs: 0,
        maxDurationMs: MAX_RECORDING_MS,
        format: null,
        errorMessage: null,
        maxDurationReached: false
      }
      this.listeners = new Set()
      this.mediaStream = null
      this.mediaRecorder = null
      this.audioContext = null
      this.analyser = null
      this.mediaStreamDestination = null
      this.microphoneSource = null
      this.silentSource = null
      this.silentGain = null
      this.chunks = []
      this.currentFormat = null
      this.ticker = null
      this.accumulatedMs = 0
      this.recordingStartedAt = 0
      this.stopReason = null
      this.stopPromise = null
      this.resolveStop = null
      this.rejectStop = null
      this.result = null
      this.cancelRequested = false
    }

    subscribe(listener) {
      this.listeners.add(listener)
      listener(this.snapshot)
      return () => this.listeners.delete(listener)
    }

    getResult() {
      return this.result
    }

    updateSnapshot(changes) {
      this.snapshot = { ...this.snapshot, ...changes }
      for (const listener of [...this.listeners]) listener(this.snapshot)
    }

    async start() {
      if (!['idle', 'cancelled'].includes(this.snapshot.phase)) {
        throw new Error('录音器当前不可重复启动。')
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('当前浏览器不支持麦克风录音。')
      }

      const format = getSupportedAudioFormat()
      if (!format) throw new Error('当前浏览器不支持 Opus 或 MP3 录音。')
      this.resetSession()
      this.currentFormat = format
      this.updateSnapshot({
        phase: 'starting',
        durationMs: 0,
        format,
        errorMessage: null,
        maxDurationReached: false
      })

      try {
        await this.createRecorderPipeline(format)
        if (this.cancelRequested) return
        await this.attachMicrophone()
        if (this.cancelRequested) return
        if (!this.mediaRecorder) throw new Error('录音器初始化失败。')
        this.recordingStartedAt = performance.now()
        this.mediaRecorder.start(RECORDING_TIMESLICE_MS)
        this.startTicker()
        this.updateSnapshot({ phase: 'recording', durationMs: 0 })
      } catch (error) {
        const message = this.toFriendlyError(error)
        this.fail(message)
        throw new Error(message)
      }
    }

    async pause() {
      if (!this.mediaRecorder || this.snapshot.phase !== 'recording') return
      this.accumulatedMs = this.getCurrentDurationMs()
      this.recordingStartedAt = 0
      this.mediaRecorder.pause()
      this.stopTicker()
      this.detachMicrophone()
      this.updateSnapshot({
        phase: 'paused',
        durationMs: this.accumulatedMs,
        errorMessage: null
      })
    }

    async resume() {
      if (!this.mediaRecorder || this.snapshot.phase !== 'paused') return
      const elapsed = Math.min(this.accumulatedMs, MAX_RECORDING_MS)
      this.updateSnapshot({
        phase: 'starting',
        durationMs: elapsed,
        errorMessage: null
      })
      try {
        await this.attachMicrophone()
        this.recordingStartedAt = performance.now()
        this.mediaRecorder.resume()
        this.startTicker()
        this.updateSnapshot({ phase: 'recording', durationMs: elapsed })
      } catch (error) {
        this.detachMicrophone()
        const message = this.toFriendlyError(error)
        this.updateSnapshot({
          phase: 'paused',
          durationMs: elapsed,
          errorMessage: message
        })
        throw error
      }
    }

    finalize(reason = 'send') {
      if (this.result) return Promise.resolve(this.result)
      if (this.stopPromise) return this.stopPromise
      if (!this.mediaRecorder) return Promise.reject(new Error('录音尚未开始。'))

      this.stopReason = reason
      this.accumulatedMs = this.getCurrentDurationMs()
      this.recordingStartedAt = 0
      this.updateSnapshot({
        phase: 'stopping',
        durationMs: Math.min(this.accumulatedMs, MAX_RECORDING_MS),
        maxDurationReached: reason === 'limit'
      })
      this.stopPromise = new Promise((resolve, reject) => {
        this.resolveStop = resolve
        this.rejectStop = reject
      })
      try {
        this.mediaRecorder.stop()
      } catch (error) {
        this.fail(this.toFriendlyError(error))
      }
      return this.stopPromise
    }

    async cancel() {
      if (['idle', 'cancelled'].includes(this.snapshot.phase)) return
      this.cancelRequested = true
      this.stopReason = 'cancel'
      this.stopTicker()
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        try {
          this.mediaRecorder.stop()
          return
        } catch {}
      }
      this.cleanupRecorderPipeline()
      this.updateSnapshot({ phase: 'cancelled' })
    }

    readWaveformFrame(buffer) {
      if (!this.analyser) return false
      this.analyser.getByteTimeDomainData(buffer)
      return true
    }

    async createRecorderPipeline(format) {
      const AudioContextConstructor = window.AudioContext
      if (!AudioContextConstructor) throw new Error('当前浏览器缺少音频处理能力。')
      const audioContext = new AudioContextConstructor()
      this.audioContext = audioContext

      try {
        if (audioContext.state === 'suspended') await audioContext.resume()
        if (this.cancelRequested) return

        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 2048
        analyser.smoothingTimeConstant = 0.85
        this.analyser = analyser

        const destination = audioContext.createMediaStreamDestination()
        this.mediaStreamDestination = destination
        const silentSource = audioContext.createConstantSource()
        const silentGain = audioContext.createGain()
        this.silentSource = silentSource
        this.silentGain = silentGain
        silentGain.gain.value = 0
        silentSource.connect(silentGain)
        silentGain.connect(destination)
        silentSource.start()

        const recorder = new MediaRecorder(destination.stream, {
          mimeType: format.mimeType,
          audioBitsPerSecond: AUDIO_BITRATE
        })
        recorder.addEventListener('dataavailable', event => {
          if (this.stopReason !== 'cancel' && event.data?.size) this.chunks.push(event.data)
        })
        recorder.addEventListener('stop', () => this.handleRecorderStop())
        recorder.addEventListener('error', event => {
          this.fail(event.error?.message || '录音器发生未知错误。')
        })
        this.mediaRecorder = recorder
      } catch (error) {
        this.cleanupRecorderPipeline()
        throw error
      }
    }

    async attachMicrophone() {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('当前浏览器不支持麦克风录音。')
      }
      if (!this.audioContext || !this.analyser || !this.mediaStreamDestination) {
        throw new Error('录音管线尚未初始化。')
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      })
      if (this.cancelRequested) {
        stream.getTracks().forEach(track => track.stop())
        return
      }
      try {
        const source = this.audioContext.createMediaStreamSource(stream)
        source.connect(this.analyser)
        source.connect(this.mediaStreamDestination)
        this.mediaStream = stream
        this.microphoneSource = source
      } catch (error) {
        stream.getTracks().forEach(track => track.stop())
        throw error
      }
    }

    detachMicrophone() {
      this.microphoneSource?.disconnect()
      this.mediaStream?.getTracks().forEach(track => track.stop())
      this.microphoneSource = null
      this.mediaStream = null
    }

    handleRecorderStop() {
      this.stopTicker()
      if (this.stopReason === 'cancel') {
        this.cleanupRecorderPipeline()
        this.rejectStop?.(new DOMException('录音已取消。', 'AbortError'))
        this.stopPromise = null
        this.resolveStop = null
        this.rejectStop = null
        this.updateSnapshot({ phase: 'cancelled' })
        return
      }
      if (!this.currentFormat) {
        this.fail('录音格式丢失，请重新开始录音。')
        return
      }

      const blob = new Blob(this.chunks, { type: this.currentFormat.mimeType })
      const durationMs = Math.min(Math.round(this.accumulatedMs), MAX_RECORDING_MS)
      const stoppedByLimit = this.stopReason === 'limit'
      this.result = {
        blob,
        durationMs,
        format: this.currentFormat,
        fileName: `ldvmsg-${Date.now()}-${randomHex()}.${this.currentFormat.extension}.zip`,
        fileSize: blob.size,
        stoppedByLimit
      }
      this.cleanupRecorderPipeline()
      this.updateSnapshot({
        phase: 'ready',
        durationMs,
        maxDurationReached: stoppedByLimit
      })
      this.resolveStop?.(this.result)
      this.clearStopPromise()
    }

    startTicker() {
      this.stopTicker()
      this.ticker = window.setInterval(() => {
        const durationMs = this.getCurrentDurationMs()
        this.updateSnapshot({ durationMs })
        if (durationMs >= MAX_RECORDING_MS && this.snapshot.phase === 'recording') {
          this.finalize('limit').catch(error => this.fail(this.toFriendlyError(error)))
        }
      }, 100)
    }

    stopTicker() {
      if (this.ticker !== null) {
        window.clearInterval(this.ticker)
        this.ticker = null
      }
    }

    getCurrentDurationMs() {
      if (this.snapshot.phase === 'recording' && this.recordingStartedAt > 0) {
        return Math.min(
          MAX_RECORDING_MS,
          this.accumulatedMs + performance.now() - this.recordingStartedAt
        )
      }
      return Math.min(MAX_RECORDING_MS, this.accumulatedMs)
    }

    cleanupRecorderPipeline() {
      this.detachMicrophone()
      this.silentSource?.disconnect()
      this.silentGain?.disconnect()
      try {
        this.silentSource?.stop()
      } catch {}
      this.audioContext?.close().catch(() => {})
      this.mediaRecorder = null
      this.audioContext = null
      this.analyser = null
      this.mediaStreamDestination = null
      this.silentSource = null
      this.silentGain = null
    }

    resetSession() {
      this.stopTicker()
      this.cleanupRecorderPipeline()
      this.chunks = []
      this.currentFormat = null
      this.accumulatedMs = 0
      this.recordingStartedAt = 0
      this.stopReason = null
      this.cancelRequested = false
      this.stopPromise = null
      this.resolveStop = null
      this.rejectStop = null
      this.result = null
    }

    clearStopPromise() {
      this.stopPromise = null
      this.resolveStop = null
      this.rejectStop = null
    }

    fail(message) {
      this.stopTicker()
      this.cleanupRecorderPipeline()
      this.updateSnapshot({ phase: 'error', errorMessage: message })
      this.rejectStop?.(new Error(message))
      this.clearStopPromise()
    }

    toFriendlyError(error) {
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
          return '需要麦克风权限才能录制语音消息。'
        }
        if (error.name === 'NotFoundError') return '没有检测到可用的麦克风设备。'
      }
      return error instanceof Error ? error.message : '录音初始化失败，请稍后重试。'
    }
  }

  function drawRoundedBar(context, x, y, width, height, radius) {
    const corner = Math.min(radius, width / 2, height / 2)
    context.beginPath()
    context.moveTo(x + corner, y)
    context.lineTo(x + width - corner, y)
    context.quadraticCurveTo(x + width, y, x + width, y + corner)
    context.lineTo(x + width, y + height - corner)
    context.quadraticCurveTo(x + width, y + height, x + width - corner, y + height)
    context.lineTo(x + corner, y + height)
    context.quadraticCurveTo(x, y + height, x, y + height - corner)
    context.lineTo(x, y + corner)
    context.quadraticCurveTo(x, y, x + corner, y)
    context.closePath()
    context.fill()
  }

  class LiveWaveform {
    constructor(canvas, { readFrame = null, active = false, paused = false, height = 52 } = {}) {
      this.canvas = canvas
      this.readFrame = readFrame
      this.active = active
      this.paused = paused
      this.displayHeight = height
      this.animationFrame = null
      this.lastFrameAt = 0
      this.sampleElapsed = 0
      this.level = 0.32
      this.levels = []
      this.frameBuffer = new Uint8Array(256)
      this.resize = this.resize.bind(this)
      this.draw = this.draw.bind(this)
      window.addEventListener('resize', this.resize)
      this.resize()
      this.animationFrame = window.requestAnimationFrame(this.draw)
    }

    update({ readFrame = this.readFrame, active = this.active, paused = this.paused } = {}) {
      this.readFrame = readFrame
      this.active = active
      this.paused = paused
    }

    resize() {
      if (!this.canvas.isConnected) return
      const bounds = this.canvas.getBoundingClientRect()
      const devicePixelRatio = window.devicePixelRatio || 1
      const width = Math.max(240, Math.floor((bounds.width || 300) * devicePixelRatio))
      const height = Math.max(44, Math.floor(this.displayHeight * devicePixelRatio))
      if (this.canvas.width !== width) this.canvas.width = width
      if (this.canvas.height !== height) this.canvas.height = height
      const count = Math.max(26, Math.floor((bounds.width || 300) / 10))
      if (this.levels.length !== count) {
        const oldLevels = this.levels.slice(-count)
        this.levels = Array.from({ length: count }, (_, index) => {
          const seed = 0.16 * Math.sin(0.55 * index) + 0.12 * Math.cos(0.23 * index)
          return oldLevels[index] ?? clamp(0.24 + Math.abs(seed), 0.14, 0.82)
        })
      }
    }

    sampleLevel() {
      if (!this.readFrame || !this.readFrame(this.frameBuffer)) return this.level || 0.32
      let totalAmplitude = 0
      let peakAmplitude = 0
      for (let start = 0; start < this.frameBuffer.length; start += 48) {
        const end = Math.min(this.frameBuffer.length, start + 48)
        let segmentAmplitude = 0
        for (let index = start; index < end; index += 1) {
          segmentAmplitude += Math.abs(this.frameBuffer[index] - 128) / 128
        }
        peakAmplitude = Math.max(peakAmplitude, segmentAmplitude / Math.max(1, end - start))
        totalAmplitude += segmentAmplitude
      }
      return clamp(
        0.55 * (totalAmplitude / this.frameBuffer.length) + 0.9 * peakAmplitude + 0.12,
        0.16,
        0.9
      )
    }

    draw(timestamp) {
      if (!this.canvas.isConnected) return
      this.resize()
      const context = this.canvas.getContext('2d')
      if (!context) return

      const elapsed = this.lastFrameAt ? timestamp - this.lastFrameAt : 0
      this.lastFrameAt = timestamp
      if (this.active && !this.paused) {
        this.sampleElapsed += elapsed
        while (this.sampleElapsed >= WAVEFORM_SAMPLE_INTERVAL_MS) {
          this.levels.push(this.level)
          if (this.levels.length > Math.max(26, Math.floor(this.canvas.clientWidth / 10))) {
            this.levels.shift()
          }
          this.level = this.sampleLevel()
          this.sampleElapsed -= WAVEFORM_SAMPLE_INTERVAL_MS
        }
      } else {
        this.sampleElapsed = 0
      }

      const width = this.canvas.width
      const height = this.canvas.height
      const count = Math.max(1, this.levels.length || Math.floor(width / 10))
      const step = width / count
      const barWidth = Math.max(3, Math.min(step * 0.48, 8 * (window.devicePixelRatio || 1)))
      const maximumBarHeight = height * 0.9
      const computedStyle = getComputedStyle(this.canvas)
      const activeColor =
        computedStyle.getPropertyValue('--ldv-wave-color').trim() ||
        computedStyle.getPropertyValue('--tertiary').trim() ||
        computedStyle.getPropertyValue('--primary').trim() ||
        '#64748b'
      const inactiveColor =
        computedStyle.getPropertyValue('--ldv-wave-inactive').trim() ||
        computedStyle.getPropertyValue('--quaternary').trim() ||
        computedStyle.getPropertyValue('--primary').trim() ||
        '#cbd5e1'
      const gradient = context.createLinearGradient(0, 0, width, 0)
      gradient.addColorStop(0, activeColor)
      gradient.addColorStop(0.72, activeColor)
      gradient.addColorStop(1, inactiveColor)
      context.clearRect(0, 0, width, height)
      context.fillStyle = gradient
      context.globalAlpha = this.active ? 1 : this.paused ? 0.72 : 0.88
      this.levels.forEach((level, index) => {
        const barHeight = Math.max(height * 0.22, maximumBarHeight * level)
        drawRoundedBar(
          context,
          index * step + (step - barWidth) / 2,
          (height - barHeight) / 2,
          barWidth,
          barHeight,
          barWidth / 2
        )
      })
      if (this.active || this.paused) {
        const barHeight = Math.max(height * 0.22, maximumBarHeight * this.level)
        const x = this.levels.length * step + (step - barWidth) / 2
        drawRoundedBar(context, x, (height - barHeight) / 2, barWidth, barHeight, barWidth / 2)
      }
      context.globalAlpha = 1
      this.animationFrame = window.requestAnimationFrame(this.draw)
    }

    destroy() {
      window.cancelAnimationFrame(this.animationFrame)
      window.removeEventListener('resize', this.resize)
      this.levels = []
    }
  }

  function createRecorderControls() {
    const shell = document.createElement('div')
    shell.className = 'ldv-composer-recorder-shell'

    const placeholder = document.createElement('div')
    placeholder.className = 'ldv-recorder-placeholder'
    placeholder.setAttribute('aria-live', 'polite')
    const placeholderWaveSlot = document.createElement('div')
    placeholderWaveSlot.className = 'ldv-recorder-wave-slot is-placeholder'
    const placeholderCanvas = document.createElement('canvas')
    placeholderCanvas.className = 'ldv-wave-canvas'
    placeholderWaveSlot.append(placeholderCanvas)
    const placeholderText = document.createElement('span')
    placeholderText.className = 'ldv-placeholder-text'
    placeholderText.textContent = '正在连接麦克风'
    const placeholderIcon = document.createElement('span')
    placeholderIcon.className = 'ldv-placeholder-icon'
    placeholderIcon.append(createIcon('microphone', ''))
    placeholder.append(placeholderWaveSlot, placeholderText, placeholderIcon)

    const recorder = document.createElement('div')
    recorder.className = 'ldv-composer-recorder'
    const pauseButton = createButton('ldv-recorder-primary', '暂停录音', 'pause', '')
    const waveSlot = document.createElement('div')
    waveSlot.className = 'ldv-recorder-wave-slot'
    const canvas = document.createElement('canvas')
    canvas.className = 'ldv-wave-canvas'
    waveSlot.append(canvas)
    const duration = document.createElement('span')
    duration.className = 'ldv-recorder-duration'
    duration.textContent = '00:00.0'
    const deleteButton = createButton(
      'ldv-recorder-icon-button ldv-recorder-delete',
      '删除录音',
      'trash',
      '',
      'ldv-recorder-delete-image'
    )
    const divider = document.createElement('span')
    divider.className = 'ldv-recorder-divider'
    divider.setAttribute('aria-hidden', 'true')
    const sendButton = createButton(
      'ldv-recorder-send',
      '发送语音消息',
      'send',
      '',
      'ldv-recorder-send-image'
    )
    recorder.append(pauseButton, waveSlot, duration, deleteButton, divider, sendButton)

    const feedback = document.createElement('p')
    feedback.className = 'ldv-recorder-feedback'
    feedback.hidden = true
    shell.append(placeholder, recorder, feedback)
    return {
      shell,
      placeholder,
      placeholderCanvas,
      recorder,
      pauseButton,
      canvas,
      duration,
      deleteButton,
      sendButton,
      feedback
    }
  }

  function createVideoUploadControl(toolbar, host, context) {
    const label = '上传 WebM/MP4 附件（文件名追加 .zip；下载后移除 .zip）'
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'ldv-toolbar-button toolbar__button'
    button.textContent = '🎬'
    button.title = label
    button.setAttribute('aria-label', label)

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.webm,.mp4,video/webm,video/mp4'
    input.hidden = true
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      input.value = ''
      if (file) void uploadAndInsertVideo(file, toolbar, context, button, label)
    })
    button.addEventListener('click', () => input.click())
    host.append(button, input)
  }

  async function uploadAndInsertVideo(file, toolbar, originalContext, button, label) {
    if (!/\.(webm|mp4)$/i.test(file.name)) {
      window.alert('仅支持选择 WebM 或 MP4 文件。')
      return
    }
    const context = getComposerContext(toolbar) || originalContext
    if (!context) {
      window.alert('没有找到当前编辑器，无法插入视频附件。')
      return
    }

    button.disabled = true
    button.classList.add('is-uploading')
    button.setAttribute('aria-busy', 'true')
    try {
      const upload = await uploadFile(file, `${file.name}.zip`, ({ percent }) => {
        const progressLabel = `${label}：${percent}%`
        button.title = progressLabel
        button.setAttribute('aria-label', progressLabel)
      })
      if (!context.wrapper.isConnected) {
        throw new Error('编辑器已关闭，视频已上传但未能插入附件链接。')
      }
      insertIntoComposer(formatVideoAttachment(file.name, upload), context)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      window.alert(`视频附件上传失败：${message}`)
    } finally {
      button.disabled = false
      button.classList.remove('is-uploading')
      button.removeAttribute('aria-busy')
      button.title = label
      button.setAttribute('aria-label', label)
    }
  }

  class InlineRecorderView {
    constructor(toolbar, context, host) {
      this.toolbar = toolbar
      this.context = context
      this.host = host
      this.recorder = new VoiceRecorder()
      this.readWaveformFrame = this.recorder.readWaveformFrame.bind(this.recorder)
      this.snapshot = this.recorder.snapshot
      this.uploading = false
      this.destroyed = false
      this.feedbackText = ''
      this.unsubscribe = null
      this.waveform = null
      this.controls = createRecorderControls()
      this.host.classList.add('ldv-inline-recorder-host')
      const insertionPoint = findDirectChild(context.wrapper, context.mountAnchor)
      context.wrapper.insertBefore(this.host, insertionPoint)
      context.wrapper.setAttribute(INLINE_RECORDER_ATTRIBUTE, 'true')
      this.host.append(this.controls.shell)

      this.placeholderWaveform = new LiveWaveform(this.controls.placeholderCanvas, {
        height: 46
      })
      this.waveform = new LiveWaveform(this.controls.canvas, { height: 52 })
      this.controls.pauseButton.addEventListener('click', () => void this.togglePause())
      this.controls.deleteButton.addEventListener('click', () => void this.close(true))
      this.controls.sendButton.addEventListener('click', () => void this.send())
      this.unsubscribe = this.recorder.subscribe(snapshot => this.render(snapshot))
      setRecorderToolbarState('recording')
      this.recorder.start().catch(error => {
        if (this.destroyed) return
        window.alert(error instanceof Error ? error.message : '录音初始化失败。')
        void this.close(true)
      })
    }

    render(snapshot = this.snapshot) {
      if (this.destroyed) return
      this.snapshot = snapshot
      const isStarting = snapshot.phase === 'starting'
      this.controls.placeholder.hidden = !isStarting
      this.controls.recorder.hidden = isStarting
      this.controls.recorder.classList.toggle('is-paused', snapshot.phase === 'paused')
      this.controls.recorder.classList.toggle('is-uploading', this.uploading)
      this.controls.duration.textContent = formatRecordingTime(snapshot.durationMs)
      this.controls.duration.classList.toggle(
        'ldv-near-limit',
        snapshot.durationMs >= MAX_RECORDING_MS - 15_000 && !this.uploading
      )

      const canRecord = !this.uploading && ['recording', 'paused'].includes(snapshot.phase)
      const hasResult = snapshot.phase === 'ready' || Boolean(this.recorder.getResult())
      const canSend = !this.uploading && ['recording', 'paused', 'ready'].includes(snapshot.phase)
      const pauseLabel =
        snapshot.phase === 'recording' ? '暂停录音' : hasResult ? '录音已完成' : '继续录音'
      this.controls.pauseButton.disabled = !canRecord
      this.controls.pauseButton.setAttribute('aria-label', pauseLabel)
      this.controls.pauseButton.title = pauseLabel
      setButtonIcon(
        this.controls.pauseButton,
        snapshot.phase === 'recording' ? 'pause' : 'play',
        ''
      )
      this.controls.deleteButton.disabled = this.uploading
      this.controls.sendButton.disabled = !canSend
      const sendLabel = this.uploading ? '正在上传语音消息' : '发送语音消息'
      this.controls.sendButton.setAttribute('aria-label', sendLabel)
      this.controls.sendButton.title = sendLabel
      setButtonIcon(
        this.controls.sendButton,
        this.uploading ? 'spinner' : 'send',
        '',
        this.uploading ? 'ldv-send-spinner-svg' : ''
      )
      this.controls.feedback.textContent = this.feedbackText || snapshot.errorMessage || ''
      this.controls.feedback.hidden = !this.controls.feedback.textContent
      this.waveform.update({
        readFrame: this.readWaveformFrame,
        active: snapshot.phase === 'recording',
        paused: snapshot.phase === 'paused'
      })
    }

    async togglePause() {
      try {
        if (this.snapshot.phase === 'recording') {
          await this.recorder.pause()
          this.feedbackText = '已暂停，麦克风已释放，可继续录音或直接发送。'
        } else if (this.snapshot.phase === 'paused') {
          await this.recorder.resume()
          this.feedbackText = ''
        }
        this.render()
      } catch (error) {
        this.feedbackText = error instanceof Error ? error.message : '录音状态切换失败。'
        this.render()
      }
    }

    async send() {
      if (this.uploading || this.destroyed) return
      this.feedbackText = ''
      try {
        const result = this.recorder.getResult() || (await this.recorder.finalize('send'))
        if (result.fileSize > MAX_AUDIO_UPLOAD_BYTES) {
          this.feedbackText = `录音文件过大（${formatFileSize(result.fileSize)}），请缩短录音时间后重试。`
          this.render()
          return
        }
        if (!this.context.wrapper.isConnected) throw new Error('编辑器已关闭，无法插入语音消息。')

        this.uploading = true
        setRecorderToolbarState('uploading')
        this.render()
        const upload = await uploadFile(result.blob, result.fileName, ({ percent }) => {
          this.feedbackText = `上传 ${percent}%`
          this.render()
        })
        if (this.destroyed) return
        if (!this.context.wrapper.isConnected) throw new Error('编辑器已关闭，无法插入语音消息。')
        insertIntoComposer(formatVoiceMessage(upload.short_url), this.context)
        await this.close(false)
      } catch (error) {
        if (this.destroyed) return
        this.uploading = false
        setRecorderToolbarState('recording')
        this.feedbackText = error instanceof Error ? error.message : '上传失败，请稍后重试。'
        this.render()
      }
    }

    checkConnected() {
      if (this.destroyed) return
      if (!this.host.isConnected || !this.context.wrapper.isConnected) {
        void this.close(!this.uploading)
      }
    }

    async close(cancelRecording = false) {
      if (this.destroyed) return
      this.destroyed = true
      this.unsubscribe?.()
      this.placeholderWaveform?.destroy()
      this.waveform?.destroy()
      if (cancelRecording && !this.uploading) await this.recorder.cancel()
      this.context.wrapper.removeAttribute(INLINE_RECORDER_ATTRIBUTE)
      this.host.remove()
      if (activeRecorderView === this) activeRecorderView = null
      setRecorderToolbarState('idle')
    }
  }

  function openInlineRecorder(toolbar) {
    if (activeRecorderView) {
      activeRecorderView.checkConnected()
      if (activeRecorderView && !activeRecorderView.destroyed) return
    }
    const context = getComposerContext(toolbar)
    if (!context) {
      window.alert('没有找到当前编辑器，无法插入语音消息。')
      return
    }
    const host = document.createElement('div')
    activeRecorderView = new InlineRecorderView(toolbar, context, host)
  }

  function updateToolbarButton(button, state) {
    const isRecording = state === 'recording'
    const isUploading = state === 'uploading'
    button.classList.toggle('is-recording', isRecording)
    button.classList.toggle('is-uploading', isUploading)
    button.disabled = state !== 'idle'
    button.setAttribute('aria-busy', String(isUploading))
    const label = isUploading ? '语音上传中' : '录制语音消息'
    button.setAttribute('aria-label', label)
    button.title = label
  }

  function injectToolbar(toolbar) {
    if (toolbar.getAttribute(TOOLBAR_ATTRIBUTE) === 'true') return
    const context = getComposerContext(toolbar)
    if (!context) return

    const slot = document.createElement('div')
    slot.className = 'ldv-toolbar-button-slot'
    const firstItem = toolbar.firstElementChild
    if (firstItem) toolbar.insertBefore(slot, firstItem.nextSibling)
    else toolbar.append(slot)

    const voiceButton = document.createElement('button')
    voiceButton.type = 'button'
    voiceButton.className = 'ldv-toolbar-button toolbar__button'
    voiceButton.setAttribute('aria-label', '录制语音消息')
    voiceButton.title = '录制语音消息'
    const iconWrapper = document.createElement('span')
    iconWrapper.className = 'ldv-toolbar-icon'
    iconWrapper.append(createIcon('microphone', 'ldv-toolbar-image'))
    voiceButton.append(iconWrapper)
    const unsubscribe = subscribeToolbarState(state => updateToolbarButton(voiceButton, state))
    voiceButton.addEventListener('click', () => {
      if (!voiceButton.disabled) openInlineRecorder(toolbar)
    })
    slot.append(voiceButton)
    createVideoUploadControl(toolbar, slot, context)
    toolbar.setAttribute(TOOLBAR_ATTRIBUTE, 'true')
    toolbarInstances.set(toolbar, { slot, unsubscribe })
  }

  function cleanupDisconnectedEditors() {
    for (const [toolbar, instance] of toolbarInstances) {
      if (toolbar.isConnected) continue
      instance.unsubscribe()
      instance.slot.remove()
      toolbarInstances.delete(toolbar)
    }
    activeRecorderView?.checkConnected()
  }

  function scanEditorToolbars() {
    cleanupDisconnectedEditors()
    document.querySelectorAll(EDITOR_TOOLBAR_SELECTOR).forEach(injectToolbar)
  }

  function detectAudioMimeType(bytes, contentType) {
    if (
      bytes.length >= 4 &&
      bytes[0] === 0x1a &&
      bytes[1] === 0x45 &&
      bytes[2] === 0xdf &&
      bytes[3] === 0xa3
    ) {
      return 'audio/webm;codecs=opus'
    }
    if (
      bytes.length >= 4 &&
      bytes[0] === 0x4f &&
      bytes[1] === 0x67 &&
      bytes[2] === 0x67 &&
      bytes[3] === 0x53
    ) {
      return 'audio/ogg;codecs=opus'
    }
    if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      return 'audio/mpeg'
    }
    for (let index = 0; index < Math.min(bytes.length - 1, 48); index += 1) {
      if (bytes[index] === 0xff && (bytes[index + 1] & 0xe0) === 0xe0) return 'audio/mpeg'
    }
    const normalizedType = contentType?.trim().toLowerCase()
    return normalizedType?.startsWith('audio/') || normalizedType?.startsWith('video/')
      ? contentType
      : 'audio/webm;codecs=opus'
  }

  async function decodeAudioDuration(arrayBuffer) {
    const AudioContextConstructor = window.AudioContext
    if (!AudioContextConstructor) return null
    const audioContext = new AudioContextConstructor()
    try {
      const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0))
      return Number.isFinite(decoded.duration) && decoded.duration > 0 ? decoded.duration : null
    } catch {
      return null
    } finally {
      audioContext.close().catch(() => {})
    }
  }

  async function fetchAudioAsset(url, signal) {
    const response = await fetch(url, { credentials: 'same-origin', signal })
    if (!response.ok) throw new Error('语音文件加载失败。')
    const arrayBuffer = await response.arrayBuffer()
    const mimeType = detectAudioMimeType(
      new Uint8Array(arrayBuffer),
      response.headers.get('content-type')
    )
    const duration = await decodeAudioDuration(arrayBuffer)
    return {
      objectUrl: URL.createObjectURL(new Blob([arrayBuffer], { type: mimeType })),
      duration
    }
  }

  function createWaveformLevels(seedText, count = WAVEFORM_BAR_COUNT) {
    let seed = 0
    for (const character of seedText) seed = (31 * seed + character.charCodeAt(0)) >>> 0
    return Array.from({ length: count }, (_, index) => {
      seed = (1_664_525 * seed + 1_013_904_223) >>> 0
      const randomLevel = (seed & 1023) / 1023
      const curve = 0.28 + 0.18 * Math.sin((index / Math.max(1, count - 1)) * Math.PI * 1.15)
      return clamp(curve + 0.42 * randomLevel, 0.18, 1)
    })
  }

  function getSpeechRecognitionSupport() {
    const recognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition
    const unsupportedMessage = '当前浏览器暂不支持附件语音转写，请使用最新版桌面版 Chrome 或 Edge。'
    if (!recognitionConstructor) return { supported: false, message: unsupportedMessage }
    if (!window.AudioContext) {
      return {
        supported: false,
        message: '当前浏览器缺少音频处理能力，无法转写这条语音。'
      }
    }
    const userAgent = navigator.userAgent
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)
    const isChromium = /Chrome|Chromium|Edg|OPR\//.test(userAgent)
    const isFirefox = /Firefox\//.test(userAgent)
    const isSafari = /Safari\//.test(userAgent) && !isChromium
    return !isMobile && isChromium && !isFirefox && !isSafari
      ? { supported: true, message: '', recognitionConstructor }
      : { supported: false, message: unsupportedMessage }
  }

  function normalizeTranscript(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function cacheTranscript(url, transcript) {
    if (!url || !transcript) return
    if (TRANSCRIPT_CACHE.has(url)) TRANSCRIPT_CACHE.delete(url)
    TRANSCRIPT_CACHE.set(url, transcript)
    if (TRANSCRIPT_CACHE.size > MAX_TRANSCRIPT_CACHE_ENTRIES) {
      const oldestKey = TRANSCRIPT_CACHE.keys().next().value
      if (oldestKey) TRANSCRIPT_CACHE.delete(oldestKey)
    }
  }

  function getSpeechErrorMessage(errorCode) {
    switch (errorCode) {
      case 'aborted':
        return '语音转写已取消。'
      case 'audio-capture':
        return '浏览器无法捕获这条语音的音轨。'
      case 'language-not-supported':
        return '当前浏览器不支持这条语音的识别语言。'
      case 'network':
        return '浏览器语音识别服务当前不可用，请稍后重试。'
      case 'no-speech':
        return '没有识别到有效语音内容，请重试。'
      case 'not-allowed':
      case 'service-not-allowed':
        return '浏览器拒绝了语音识别服务，请检查浏览器权限设置。'
      default:
        return '语音转写失败，请使用最新版桌面版 Chrome 或 Edge 重试。'
    }
  }

  function getSpeechStartErrorMessage(error) {
    if (error instanceof DOMException) {
      if (error.name === 'InvalidStateError' || error.name === 'NotSupportedError') {
        return '当前浏览器暂不支持直接转写附件语音，请使用最新版桌面版 Chrome 或 Edge。'
      }
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
        return '浏览器阻止了语音转写，请检查浏览器权限设置。'
      }
    }
    return error instanceof Error && error.message ? error.message : '语音转写失败，请稍后重试。'
  }

  class VoicePlayer {
    constructor(host, audioUrl, fileName) {
      this.host = host
      this.audioUrl = audioUrl
      this.fileName = fileName
      this.id = randomHex(12)
      this.status = 'idle'
      this.loadingSource = true
      this.errorMessage = ''
      this.duration = 0
      this.currentTime = 0
      this.objectUrl = null
      this.fetchController = new AbortController()
      this.destroyed = false
      this.audio = new Audio()
      this.audio.preload = 'none'
      this.transcriptSupport = getSpeechRecognitionSupport()
      this.transcriptStatus = 'idle'
      this.transcriptError = ''
      this.transcriptFinal = ''
      this.transcriptInterim = ''
      this.transcriptExpanded = false
      this.transcriptOverflows = false
      this.transcriptMeasureFrame = null
      this.measuringTranscript = false
      this.transcriptionSession = null
      this.waveformLevels = createWaveformLevels(`${audioUrl}|${fileName}`)
      this.buildInterface()
      this.bindAudioEvents()
      this.render()
      this.loadCachedTranscript()
      void this.prepareAudioSource()
    }

    buildInterface() {
      this.wrapper = document.createElement('div')
      this.wrapper.className = 'ldv-player-wrap'
      this.card = document.createElement('div')
      this.card.className = 'ldv-player-card'
      this.primary = document.createElement('div')
      this.primary.className = 'ldv-player-primary'
      this.playButton = createButton('ldv-player-main', '播放语音消息', 'play', '')
      this.waveform = document.createElement('div')
      this.waveform.className = 'ldv-player-waveform'
      this.waveform.setAttribute('aria-hidden', 'true')
      this.waveformBars = this.waveformLevels.map(level => {
        const bar = document.createElement('span')
        bar.className = 'ldv-player-bar'
        bar.style.height = `${Math.round(8 + 16 * level)}px`
        this.waveform.append(bar)
        return bar
      })
      this.timeLabel = document.createElement('span')
      this.timeLabel.className = 'ldv-player-time'
      this.replayButton = createButton(
        'ldv-player-replay',
        '重播语音消息',
        'replay',
        '',
        'ldv-player-replay-image'
      )
      this.primary.append(this.playButton, this.waveform, this.timeLabel, this.replayButton)
      this.card.append(this.primary)

      this.errorLabel = document.createElement('p')
      this.errorLabel.className = 'ldv-player-error'
      this.errorLabel.hidden = true

      this.secondary = document.createElement('div')
      this.secondary.className = 'ldv-player-secondary is-compact'
      this.transcriptPanel = document.createElement('div')
      this.transcriptPanel.className = 'ldv-player-transcript-panel'
      this.transcriptActions = document.createElement('div')
      this.transcriptActions.className = 'ldv-player-transcript-actions'
      this.transcribeButton = document.createElement('button')
      this.transcribeButton.type = 'button'
      this.transcribeButton.className = 'ldv-player-transcript-action'
      this.transcribeButton.textContent = '转文字'
      this.transcribeButton.title = '使用浏览器内建语音识别将这条语音转成文字'
      this.transcriptToggle = createButton(
        'ldv-player-transcript-action ldv-player-transcript-toggle',
        '展开转写内容',
        'chevron',
        '',
        'ldv-player-transcript-toggle-icon'
      )
      this.transcriptActions.append(this.transcribeButton, this.transcriptToggle)
      this.transcriptBody = document.createElement('div')
      this.transcriptBody.className = 'ldv-player-secondary-body'
      this.transcriptNote = document.createElement('p')
      this.transcriptNote.className = 'ldv-player-transcript-note'
      this.transcriptText = document.createElement('p')
      this.transcriptText.className = 'ldv-player-transcript-content'
      this.transcriptBody.append(this.transcriptNote, this.transcriptText)
      this.transcriptPanel.append(this.transcriptActions, this.transcriptBody)
      this.secondary.append(this.transcriptPanel)
      this.card.append(this.errorLabel, this.secondary)
      this.wrapper.append(this.card)
      this.host.append(this.wrapper)

      this.playButton.addEventListener('click', () => void this.togglePlayback())
      this.replayButton.addEventListener('click', () => void this.replay())
      this.transcribeButton.addEventListener('click', () => void this.startTranscription())
      this.transcriptToggle.addEventListener('click', () => {
        this.transcriptExpanded = !this.transcriptExpanded
        this.renderTranscript()
      })
      this.onOtherPlayerActivated = event => {
        if (event.detail?.id !== this.id && !this.audio.paused) this.audio.pause()
      }
      window.addEventListener(PLAYER_ACTIVATE_EVENT, this.onOtherPlayerActivated)
    }

    bindAudioEvents() {
      this.onMetadata = () => {
        if (Number.isFinite(this.audio.duration) && this.audio.duration > 0) {
          this.duration = this.audio.duration
        }
        this.render()
      }
      this.onCanPlay = () => {
        this.loadingSource = false
        this.render()
      }
      this.onTimeUpdate = () => {
        this.currentTime = this.audio.currentTime || 0
        this.renderProgress()
      }
      this.onPause = () => {
        if (this.audio.ended) {
          this.status = 'idle'
          this.currentTime = 0
        } else if (this.status !== 'error' && this.status !== 'loading') {
          this.status = 'paused'
        }
        this.render()
      }
      this.onEnded = () => {
        this.status = 'idle'
        this.currentTime = 0
        this.render()
      }
      this.onAudioError = () => {
        this.status = 'error'
        this.loadingSource = false
        this.errorMessage = '浏览器无法播放这条语音消息。'
        this.render()
      }
      this.audio.addEventListener('loadedmetadata', this.onMetadata)
      this.audio.addEventListener('durationchange', this.onMetadata)
      this.audio.addEventListener('canplay', this.onCanPlay)
      this.audio.addEventListener('timeupdate', this.onTimeUpdate)
      this.audio.addEventListener('pause', this.onPause)
      this.audio.addEventListener('ended', this.onEnded)
      this.audio.addEventListener('error', this.onAudioError)
    }

    loadCachedTranscript() {
      const cachedTranscript = TRANSCRIPT_CACHE.get(this.audioUrl)
      if (!cachedTranscript) return
      this.transcriptStatus = 'ready'
      this.transcriptFinal = cachedTranscript
      this.renderTranscript()
    }

    async prepareAudioSource() {
      try {
        const audioAsset = await fetchAudioAsset(this.audioUrl, this.fetchController.signal)
        if (this.destroyed) {
          URL.revokeObjectURL(audioAsset.objectUrl)
          return
        }
        this.objectUrl = audioAsset.objectUrl
        if (audioAsset.duration) this.duration = audioAsset.duration
      } catch {
        if (this.destroyed) return
      }
      this.loadingSource = false
      this.render()
    }

    setAudioSource() {
      const source = this.objectUrl || this.audioUrl
      if (this.audio.src === source) return
      this.audio.src = source
      this.audio.load()
    }

    async togglePlayback() {
      if (this.loadingSource || this.destroyed) return
      if (this.status === 'playing') {
        this.audio.pause()
        return
      }
      if (this.status === 'error') {
        this.audio.removeAttribute('src')
        this.audio.load()
        this.status = 'idle'
        this.errorMessage = ''
      }
      this.setAudioSource()
      if (
        this.audio.ended ||
        (Number.isFinite(this.audio.duration) && this.audio.currentTime >= this.audio.duration)
      ) {
        try {
          this.audio.currentTime = 0
        } catch {}
        this.currentTime = 0
      }
      window.dispatchEvent(new CustomEvent(PLAYER_ACTIVATE_EVENT, { detail: { id: this.id } }))
      try {
        await this.audio.play()
        this.status = 'playing'
        this.errorMessage = ''
        this.render()
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        this.status = 'error'
        this.errorMessage = error instanceof Error ? error.message : '音频播放失败。'
        this.render()
      }
    }

    async replay() {
      if (this.loadingSource || this.destroyed) return
      if (this.status === 'error') {
        this.audio.removeAttribute('src')
        this.audio.load()
      }
      this.setAudioSource()
      try {
        this.audio.currentTime = 0
      } catch {}
      this.currentTime = 0
      this.status = 'idle'
      this.errorMessage = ''
      window.dispatchEvent(new CustomEvent(PLAYER_ACTIVATE_EVENT, { detail: { id: this.id } }))
      try {
        await this.audio.play()
        this.status = 'playing'
      } catch (error) {
        this.status = 'error'
        this.errorMessage = error instanceof Error ? error.message : '音频播放失败。'
      }
      this.render()
    }

    render() {
      if (this.destroyed) return
      this.card.classList.toggle('is-playing', this.status === 'playing')
      this.card.classList.toggle('is-paused', this.status === 'paused')
      this.wrapper.dataset.fileName = this.fileName
      const isBusy = this.loadingSource
      this.playButton.disabled = isBusy
      const playLabel = this.status === 'playing' ? '暂停语音消息' : '播放语音消息'
      this.playButton.setAttribute('aria-label', isBusy ? '正在加载语音消息' : playLabel)
      this.playButton.title = isBusy ? '正在加载语音消息' : playLabel
      setButtonIcon(
        this.playButton,
        isBusy ? 'spinner' : this.status === 'playing' ? 'pause' : 'play',
        '',
        isBusy ? 'ldv-player-spinner-svg' : ''
      )
      this.replayButton.disabled = isBusy
      this.timeLabel.textContent = `${formatMediaTime(this.currentTime)} / ${formatMediaTime(this.duration)}`
      this.errorLabel.textContent = this.errorMessage
      this.errorLabel.hidden = !this.errorMessage
      this.renderProgress()
      this.renderTranscript()
    }

    renderProgress() {
      if (!this.waveformBars) return
      const progress = this.duration > 0 ? clamp(this.currentTime / this.duration, 0, 1) : 0
      const playedBars = Math.round(progress * this.waveformBars.length)
      this.waveformBars.forEach((bar, index) =>
        bar.classList.toggle('is-played', index < playedBars)
      )
      this.timeLabel.textContent = `${formatMediaTime(this.currentTime)} / ${formatMediaTime(this.duration)}`
    }

    renderTranscript() {
      if (!this.transcriptPanel || this.destroyed) return
      this.transcriptPanel.hidden = !this.transcriptSupport.supported
      this.transcribeButton.disabled =
        !this.transcriptSupport.supported || this.transcriptStatus === 'loading'
      this.transcribeButton.title = this.transcriptSupport.supported
        ? '使用浏览器内建语音识别将这条语音转成文字'
        : this.transcriptSupport.message
      this.transcribeButton.textContent =
        this.transcriptStatus === 'loading'
          ? '转写中...'
          : this.transcriptStatus === 'idle'
            ? '转文字'
            : '重试转文字'
      this.transcriptToggle.hidden = !this.transcriptOverflows
      const toggleLabel = this.transcriptExpanded ? '折叠转写内容' : '展开转写内容'
      this.transcriptToggle.setAttribute('aria-label', toggleLabel)
      this.transcriptToggle.title = toggleLabel
      setButtonIcon(
        this.transcriptToggle,
        this.transcriptExpanded ? 'chevronUp' : 'chevron',
        '',
        'ldv-player-transcript-toggle-icon'
      )
      this.transcriptBody.hidden = this.transcriptStatus === 'idle'
      const displayedText = [this.transcriptFinal, this.transcriptInterim].filter(Boolean).join(' ')
      this.transcriptText.textContent = displayedText
      this.transcriptText.classList.toggle('is-pending', this.transcriptStatus === 'loading')
      this.transcriptText.classList.toggle(
        'is-collapsed',
        this.transcriptOverflows && !this.transcriptExpanded
      )
      this.transcriptNote.classList.toggle('is-error', this.transcriptStatus === 'error')
      this.transcriptNote.textContent =
        this.transcriptStatus === 'loading'
          ? '正在转写语音，请稍候...'
          : this.transcriptStatus === 'error'
            ? this.transcriptError
            : ''
      this.transcriptNote.hidden = !this.transcriptNote.textContent
      if (
        this.transcriptStatus === 'ready' &&
        !this.measuringTranscript &&
        this.transcriptMeasureFrame === null
      ) {
        this.transcriptMeasureFrame = requestAnimationFrame(() => {
          this.transcriptMeasureFrame = null
          this.measureTranscriptOverflow()
        })
      }
    }

    measureTranscriptOverflow() {
      if (!this.transcriptText?.isConnected || this.transcriptStatus !== 'ready') return
      const style = window.getComputedStyle(this.transcriptText)
      const lineHeight = Number.parseFloat(style.lineHeight)
      const overflow =
        Number.isFinite(lineHeight) && lineHeight > 0
          ? this.transcriptText.scrollHeight > lineHeight + 1
          : this.transcriptText.scrollWidth > this.transcriptText.clientWidth + 1
      const changed =
        this.transcriptOverflows !== overflow || (!overflow && this.transcriptExpanded)
      this.transcriptOverflows = overflow
      if (!overflow) this.transcriptExpanded = false
      if (changed) {
        this.measuringTranscript = true
        this.renderTranscript()
        this.measuringTranscript = false
      }
    }

    async startTranscription() {
      if (!this.transcriptSupport.supported || this.transcriptStatus === 'loading') return
      const cachedTranscript = TRANSCRIPT_CACHE.get(this.audioUrl)
      if (cachedTranscript) {
        this.transcriptStatus = 'ready'
        this.transcriptFinal = cachedTranscript
        this.transcriptInterim = ''
        this.transcriptError = ''
        this.renderTranscript()
        return
      }

      this.cancelTranscription()
      const Recognition = this.transcriptSupport.recognitionConstructor
      const audio = new Audio(this.audioUrl)
      audio.preload = 'auto'
      const recognition = new Recognition()
      const session = {
        audio,
        recognition,
        audioContext: null,
        source: null,
        destination: null,
        silentGain: null,
        track: null,
        cleaned: false
      }
      this.transcriptionSession = session
      this.transcriptStatus = 'loading'
      this.transcriptError = ''
      this.transcriptFinal = ''
      this.transcriptInterim = ''
      this.transcriptExpanded = false
      this.renderTranscript()

      const isCurrentSession = () => !this.destroyed && this.transcriptionSession === session
      const cleanup = abortRecognition => {
        if (session.cleaned) return
        session.cleaned = true
        recognition.onresult = null
        recognition.onerror = null
        recognition.onend = null
        audio.removeEventListener('ended', onAudioEnded)
        audio.removeEventListener('error', onAudioError)
        if (abortRecognition) {
          try {
            recognition.abort()
          } catch {}
        }
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
        session.track?.stop()
        session.source?.disconnect()
        session.silentGain?.disconnect()
        session.destination?.stream?.getTracks().forEach(track => track.stop())
        session.audioContext?.close().catch(() => {})
        if (this.transcriptionSession === session) this.transcriptionSession = null
      }
      const finish = (errorMessage = '') => {
        if (!isCurrentSession()) {
          cleanup(true)
          return
        }
        const transcript = normalizeTranscript(this.transcriptFinal || this.transcriptInterim)
        cleanup(false)
        if (errorMessage) {
          this.transcriptStatus = 'error'
          this.transcriptError = errorMessage
        } else if (transcript) {
          this.transcriptStatus = 'ready'
          this.transcriptFinal = transcript
          this.transcriptInterim = ''
          cacheTranscript(this.audioUrl, transcript)
        } else {
          this.transcriptStatus = 'error'
          this.transcriptError = '浏览器未返回识别结果，请稍后重试。'
        }
        this.renderTranscript()
      }
      const onAudioEnded = () => {
        try {
          recognition.stop()
        } catch {
          finish()
        }
      }
      const onAudioError = () => finish('语音文件加载失败，暂时无法转写。')

      recognition.lang = document.documentElement.lang.trim() || navigator.language || 'zh-CN'
      recognition.continuous = true
      recognition.interimResults = true
      recognition.maxAlternatives = 1
      recognition.onresult = event => {
        if (!isCurrentSession()) return
        const finalParts = []
        const interimParts = []
        for (let index = 0; index < event.results.length; index += 1) {
          const result = event.results[index]
          const transcript = normalizeTranscript(result[0]?.transcript)
          if (!transcript) continue
          ;(result.isFinal ? finalParts : interimParts).push(transcript)
        }
        this.transcriptFinal = normalizeTranscript(finalParts.join(' '))
        this.transcriptInterim = normalizeTranscript(interimParts.join(' '))
        this.renderTranscript()
      }
      recognition.onerror = event => finish(getSpeechErrorMessage(event.error))
      recognition.onend = () => finish()
      audio.addEventListener('ended', onAudioEnded)
      audio.addEventListener('error', onAudioError)

      try {
        const AudioContextConstructor = window.AudioContext
        const audioContext = new AudioContextConstructor()
        const source = audioContext.createMediaElementSource(audio)
        const destination = audioContext.createMediaStreamDestination()
        const silentGain = audioContext.createGain()
        silentGain.gain.value = 0
        source.connect(destination)
        source.connect(silentGain)
        silentGain.connect(audioContext.destination)
        const track = destination.stream.getAudioTracks()[0]
        if (!track) throw new Error('浏览器无法创建可识别的音频轨道。')

        Object.assign(session, {
          audioContext,
          source,
          destination,
          silentGain,
          track
        })
        recognition.start(track)
        if (audioContext.state === 'suspended') await audioContext.resume()
        await audio.play()
      } catch (error) {
        finish(getSpeechStartErrorMessage(error))
      }
    }

    cancelTranscription() {
      const session = this.transcriptionSession
      if (!session) return
      session.cleaned = true
      session.recognition.onresult = null
      session.recognition.onerror = null
      session.recognition.onend = null
      try {
        session.recognition.abort()
      } catch {}
      session.audio.pause()
      session.audio.removeAttribute('src')
      session.audio.load()
      session.track?.stop()
      session.source?.disconnect()
      session.silentGain?.disconnect()
      session.destination?.stream?.getTracks().forEach(track => track.stop())
      session.audioContext?.close().catch(() => {})
      this.transcriptionSession = null
    }

    destroy() {
      if (this.destroyed) return
      this.destroyed = true
      this.fetchController.abort()
      this.cancelTranscription()
      this.audio.pause()
      this.audio.removeAttribute('src')
      this.audio.load()
      this.audio.removeEventListener('loadedmetadata', this.onMetadata)
      this.audio.removeEventListener('durationchange', this.onMetadata)
      this.audio.removeEventListener('canplay', this.onCanPlay)
      this.audio.removeEventListener('timeupdate', this.onTimeUpdate)
      this.audio.removeEventListener('pause', this.onPause)
      this.audio.removeEventListener('ended', this.onEnded)
      this.audio.removeEventListener('error', this.onAudioError)
      window.removeEventListener(PLAYER_ACTIVATE_EVENT, this.onOtherPlayerActivated)
      if (this.transcriptMeasureFrame !== null) {
        cancelAnimationFrame(this.transcriptMeasureFrame)
      }
      if (this.objectUrl) URL.revokeObjectURL(this.objectUrl)
    }
  }

  function getVideoMimeType(declaredType, fileName, url) {
    const normalizedType = declaredType?.split(';')[0]?.trim().toLowerCase()
    if (normalizedType && normalizedType !== 'video/mp4' && normalizedType !== 'video/webm') {
      return ''
    }
    const hints = `${fileName} ${url}`.toLowerCase()
    const saysWebm = hints.includes('webm')
    const saysMp4 = hints.includes('mp4')
    if (saysWebm && saysMp4) return ''
    const hintedType = saysWebm ? 'video/webm' : saysMp4 ? 'video/mp4' : ''
    if (hintedType && normalizedType && hintedType !== normalizedType) return ''
    return hintedType || normalizedType || ''
  }

  function getAllowedVideoUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return ''
    try {
      const url = new URL(value, window.location.href)
      if (url.protocol !== 'https:' || url.username || url.password) return ''
      if (url.origin === window.location.origin) {
        return url.pathname.startsWith('/uploads/') ? url.href : ''
      }
      return url.hostname === VIDEO_CDN_HOST ? url.href : ''
    } catch {
      return ''
    }
  }

  class VideoAttachmentPlayer {
    constructor(host, mediaUrl, mimeType, fileName) {
      this.host = host
      this.mediaUrl = mediaUrl
      this.mimeType = mimeType
      this.fileName = fileName
      this.id = randomHex(12)
      this.status = 'idle'
      this.statusText = '点击“加载视频”开始播放。'
      this.request = null
      this.objectUrl = null
      this.destroyed = false
      this.buildInterface()
      this.bindEvents()
      this.render()
    }

    buildInterface() {
      this.wrapper = document.createElement('div')
      this.wrapper.className = 'ldv-video-player'
      this.screen = document.createElement('div')
      this.screen.className = 'ldv-video-player-screen'
      this.video = document.createElement('video')
      this.video.className = 'ldv-video-player-video'
      this.video.preload = 'none'
      this.video.controls = false
      this.video.playsInline = true
      this.video.setAttribute('aria-label', this.fileName)
      this.loadButton = document.createElement('button')
      this.loadButton.type = 'button'
      this.loadButton.className = 'ldv-video-player-load'
      this.loadButton.textContent = '加载视频'
      this.loadButton.setAttribute('aria-label', '加载视频')
      this.statusLabel = document.createElement('p')
      this.statusLabel.className = 'ldv-video-player-status'
      this.statusLabel.setAttribute('role', 'status')
      this.statusLabel.setAttribute('aria-live', 'polite')
      this.screen.append(this.video, this.loadButton, this.statusLabel)

      this.controls = document.createElement('div')
      this.controls.className = 'ldv-video-player-controls'
      this.playButton = document.createElement('button')
      this.playButton.type = 'button'
      this.playButton.className = 'ldv-video-player-control'
      this.playButton.textContent = '播放'
      this.playButton.setAttribute('aria-label', '播放视频')
      this.playButton.disabled = true
      this.seek = document.createElement('input')
      this.seek.type = 'range'
      this.seek.className = 'ldv-video-player-seek'
      this.seek.min = '0'
      this.seek.max = '0'
      this.seek.step = '0.1'
      this.seek.value = '0'
      this.seek.setAttribute('aria-label', '视频播放进度')
      this.seek.disabled = true
      this.timeLabel = document.createElement('span')
      this.timeLabel.className = 'ldv-video-player-time'
      this.timeLabel.textContent = '0:00 / 0:00'
      this.fullscreenButton = document.createElement('button')
      this.fullscreenButton.type = 'button'
      this.fullscreenButton.className = 'ldv-video-player-control ldv-video-player-fullscreen'
      this.fullscreenButton.textContent = '全屏'
      this.fullscreenButton.setAttribute('aria-label', '全屏播放')
      this.fullscreenButton.disabled = true
      this.controls.append(this.playButton, this.seek, this.timeLabel, this.fullscreenButton)
      this.wrapper.append(this.screen, this.controls)
      this.host.append(this.wrapper)

      this.onLoadClick = () => this.loadSource()
      this.onPlayClick = () => void this.togglePlayback()
      this.onSeekInput = () => {
        if (!Number.isFinite(this.video.duration)) return
        this.video.currentTime = Number(this.seek.value)
        this.updatePlaybackPosition()
      }
      this.onFullscreenClick = () => {
        const request = this.wrapper.requestFullscreen?.()
        if (request && typeof request.catch === 'function') request.catch(() => {})
      }
      this.loadButton.addEventListener('click', this.onLoadClick)
      this.playButton.addEventListener('click', this.onPlayClick)
      this.seek.addEventListener('input', this.onSeekInput)
      this.fullscreenButton.addEventListener('click', this.onFullscreenClick)
    }

    bindEvents() {
      this.onMetadata = () => this.updatePlaybackPosition()
      this.onTimeUpdate = () => this.updatePlaybackPosition()
      this.onPlay = () => {
        this.status = 'playing'
        this.statusText = '正在播放。'
        window.dispatchEvent(
          new CustomEvent(VIDEO_PLAYER_ACTIVATE_EVENT, { detail: { id: this.id } })
        )
        this.render()
      }
      this.onPause = () => {
        if (this.video.ended) {
          this.status = 'ready'
          this.statusText = '播放结束。'
        } else if (this.objectUrl) {
          this.status = 'ready'
          this.statusText = '已暂停。'
        }
        this.render()
      }
      this.onEnded = () => {
        this.status = 'ready'
        this.statusText = '播放结束。'
        this.render()
      }
      this.onError = () => {
        this.status = 'error'
        this.statusText = '浏览器无法解码此视频；可使用下方附件链接下载。'
        this.render()
      }
      this.onOtherPlayerActivated = event => {
        if (event.detail?.id !== this.id && !this.video.paused) this.video.pause()
      }
      this.video.addEventListener('loadedmetadata', this.onMetadata)
      this.video.addEventListener('durationchange', this.onMetadata)
      this.video.addEventListener('timeupdate', this.onTimeUpdate)
      this.video.addEventListener('play', this.onPlay)
      this.video.addEventListener('pause', this.onPause)
      this.video.addEventListener('ended', this.onEnded)
      this.video.addEventListener('error', this.onError)
      window.addEventListener(VIDEO_PLAYER_ACTIVATE_EVENT, this.onOtherPlayerActivated)
    }

    updatePlaybackPosition() {
      const duration = Number.isFinite(this.video.duration) ? this.video.duration : 0
      const currentTime = Number.isFinite(this.video.currentTime) ? this.video.currentTime : 0
      this.seek.max = String(duration)
      this.seek.value = String(Math.min(currentTime, duration))
      this.seek.disabled = !this.objectUrl || duration <= 0
      this.timeLabel.textContent = `${formatMediaTime(currentTime)} / ${formatMediaTime(duration)}`
    }

    render() {
      const hasSource = Boolean(this.objectUrl)
      const isLoading = this.status === 'loading'
      this.loadButton.hidden = hasSource
      this.loadButton.disabled = isLoading || this.destroyed
      this.loadButton.textContent = isLoading ? '正在加载…' : '加载视频'
      this.playButton.disabled = !hasSource || isLoading || this.destroyed
      this.playButton.textContent = this.video.paused ? '播放' : '暂停'
      this.playButton.setAttribute('aria-label', this.video.paused ? '播放视频' : '暂停视频')
      this.fullscreenButton.disabled = !hasSource || this.destroyed
      this.statusLabel.textContent = this.statusText
      this.statusLabel.classList.toggle('ldv-video-player-error', this.status === 'error')
      this.wrapper.classList.toggle('is-playing', !this.video.paused)
      this.updatePlaybackPosition()
    }

    setError(message) {
      if (this.destroyed) return
      this.request = null
      this.status = 'error'
      this.statusText = message
      this.render()
    }

    loadSource() {
      if (this.destroyed || this.status === 'loading' || this.objectUrl) return
      if (typeof GM_xmlhttpRequest !== 'function') {
        this.setError('需要支持 GM_xmlhttpRequest 的 userscript 管理器才能播放。')
        return
      }
      this.status = 'loading'
      this.statusText = '正在从附件服务器加载视频…'
      this.render()
      try {
        this.request = GM_xmlhttpRequest({
          method: 'GET',
          url: this.mediaUrl,
          responseType: 'blob',
          timeout: 120_000,
          onprogress: event => {
            if (this.destroyed || this.status !== 'loading') return
            if (event.total > 0) {
              const percent = Math.min(100, Math.round((event.loaded / event.total) * 100))
              this.statusText = `正在加载视频… ${percent}%`
            }
            this.render()
          },
          onload: response => {
            this.request = null
            if (this.destroyed) return
            if (response.status < 200 || response.status >= 300) {
              this.setError(`附件下载失败（HTTP ${response.status}）。`)
              return
            }
            const mediaBlob = response.response
            if (!mediaBlob || typeof mediaBlob.size !== 'number' || mediaBlob.size === 0) {
              this.setError('附件服务器没有返回有效的视频数据。')
              return
            }
            this.objectUrl = URL.createObjectURL(new Blob([mediaBlob], { type: this.mimeType }))
            this.video.src = this.objectUrl
            this.video.load()
            this.status = 'ready'
            this.statusText = '视频已加载，点击播放。'
            this.render()
          },
          onerror: () => this.setError('视频加载失败；可使用下方附件链接下载。'),
          ontimeout: () => this.setError('视频加载超时；可使用下方附件链接下载。'),
          onabort: () => {
            if (!this.destroyed) this.setError('视频加载已取消。')
          }
        })
      } catch {
        this.setError('无法读取视频附件；可使用下方附件链接下载。')
      }
    }

    async togglePlayback() {
      if (this.destroyed || !this.objectUrl) return
      if (!this.video.paused) {
        this.video.pause()
        return
      }
      try {
        await this.video.play()
      } catch {
        this.setError('浏览器无法播放此视频；可使用下方附件链接下载。')
      }
    }

    destroy() {
      this.destroyed = true
      if (this.request && typeof this.request.abort === 'function') this.request.abort()
      this.video.pause()
      this.video.removeEventListener('loadedmetadata', this.onMetadata)
      this.video.removeEventListener('durationchange', this.onMetadata)
      this.video.removeEventListener('timeupdate', this.onTimeUpdate)
      this.video.removeEventListener('play', this.onPlay)
      this.video.removeEventListener('pause', this.onPause)
      this.video.removeEventListener('ended', this.onEnded)
      this.video.removeEventListener('error', this.onError)
      this.loadButton.removeEventListener('click', this.onLoadClick)
      this.playButton.removeEventListener('click', this.onPlayClick)
      this.seek.removeEventListener('input', this.onSeekInput)
      this.fullscreenButton.removeEventListener('click', this.onFullscreenClick)
      window.removeEventListener(VIDEO_PLAYER_ACTIVATE_EVENT, this.onOtherPlayerActivated)
      this.video.removeAttribute('src')
      this.video.load()
      if (this.objectUrl) URL.revokeObjectURL(this.objectUrl)
    }
  }

  function findVideoAttachments() {
    const matches = []
    for (const container of document.querySelectorAll('.cooked .video-container')) {
      if (container.getAttribute(VIDEO_PROCESSED_ATTRIBUTE) === 'true') continue
      const video = container.querySelector('video')
      const source = video?.querySelector('source')
      const fallbackLink = container.querySelector('a[href]')
      const rawUrl =
        source?.getAttribute('src') ||
        video?.getAttribute('src') ||
        fallbackLink?.getAttribute('href') ||
        ''
      const fileName = fallbackLink?.textContent?.trim() || rawUrl
      const mimeType = getVideoMimeType(source?.getAttribute('type') || '', fileName, rawUrl)
      const mediaUrl = [
        source?.getAttribute('src'),
        video?.getAttribute('src'),
        fallbackLink?.getAttribute('href'),
        fallbackLink?.href
      ]
        .map(getAllowedVideoUrl)
        .find(Boolean)
      if (!mediaUrl || !mimeType) continue
      matches.push({ container, attachmentLink: null, fallbackLink, mediaUrl, mimeType, fileName })
      if (fallbackLink) fallbackLink.setAttribute(VIDEO_PROCESSED_ATTRIBUTE, 'true')
    }

    for (const attachmentLink of document.querySelectorAll('.cooked a.attachment')) {
      if (attachmentLink.getAttribute(VIDEO_PROCESSED_ATTRIBUTE) === 'true') continue
      if (attachmentLink.closest('.video-container')) continue
      const rawUrl = attachmentLink.getAttribute('href') || attachmentLink.href || ''
      const candidates = [
        rawUrl,
        attachmentLink.getAttribute('data-orig-href'),
        attachmentLink.getAttribute('data-orig-src')
      ]
      const mediaUrl = candidates.map(getAllowedVideoUrl).find(Boolean)
      const fileName = attachmentLink.textContent?.trim() || attachmentLink.title || rawUrl
      const mimeType = getVideoMimeType(
        '',
        `${fileName} ${attachmentLink.title || ''}`,
        mediaUrl || rawUrl
      )
      if (!mediaUrl || !mimeType) continue
      matches.push({
        container: null,
        attachmentLink,
        fallbackLink: attachmentLink,
        mediaUrl,
        mimeType,
        fileName
      })
    }
    return matches
  }

  function createVideoFallbackLink(url, fileName) {
    const link = document.createElement('a')
    link.href = url
    link.rel = 'noopener nofollow ugc'
    link.textContent = `${fileName || '视频附件'}（下载附件）`
    return link
  }

  function mountVideoPlayer(attachment) {
    const host = document.createElement('span')
    host.className = 'ldv-video-player-host'
    if (attachment.container) {
      attachment.container.setAttribute(VIDEO_PROCESSED_ATTRIBUTE, 'true')
      attachment.container.replaceChildren(host)
    } else {
      attachment.attachmentLink.setAttribute(VIDEO_PROCESSED_ATTRIBUTE, 'true')
      attachment.attachmentLink.replaceWith(host)
    }
    const player = new VideoAttachmentPlayer(
      host,
      attachment.mediaUrl,
      attachment.mimeType,
      attachment.fileName
    )
    const fallbackLink =
      attachment.fallbackLink || createVideoFallbackLink(attachment.mediaUrl, attachment.fileName)
    fallbackLink.href = attachment.mediaUrl
    fallbackLink.rel = 'noopener nofollow ugc'
    const fallbackHost = document.createElement('div')
    fallbackHost.className = 'ldv-video-player-fallback'
    fallbackHost.append(fallbackLink)
    host.append(fallbackHost)
    videoPlayerInstances.set(host, player)
  }

  function findVoiceAttachments() {
    const candidates = document.querySelectorAll('.cooked a.attachment')
    const matches = []
    for (const attachmentLink of candidates) {
      if (attachmentLink.textContent?.trim() !== '语音消息') continue
      if (attachmentLink.getAttribute(PROCESSED_ATTACHMENT_ATTRIBUTE) === 'true') continue
      const paragraph = attachmentLink.closest('p, li')
      if (!paragraph) continue
      const guideLink = Array.from(paragraph.querySelectorAll('a')).find(link => {
        const isGuide = normalizeUrl(link.href) === INSTALL_GUIDE_URL
        const followsAttachment = Boolean(
          attachmentLink.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING
        )
        return isGuide && followsAttachment
      })
      if (!guideLink) continue

      const rawAudioUrl = attachmentLink.getAttribute('href') || attachmentLink.href
      matches.push({
        attachmentLink,
        guideLink,
        audioUrl: normalizeUrl(rawAudioUrl),
        fileName:
          attachmentLink.getAttribute('title') ||
          attachmentLink.getAttribute('data-orig-href') ||
          attachmentLink.getAttribute('href') ||
          '语音消息'
      })
    }
    return matches
  }

  function mountVoicePlayer(attachment) {
    attachment.attachmentLink.setAttribute(PROCESSED_ATTACHMENT_ATTRIBUTE, 'true')
    attachment.guideLink.setAttribute(PROCESSED_ATTACHMENT_ATTRIBUTE, 'true')
    const host = document.createElement('span')
    host.className = 'ldv-voice-player-host'
    const range = document.createRange()
    range.setStartBefore(attachment.attachmentLink)
    range.setEndAfter(attachment.guideLink)
    range.deleteContents()
    range.insertNode(host)
    range.detach()
    const player = new VoicePlayer(host, attachment.audioUrl, attachment.fileName)
    playerInstances.set(host, player)
  }

  function scanVoicePlayers() {
    for (const [host, player] of playerInstances) {
      if (host.isConnected) continue
      player.destroy()
      playerInstances.delete(host)
    }
    for (const [host, player] of videoPlayerInstances) {
      if (host.isConnected) continue
      player.destroy()
      videoPlayerInstances.delete(host)
    }
    for (const attachment of findVideoAttachments()) mountVideoPlayer(attachment)
    for (const attachment of findVoiceAttachments()) mountVoicePlayer(attachment)
  }

  function schedulePlayerScan() {
    if (playerScanTimer !== null) window.clearTimeout(playerScanTimer)
    playerScanTimer = window.setTimeout(() => {
      playerScanTimer = null
      scanVoicePlayers()
    }, 300)
  }

  function startObservers() {
    scanEditorToolbars()
    scanVoicePlayers()

    if (!editorObserver) {
      editorObserver = new MutationObserver(scanEditorToolbars)
      editorObserver.observe(document.body, { childList: true, subtree: true })
    }
    if (!playerObserver) {
      playerObserver = new MutationObserver(schedulePlayerScan)
      playerObserver.observe(document.body, { childList: true, subtree: true })
    }
  }

  function initialize() {
    installStyles()
    startObservers()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true })
  } else {
    initialize()
  }
})()
