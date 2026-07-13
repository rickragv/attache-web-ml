/**
 * Loads the bundled Meridian corpus (markdown + frontmatter, globbed at
 * build time) and any user-uploaded documents persisted in IndexedDB.
 */
import { parseFrontmatter } from './frontmatter.js'
import { persistence } from '../ml/persistence.js'

const files = {
  ...import.meta.glob('../data/corpus/*.md', { eager: true, query: '?raw', import: 'default' }),
  // optional large-scale corpus, populated by scripts/import-corpus.mjs
  ...import.meta.glob('../data/corpus-ext/*.md', { eager: true, query: '?raw', import: 'default' }),
}

export async function loadCorpus() {
  const docs = []
  for (const [path, raw] of Object.entries(files)) {
    const { meta, body } = parseFrontmatter(raw)
    const file = path.split('/').pop()
    docs.push({
      id: meta.id ?? file.replace(/\.md$/, ''),
      title: meta.title ?? file,
      category: meta.category ?? 'product',
      collection: meta.collection ?? 'corpus',
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      locale: meta.locale ?? 'en',
      updated: meta.updated ?? null,
      owner: meta.owner ?? null,
      audience: meta.audience ?? 'external',
      source: 'bundled',
      body,
    })
  }

  let userDocs = []
  try {
    userDocs = (await persistence.listUserDocs()) ?? []
  } catch {
    userDocs = []
  }

  docs.sort((a, b) => (b.updated ?? '').localeCompare(a.updated ?? ''))
  return [...docs, ...userDocs]
}

export function docFromUpload(fileName, text) {
  const { meta, body } = parseFrontmatter(text)
  const base = fileName.replace(/\.(md|txt|markdown)$/i, '')
  const firstHeading = body.match(/^#{1,3}\s+(.+)$/m)?.[1]
  return {
    id: `user-${base.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`,
    title: meta.title ?? firstHeading ?? base,
    category: meta.category ?? 'uploads',
    collection: 'your-documents',
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    locale: /[ऀ-ॿ]/.test(body) ? 'hi' : 'en',
    updated: new Date().toISOString().slice(0, 10),
    owner: 'you',
    audience: 'private',
    source: 'upload',
    body,
  }
}

export function corpusStats(docs, chunks) {
  const byCategory = {}
  const byLocale = {}
  for (const d of docs) {
    byCategory[d.category] = (byCategory[d.category] ?? 0) + 1
    byLocale[d.locale] = (byLocale[d.locale] ?? 0) + 1
  }
  const words = docs.reduce((s, d) => s + d.body.split(/\s+/).length, 0)
  return { docCount: docs.length, chunkCount: chunks.length, words, byCategory, byLocale }
}
