# Repository Guidelines

## Project Structure & Module Organization
- `src/`: Vue 3 + TypeScript extension code, split by surface (`background/`, `content/`, `popup/`, `options/`, `shared/`, `utils/`, `assets/`).
- `public/`: static assets copied into builds.
- `scripts/`: build/release helpers and Playwright tests (`scripts/tests/`).
- `dist/`: build output for loading the extension in a browser.
- `docs/`: long-form documentation and guides.

## Build, Test, and Development Commands
- `npm run dev`: development build via custom script, outputs to `dist/`.
- `npm run watch`: rebuild on changes for iterative work.
- `npm run build`: standard production build.
- `npm run build:prod` / `npm run build:minimal`: smaller bundles with reduced features/logging.
- `npm run serve`: preview built assets.
- `npm run test`: Playwright test suite (headless by default).
- `npm run test:extension`: extension-specific Playwright config.
- `npm run lint`, `npm run format`, `npm run type-check`: code quality checks.

## Coding Style & Naming Conventions
- TypeScript + Vue 3 Composition API with `<script setup>`.
- Use ESLint + Prettier; format before committing (`npm run lint:fix`, `npm run format`).
- Follow existing directory naming: lower-case folders, feature-focused components, shared utilities in `src/shared/` and `src/utils/`.

## Testing Guidelines
- Playwright is the primary framework; tests live in `scripts/tests/`.
- Name tests with `.spec.ts` and keep them focused per feature.
- Run `npm run test` for full coverage; use `npm run test:debug` when iterating.

## Commit & Pull Request Guidelines
- Git history is minimal and uses short messages like “update” or “update metadata”.
- CONTRIBUTING recommends prefix-style commits (`feat:`, `fix:`, `docs:`, `chore:`); follow that for new work.
- Branch names: `feature/`, `fix/`, `docs/`, `refactor/`, `test/`.
- PRs should include: clear description, linked issue (if any), testing performed, and screenshots for UI changes.

## Security & Configuration Notes
- Treat extension keys and build artifacts as sensitive; avoid modifying or re-committing keys in `*.pem` unless explicitly required.
