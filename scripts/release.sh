#!/bin/bash

# Release script for Emoji Extension
# Usage: ./scripts/release.sh [version]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if version is provided
if [ -z "$1" ]; then
    print_error "Version number is required"
    echo "Usage: $0 <version>"
    echo "Example: $0 1.0.1"
    exit 1
fi

VERSION=$1

# Validate version format (basic semver check)
if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    print_error "Invalid version format. Use semantic versioning (e.g., 1.0.1)"
    exit 1
fi

print_status "Starting release process for version $VERSION"

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "public/manifest.json" ]; then
    print_error "This script must be run from the project root directory"
    exit 1
fi

# Check if git working directory is clean
if [ -n "$(git status --porcelain)" ]; then
    print_warning "Git working directory is not clean. Uncommitted changes:"
    git status --short
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Aborted by user"
        exit 1
    fi
fi

# Update version in package.json
print_status "Updating package.json version to $VERSION"
jq --arg version "$VERSION" '.version = $version' package.json > tmp.json && mv tmp.json package.json

# Update version in manifest.json
print_status "Updating manifest.json version to $VERSION"
jq --arg version "$VERSION" '.version = $version' public/manifest.json > tmp.json && mv tmp.json public/manifest.json

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm ci
fi

# Run tests if they exist
if npm run | grep -q "test"; then
    print_status "Running tests..."
    npm run test || {
        print_error "Tests failed. Aborting release."
        exit 1
    }
fi

# Build the extension
print_status "Building extension..."
npm run build

# Create release directory
RELEASE_DIR="releases/v$VERSION"
mkdir -p "$RELEASE_DIR"

# Copy build to release directory
print_status "Creating release package..."
cp -r dist/* "$RELEASE_DIR/"

# Create zip file
ZIP_FILE="releases/emoji-extension-v$VERSION.zip"
cd "$RELEASE_DIR"
zip -r "../../emoji-extension-v$VERSION.zip" .
cd ../..

print_success "Release package created: $ZIP_FILE"

# Commit version changes
if [ -n "$(git status --porcelain)" ]; then
    print_status "Committing version changes..."
    git add package.json public/manifest.json
    git commit -m "Bump version to $VERSION"
fi

# Create git tag
print_status "Creating git tag v$VERSION..."
git tag "v$VERSION"

print_success "Release v$VERSION is ready!"
echo
echo "Next steps:"
echo "1. Push the changes and tag:"
echo "   git push origin main"
echo "   git push origin v$VERSION"
echo
echo "2. Or upload manually to Edge Store:"
echo "   File location: $ZIP_FILE"
echo
echo "3. The GitHub workflow will automatically build and upload when you push the tag"