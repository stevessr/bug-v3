export async function loadPerceptualHashWasm(wasmUrl) {
  const response = await fetch(wasmUrl)
  if (!response.ok) {
    throw new Error(`Failed to load WASM: ${response.status} ${response.statusText}`)
  }
  const bytes = await response.arrayBuffer()
  const { instance } = await WebAssembly.instantiate(bytes, {})
  return instance.exports
}
