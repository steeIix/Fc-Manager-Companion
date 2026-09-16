import { useEffect, useState } from 'react'
import type { Team } from './model'

// Club crests. Resolution order:
//   1. /logos/{teamid}.png|svg  — a local pack (see scripts/import-logos.mjs, built from football-logos.cc packs)
//   2. sofifa CDN               — public/data/logos.json maps EA team ids to sofifa's crest ids (covers ~480 clubs)
//   3. kit-colour swatch        — always available, drawn from the save
let cdnMap: Record<string, number> | null = null
let cdnLoad: Promise<void> | null = null
function loadCdnMap() { return cdnLoad ??= fetch('/data/logos.json').then(r => r.json()).then(j => { cdnMap = j }).catch(() => { cdnMap = {} }) }
export const logosEnabled = () => localStorage.getItem('fc26-logos') !== 'off'
export const setLogosEnabled = (on: boolean) => localStorage.setItem('fc26-logos', on ? 'on' : 'off')

const failed = new Set<string>()

export function Logo({ team, size = 24, className }: { team: Team; size?: number; className?: string }) {
  const [, force] = useState(0)
  const [tick, setTick] = useState(0)
  useEffect(() => { if (!cdnMap) loadCdnMap().then(() => force(x => x + 1)) }, [])
  const candidates: string[] = []
  if (logosEnabled()) {
    candidates.push(`/logos/${team.id}.png`, `/logos/${team.id}.svg`)
    const c = cdnMap?.[String(team.id)]
    if (c) candidates.push(`https://cdn.sofifa.net/meta/team/${c}/${size <= 30 ? 30 : size <= 60 ? 60 : 120}.png`)
  }
  const src = candidates.find(u => !failed.has(u))
  const swatch = <span className={'crest swatch ' + (className ?? '')} style={{ width: size, height: size, background: `linear-gradient(135deg, ${team.colors[0]} 50%, ${team.colors[1]} 50%)` }} title={team.name} aria-hidden />
  if (!src) return swatch
  return <img className={'crest ' + (className ?? '')} src={src} width={size} height={size} alt="" loading="lazy" decoding="async"
    onError={() => { failed.add(src); setTick(tick + 1) }} />
}
