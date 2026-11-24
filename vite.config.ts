/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { defineConfig, type Plugin } from 'vite'

/**
 * Serves MediaPipe's WebAssembly runtime from our own origin at `/mediapipe/`, so the hand tracker
 * doesn't depend on a CDN and always matches the npm package's version. In dev a middleware
 * streams the files from node_modules; in a build they're emitted as assets.
 */
function mediapipeWasm(): Plugin {
  const require = createRequire(import.meta.url)
  const read = (name: string): Buffer => readFileSync(require.resolve(`@mediapipe/tasks-vision/${name}`))
  const files = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']
  return {
    name: 'mediapipe-wasm',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url?.split('?')[0]?.replace(/^\/mediapipe\//, '')
        if (!req.url?.startsWith('/mediapipe/') || name === undefined || !files.includes(name)) {
          next()
          return
        }
        res.setHeader('Content-Type', name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript')
        res.end(read(name))
      })
    },
    generateBundle() {
      for (const name of files) {
        this.emitFile({ type: 'asset', fileName: `mediapipe/${name}`, source: read(name) })
      }
    },
  }
}

export default defineConfig({
  plugins: [mediapipeWasm()],
  build: { target: 'es2023', sourcemap: true },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
