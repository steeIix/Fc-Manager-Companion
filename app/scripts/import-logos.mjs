#!/usr/bin/env node
// Import club crests from football-logos.cc collection packs into public/logos/{teamId}.png
//
//   1. Download packs from https://football-logos.cc/collections/ and unzip them anywhere, e.g. ./packs/
//   2. node scripts/import-logos.mjs ./packs [--size 256]
//
// Files are matched to EA team ids by club name (public/data/teams-ref.json holds id -> name, generated from a save).
// Unmatched files/teams are listed so you can add overrides to scripts/logo-overrides.json ({ "teamId": "file-slug" }).
import { readdirSync, statSync, copyFileSync, existsSync, readFileSync, mkdirSync } from 'fs'
import { join, basename, extname } from 'path'

const [,, root, ...rest] = process.argv
if (!root) { console.error('usage: node scripts/import-logos.mjs <unzipped packs folder> [--size 256]'); process.exit(1) }
const size = rest.includes('--size') ? rest[rest.indexOf('--size') + 1] : '256'
const ref = JSON.parse(readFileSync('public/data/teams-ref.json', 'utf8'))
const overrides = existsSync('scripts/logo-overrides.json') ? JSON.parse(readFileSync('scripts/logo-overrides.json', 'utf8')) : {}
mkdirSync('public/logos', { recursive: true })

const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\b(fc|cf|sc|ac|as|ss|us|sv|vfb|vfl|tsv|tsg|fsv|bsc|rcd|rc|cd|ud|sd|afc|cfc|club|de|del|la|the|football|deportivo|calcio|sporting|sport|club|athletic|athletico|atletico|athletic club|women|ladies|feminino|fem|frauen|femenino|1\.|04|05|09|1846|1860|1893|1899|1901|1904|1907|1909|1910|1919|1920)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ').trim()
const tokens = s => new Set(norm(s).split(' ').filter(Boolean))
const score = (a, b) => { const A = tokens(a), B = tokens(b); if (!A.size || !B.size) return 0; let hit = 0; for (const t of A) if (B.has(t)) hit++; return hit / Math.max(A.size, B.size) }

// collect candidate files: prefer a "{size}x{size}" folder if the pack has one, and strip the content hash from slugs
const files = []
const walk = d => { for (const f of readdirSync(d)) { const p = join(d, f); const st = statSync(p); if (st.isDirectory()) walk(p); else if (/\.(png|svg)$/i.test(f)) files.push(p) } }
walk(root)
const bySlug = new Map()
for (const p of files) {
  const slug = basename(p, extname(p)).replace(/\.[0-9a-f]{6,}$/i, '').replace(/--(white|no-text|monochrome).*$/, '')
  const sizeHit = p.includes(`${size}x${size}`) ? 2 : /\.svg$/i.test(p) ? 1 : 0
  const cur = bySlug.get(slug)
  if (!cur || sizeHit > cur.sizeHit || (sizeHit === cur.sizeHit && statSync(p).size > statSync(cur.p).size)) bySlug.set(slug, { p, sizeHit, name: slug.replace(/-/g, ' ') })
}
console.log(`${bySlug.size} logo slugs found in ${root}`)

let matched = 0; const unmatchedTeams = []
for (const [id, name] of Object.entries(ref)) {
  let best = null, bestScore = 0
  if (overrides[id]) { best = bySlug.get(overrides[id]); bestScore = 1 }
  else for (const [slug, f] of bySlug) { const s = score(name, f.name); if (s > bestScore) { bestScore = s; best = f } }
  if (best && bestScore >= 0.6) { copyFileSync(best.p, join('public/logos', `${id}${extname(best.p).toLowerCase()}`)); matched++ }
  else unmatchedTeams.push(`${id}\t${name}`)
}
console.log(`matched ${matched} clubs → public/logos/`)
if (unmatchedTeams.length) { console.log(`\n${unmatchedTeams.length} clubs without a logo (add to scripts/logo-overrides.json as "teamId": "file-slug"):`); console.log(unmatchedTeams.slice(0, 60).join('\n')); if (unmatchedTeams.length > 60) console.log(`… and ${unmatchedTeams.length - 60} more`) }
