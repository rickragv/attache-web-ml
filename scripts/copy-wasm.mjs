/**
 * Copies runtime WASM assets from node_modules into public/ so the app can
 * serve them same-origin. Same-origin assets are required for the offline
 * drill and keep COEP simple. Runs on postinstall; safe to re-run.
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const targets = [
  {
    label: 'LiteRT.js runtime',
    from: join(root, 'node_modules', '@litertjs', 'core', 'wasm'),
    to: join(root, 'public', 'wasm', 'litert'),
  },
  {
    label: 'MediaPipe text tasks runtime',
    from: join(root, 'node_modules', '@mediapipe', 'tasks-text', 'wasm'),
    to: join(root, 'public', 'wasm', 'mediapipe-text'),
  },
  {
    label: 'MediaPipe GenAI runtime',
    from: join(root, 'node_modules', '@mediapipe', 'tasks-genai', 'wasm'),
    to: join(root, 'public', 'wasm', 'mediapipe-genai'),
  },
]

for (const { label, from, to } of targets) {
  if (!existsSync(from)) {
    console.warn(`[copy-wasm] skipped ${label}: ${from} not found`)
    continue
  }
  mkdirSync(to, { recursive: true })
  cpSync(from, to, { recursive: true })
  console.log(`[copy-wasm] ${label} -> ${to}`)
}
