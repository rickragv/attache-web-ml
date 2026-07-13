/**
 * Minimal YAML frontmatter parser covering the subset the corpus uses:
 * scalars, quoted strings, [inline, arrays]. Deliberately not a YAML engine.
 */
export function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!m) return { meta: {}, body: raw.trim() }

  const meta = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/)
    if (!kv) continue
    meta[kv[1]] = parseValue(kv[2].trim())
  }
  return { meta, body: raw.slice(m[0].length).trim() }
}

function parseValue(v) {
  if (v === '') return ''
  if (v.startsWith('[') && v.endsWith(']')) {
    return v
      .slice(1, -1)
      .split(',')
      .map((x) => stripQuotes(x.trim()))
      .filter(Boolean)
  }
  return stripQuotes(v)
}

function stripQuotes(v) {
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1)
  }
  return v
}
