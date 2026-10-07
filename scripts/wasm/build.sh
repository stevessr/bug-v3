#!/bin/bash

# WebAssembly Build Script for hash and color modules (Rust)

set -euo pipefail

echo "🚀 Building split Rust WebAssembly modules (hash + color)..."

if ! command -v cargo &> /dev/null; then
  echo "❌ Rust toolchain not found. Please install Rust (rustup + cargo)."
  exit 1
fi

if ! rustup target list --installed | grep -q "^wasm32-unknown-unknown$"; then
  echo "📦 Installing wasm32 target..."
  rustup target add wasm32-unknown-unknown
fi

# Navigate to WASM directory
cd "$(dirname "$0")"
mkdir -p dist
rm -f dist/perceptual_hash.dev.wasm

WASM_SOURCE="target/wasm32-unknown-unknown/release/perceptual_hash_wasm.wasm"
echo "⚡ Compiling hash-only module..."
cargo build --release --target wasm32-unknown-unknown --no-default-features --features hash
[[ -f "$WASM_SOURCE" ]] || { echo "❌ Hash WASM output missing: $WASM_SOURCE"; exit 1; }
cp "$WASM_SOURCE" dist/perceptual_hash.wasm

echo "⚡ Compiling color-only module..."
cargo build --release --target wasm32-unknown-unknown --no-default-features --features color
[[ -f "$WASM_SOURCE" ]] || { echo "❌ Color WASM output missing: $WASM_SOURCE"; exit 1; }
cp "$WASM_SOURCE" dist/color_quantization.wasm

# Lightweight helper module (optional) to keep file parity for existing copy pipeline.
cat > dist/perceptual_hash.js <<'EOF'
export async function loadPerceptualHashWasm(wasmUrl) {
  const response = await fetch(wasmUrl)
  if (!response.ok) {
    throw new Error(`Failed to load WASM: ${response.status} ${response.statusText}`)
  }
  const bytes = await response.arrayBuffer()
  const { instance } = await WebAssembly.instantiate(bytes, {})
  return instance.exports
}
EOF

cp dist/perceptual_hash.js dist/perceptual_hash.dev.js

# Keep scripts/wasm as source of truth for scripts/build.js pre-copy stage.
cp dist/perceptual_hash.js ./perceptual_hash.js
cp dist/perceptual_hash.wasm ./perceptual_hash.wasm
cp dist/color_quantization.wasm ./color_quantization.wasm

# Also update public/wasm for immediate dev/runtime usage.
mkdir -p ../../public/wasm
cp dist/perceptual_hash.js ../../public/wasm/perceptual_hash.js
cp dist/perceptual_hash.wasm ../../public/wasm/perceptual_hash.wasm
cp dist/color_quantization.wasm ../../public/wasm/color_quantization.wasm

echo "✅ Rust WebAssembly build completed!"
echo ""
echo "📁 Generated files:"
echo "   - dist/perceptual_hash.js (loader helper)"
echo "   - dist/perceptual_hash.dev.js (loader helper)"
echo "   - dist/perceptual_hash.wasm (Rust WebAssembly binary)"
echo "   - dist/color_quantization.wasm (Rust WebAssembly binary)"
echo "   - scripts/wasm/perceptual_hash.{js,wasm} and color_quantization.wasm"
echo "   - public/wasm/perceptual_hash.wasm and color_quantization.wasm"
