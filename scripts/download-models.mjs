/**
 * Downloads gated model weights into public/models/ using the HF_TOKEN from
 * .env. The app serves these same-origin, so no token ever reaches the
 * browser. Re-run safe: skips files that already exist with the right size.
 *
 *   node scripts/download-models.mjs
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const FILES = [
  {
    url: 'https://huggingface.co/litert-community/embeddinggemma-300m/resolve/main/sentencepiece.model',
    dest: 'public/models/embeddinggemma/sentencepiece.model',
  },
  {
    url: 'https://huggingface.co/litert-community/embeddinggemma-300m/resolve/main/embeddinggemma-300M_seq256_mixed-precision.tflite',
    dest: 'public/models/embeddinggemma/embeddinggemma-300M_seq256_mixed-precision.tflite',
  },
]

const token = readToken()
if (!token) {
  console.error('[download-models] No HF_TOKEN found in .env — create a read token at huggingface.co/settings/tokens')
  process.exit(1)
}

for (const { url, dest } of FILES) {
  const out = join(root, dest)
  mkdirSync(dirname(out), { recursive: true })

  const head = await fetch(url, { method: 'HEAD', redirect: 'follow', headers: auth() })
  const expected = Number(head.headers.get('content-length')) || null
  if (existsSync(out) && expected && statSync(out).size === expected) {
    console.log(`[download-models] up to date: ${dest}`)
    continue
  }

  console.log(`[download-models] fetching ${url}`)
  const res = await fetch(url, { redirect: 'follow', headers: auth() })
  if (res.status === 401 || res.status === 403) {
    console.error(
      `[download-models] Access denied (${res.status}). Accept the model licence on huggingface.co first, and check the token has read scope.`,
    )
    process.exit(1)
  }
  if (!res.ok) {
    console.error(`[download-models] HTTP ${res.status} for ${url}`)
    process.exit(1)
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(out))
  console.log(`[download-models] wrote ${dest} (${(statSync(out).size / 1e6).toFixed(1)} MB)`)
}

function auth() {
  return { Authorization: `Bearer ${token}` }
}

function readToken() {
  if (process.env.HF_TOKEN) return process.env.HF_TOKEN.trim()
  try {
    const env = readFileSync(join(root, '.env'), 'utf8')
    return env.match(/^HF_TOKEN=(.+)$/m)?.[1]?.trim() ?? null
  } catch {
    return null
  }
}
