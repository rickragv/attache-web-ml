/**
 * Imports an external markdown documentation tree into src/data/corpus-ext/
 * (gitignored) so the app can be stress-tested against a real, large corpus.
 *
 *   node scripts/import-corpus.mjs <sourceDir> [maxFiles]
 *
 * Built for github/docs-style content: normalises frontmatter, strips Liquid
 * templating ({% ... %}, {{ ... }}), derives category from the top-level
 * directory, and skips stubs that are too short to be useful.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const [, , sourceDir, maxArg] = process.argv
if (!sourceDir) {
  console.error('usage: node scripts/import-corpus.mjs <sourceDir> [maxFiles]')
  process.exit(1)
}
const MAX = Number(maxArg) || Infinity
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'corpus-ext')

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const files = walk(sourceDir).filter((f) => f.endsWith('.md'))
let written = 0
let skipped = 0

for (const file of files) {
  if (written >= MAX) break
  const raw = readFileSync(file, 'utf8')
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  const meta = {}
  if (fm) {
    for (const line of fm[1].split(/\r?\n/)) {
      const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.+)$/)
      if (kv) meta[kv[1]] = kv[2].trim().replace(/^['"]|['"]$/g, '')
    }
  }

  const body = clean(fm ? raw.slice(fm[0].length) : raw)
  if (body.length < 400) {
    skipped++
    continue
  }

  const rel = relative(sourceDir, file).replaceAll('\\', '/')
  const category = rel.split('/')[0]
  const id = `ext-${rel.replace(/\.md$/, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`.slice(0, 80)
  const title = (meta.title ?? rel).replace(/"/g, "'")

  const out = [
    '---',
    `id: ${id}`,
    `title: "${title}"`,
    `category: ${category}`,
    'collection: github-docs',
    'tags: []',
    'locale: en',
    `updated: ${meta.date ?? '2026-01-01'}`,
    'owner: github-docs',
    'audience: external',
    '---',
    '',
    body,
  ].join('\n')

  writeFileSync(join(outDir, `${id}.md`), out, 'utf8')
  written++
}

console.log(`[import-corpus] wrote ${written} docs to ${outDir} (skipped ${skipped} stubs)`)

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

function clean(text) {
  return text
    .replace(/\{%-?[\s\S]*?-?%\}/g, ' ') // Liquid tags
    .replace(/\{\{[\s\S]*?\}\}/g, ' ') // Liquid variables
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ') // inline HTML
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
