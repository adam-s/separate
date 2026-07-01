import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// The ONNX Runtime wasm is referenced via `new URL("ort-wasm-*.wasm", import.meta.url)`,
// which Vite would otherwise resolve and emit as a ~22 MB bundled asset. We load that wasm
// from a CDN at runtime (see recognizer.svelte.ts → env.backends.onnx.wasm.wasmPaths), so
// rewrite the reference to a bare string at build time to keep the binary out of dist/.
function stripOrtWasmAssets(): Plugin {
  return {
    name: 'strip-ort-wasm-assets',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('onnxruntime-web') || !code.includes('import.meta.url')) return null;
      const replaced = code.replace(
        /new URL\((["'])(ort-wasm[^"']*\.wasm)\1,\s*import\.meta\.url\)/g,
        '$1$2$1',
      );
      return replaced === code ? null : { code: replaced, map: null };
    },
  };
}

export default defineConfig({
  plugins: [stripOrtWasmAssets(), svelte()],
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
  },
  server: { port: 5174 },
});
