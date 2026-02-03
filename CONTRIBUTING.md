# Contributing to Emoji Extension

Thank you for your interest in contributing to the Emoji Extension! This document provides guidelines and instructions for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

This project follows a standard code of conduct. Be respectful, inclusive, and considerate in all interactions.

## Getting Started

1. **Fork the Repository**: Click the "Fork" button on the GitHub repository
2. **Clone Your Fork**:
   ```bash
   git clone https://github.com/YOUR-USERNAME/bug-v3.git
   cd bug-v3
   ```
3. **Add Upstream Remote**:
   ```bash
   git remote add upstream https://github.com/stevessr/bug-v3.git
   ```

## Development Setup

### Prerequisites

- Node.js 18 or higher
- npm or pnpm package manager
- Git

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The extension will be built in the `dist/` directory. Load it as an unpacked extension in your browser to test.

## Making Changes

### 1. Create a Branch

Always create a new branch for your changes:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

Branch naming conventions:

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions or updates

### 2. Make Your Changes

- Keep changes focused and atomic
- Write clear, descriptive commit messages
- Follow the existing code style
- Add tests for new features
- Update documentation as needed

### 3. Commit Your Changes

```bash
git add .
git commit -m "feat: add new feature description"
```

Commit message format:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## Coding Standards

### TypeScript

- Use TypeScript strict mode
- Provide type annotations for function parameters and return types
- Avoid using `any` type unless absolutely necessary
- Use interfaces for object shapes

### Vue Components

- Use Composition API with `<script setup>` syntax
- Keep components focused and single-purpose
- Use proper prop types and validation
- Emit events with descriptive names

### Code Style

The project uses ESLint and Prettier for code quality and formatting:

```bash
# Check linting
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

**Important**: Run linting and formatting before committing!

### Code Organization

- Place shared utilities in `src/utils/`
- Keep components organized by feature
- Use Pinia stores for state management
- Separate business logic from UI components

## Testing

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in debug mode
npm run test:debug

# Run extension-specific tests
npm run test:extension
```

### Writing Tests

- Add tests for new features
- Update tests when modifying existing features
- Use Playwright for end-to-end testing
- Keep tests focused and maintainable

## Submitting Changes

### 1. Update Your Branch

Before submitting, make sure your branch is up to date:

```bash
git fetch upstream
git rebase upstream/main
```

### 2. Push Your Changes

```bash
git push origin feature/your-feature-name
```

### 3. Create a Pull Request

1. Go to the original repository on GitHub
2. Click "New Pull Request"
3. Select your fork and branch
4. Fill in the PR template with:
   - Description of changes
   - Related issue number (if applicable)
   - Testing performed
   - Screenshots (for UI changes)

### Pull Request Guidelines

- **Title**: Use a clear, descriptive title
- **Description**: Explain what and why, not just how
- **Size**: Keep PRs focused and reasonably sized
- **Tests**: Ensure all tests pass
- **Documentation**: Update relevant documentation
- **Screenshots**: Include for UI changes

### Review Process

1. Automated checks will run (linting, tests, build)
2. Maintainers will review your code
3. Address any requested changes
4. Once approved, your PR will be merged

## Reporting Issues

### Before Reporting

1. Search existing issues to avoid duplicates
2. Test with the latest version
3. Gather relevant information

### Issue Template

When reporting bugs, include:

- **Description**: Clear description of the issue
- **Steps to Reproduce**: Detailed steps
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Environment**: Browser, OS, extension version
- **Screenshots**: If applicable
- **Console Errors**: Any error messages

### Feature Requests

When requesting features:

- Describe the feature clearly
- Explain the use case
- Suggest possible implementation (optional)
- Note any alternatives you've considered

## Project Structure

Understanding the project structure helps with contributions:

```
src/
├── background/        # Service worker (background tasks)
├── content/          # Content scripts (injected into pages)
├── popup/            # Extension popup UI
├── options/          # Options/settings page
│   ├── components/   # Reusable components
│   ├── modals/       # Modal dialogs
│   └── pages/        # Page components
├── shared/           # Shared code
│   ├── storage/      # Storage system
│   └── stores/       # Pinia state stores
├── utils/            # Utility functions
└── assets/           # Static assets
```

## Build Configurations

The project supports multiple build configurations:

- `npm run dev` - Development with hot reload
- `npm run build` - Standard production build
- `npm run build:prod` - Production without logging
- `npm run build:minimal` - Minimal build

See [BUILD_FLAGS.md](./scripts/docs/BUILD_FLAGS.md) for details.

## Documentation

When contributing, update documentation if:

- Adding new features
- Changing APIs or interfaces
- Modifying build process
- Adding configuration options

Documentation locations:

- Main features: `README.md`
- API changes: Relevant source files
- Detailed guides: `docs/` directory

## Getting Help

- **Questions**: Open a GitHub Discussion
- **Issues**: Create a GitHub Issue
- **Chat**: (If available) Join community chat

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Recognition

Contributors will be recognized in:

- Release notes
- Contributors section
- Special thanks for significant contributions

---

Thank you for contributing to Emoji Extension! 🎉
