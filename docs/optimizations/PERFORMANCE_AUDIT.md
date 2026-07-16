# Extension Performance Audit

This repository has a repeatable performance scan for the built extension. It measures the
**static startup graph** of every extension surface instead of judging only individual chunk
sizes. Dynamic imports are intentionally excluded until the feature that owns them is used.

## Run the audit

```bash
# Terser production build, manifest generation, and budget enforcement
pnpm perf

# Re-check an existing dist/ build
pnpm perf:check

# Print a report without failing on a budget regression
pnpm perf:audit

# Unit tests for the graph scanner and surface-mode resolver
pnpm test:performance
```

The machine-readable report is written to `dist/performance-audit.json`. The CI workflow in
`.github/workflows/performance.yml` runs the same build and uploads that report for every pull
request and every push to `main` or `master`.

## What is checked

`scripts/performance/audit-extension.js` reads Vite's `dist/.vite/manifest.json` and recursively
follows only static imports. It checks:

- initial JavaScript for bootstrap, content, background, popup, sidebar, options, and Discourse;
- forbidden eager bundles such as AI, editor, FFmpeg, or Vue code in contexts that do not need it;
- total extension package size and largest emitted JavaScript chunk;
- byte-identical large assets;
- source invariants for lazy content initialization, framework-neutral storage/i18n, background
  persistence, timer cleanup, and site-provided Discourse icons.

Budgets live in `scripts/performance/budgets.json`. Change them only with a measured reason and
include the before/after report in the review.

## Current budgets

| Surface                              | Initial JS budget |
| ------------------------------------ | ----------------: |
| Bootstrap                            |            32 KiB |
| Content script on every matched page |            64 KiB |
| Background service worker            |           192 KiB |
| Popup                                |          1.19 MiB |
| Sidebar                              |          1.29 MiB |
| Options                              |          1.43 MiB |
| Discourse browser                    |          1.43 MiB |

The complete package budget is 47,000,000 bytes and the per-chunk JavaScript limit is 2,000,000
bytes.

## Optimizations implemented

### Surface-specific startup

`src/main.ts` is now a small synchronous surface resolver and dynamically loads exactly one of
popup, options, or sidebar. It supports both manifest `mode=` URLs and internal `type=` URLs.
Global styles load once instead of being duplicated by each root component. Vite's native
`modulepreload` support is used without installing the document-wide polyfill, and the small Vite
preload runtime is isolated from large vendor groups.

### All-pages content script

The manifest still matches broad page patterns, so the content entry keeps only platform
detection in its static graph. Discourse initialization, platform adapters, message dispatch,
timing tools, and auto-read helpers load only when required. Discourse initialization now owns a
single observer/listener/timer set, uses bounded retry, pauses periodic work in hidden tabs, and
fully cleans up its resources.

### Background service worker

Storage serialization no longer imports Vue. Background upload persistence writes directly to
the split storage layer with serialized updates rather than constructing a Pinia UI store. The
framework-neutral i18n functions are separated from the Vue composable, and concurrent locale
fetches are deduplicated.

### Discourse browser

Topic, user, chat, search, category, notification, and composer views are async components. The
Markdown/ProseMirror/highlight stack therefore loads only when a relevant view opens. General
network utilities no longer re-export the post parser, which previously made the editor vendor
bundle eager.

The old inline icon component contained two overlapping sprite sets: 788 symbol declarations in
about 496 KiB of TSX. The extension no longer packages a forum-specific replacement sprite.
Instead, the content bridge reads the symbols already loaded by the selected Discourse site, and
the browser surface reconstructs them through a strict SVG element/attribute allowlist. This keeps
theme and plugin icons correct for each site without assigning site markup through `innerHTML`.

## Measured result

The baseline and final measurements use the production Terser configuration.

| Metric                        |     Baseline |    Optimized | Change |
| ----------------------------- | -----------: | -----------: | -----: |
| All-pages content entry graph |    223.46 kB |      4.67 kB | -97.9% |
| Background initial graph      |     1.04 MiB |     88.0 KiB | -91.7% |
| Discourse initial graph       |     3.19 MiB |     1.07 MiB | -66.5% |
| Discourse root chunk          |    815.84 kB |    107.75 kB | -86.8% |
| Complete `dist/` package      | 45,355,994 B | 44,698,497 B |  -1.4% |

The package size changes less than the startup graphs because FFmpeg's optional WASM payload is
about 32.2 MB and remains packaged for on-demand conversion. It is not part of any startup graph.

## Reading regressions

If `pnpm perf` fails:

1. Open `dist/performance-audit.json` and locate the failed check.
2. Inspect `entries.<surface>.files` to find the new eager dependency.
3. Move feature-only code behind a dynamic import or separate framework-neutral utilities from UI
   code.
4. Re-run `pnpm perf` and the relevant interaction test. Do not raise a budget solely to make CI
   green.
