import type { Player } from './model'

/**
 * Companion team rating — our own measure of how strong a squad is right now.
 *
 * The game's stored team overall is only recalculated when a team sheet is saved or the season
 * rolls over, so signings, growth and Live Editor edits can leave a club rated (and starred) far
 * below what its players say. This rating is rebuilt from the players every time a save loads.
 *
 *  1. Best XI. Every formation below is tried; players are assigned with an optimal (Hungarian)
 *     matching so nobody is used twice. A player keeps his full overall in his main position,
 *     loses 1 in a listed secondary position, 4 in a neighbouring role (e.g. LM↔LW, CM↔CDM) and
 *     12 anywhere else outfield. Keepers only keep goal. The formation with the highest total wins.
 *  2. Core — the average of that XI:                 75%
 *  3. Star power — the best three in the XI:          15%   (elite players decide games)
 *  4. Depth — the best seven left on the bench:       10%   (a missing bench spot counts as 50)
 *
 * The result is on the player-rating scale (a side of 85-rated starters with an 85 bench is 85),
 * so it reads higher than the game's figure, which sits ~3 points below the XI average.
 * Stars use our own thresholds, set so that at the start of a career roughly as many clubs
 * carry each star level as in the game — after that they follow the squad, not the calendar.
 */
export const RATING_FORMATIONS: Record<string, string[]> = {
  '4-3-3': ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'CDM', 'CM', 'LW', 'ST', 'RW'],
  '4-2-3-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CDM', 'LM', 'CAM', 'RM', 'ST'],
  '4-4-2': ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'],
  '4-1-2-1-2': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CM', 'CM', 'CAM', 'ST', 'ST'],
  '4-2-2-2': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CDM', 'CAM', 'CAM', 'ST', 'ST'],
  '4-1-4-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'LM', 'CM', 'CM', 'RM', 'ST'],
  '3-5-2': ['GK', 'CB', 'CB', 'CB', 'LM', 'CDM', 'CM', 'CDM', 'RM', 'ST', 'ST'],
  '3-4-3': ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'CM', 'RM', 'LW', 'ST', 'RW'],
  '3-4-2-1': ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'CM', 'RM', 'CAM', 'CAM', 'ST'],
  '5-3-2': ['GK', 'LB', 'CB', 'CB', 'CB', 'RB', 'CM', 'CDM', 'CM', 'ST', 'ST'],
}
const NEAR: Record<string, string[]> = {
  CB: ['CDM'], LB: ['RB', 'LM'], RB: ['LB', 'RM'],
  CDM: ['CM', 'CB'], CM: ['CDM', 'CAM'], CAM: ['CM', 'CF', 'ST'],
  LM: ['LW', 'RM', 'LB'], RM: ['RW', 'LM', 'RB'], LW: ['LM', 'RW'], RW: ['RM', 'LW'],
  ST: ['CF', 'CAM'], CF: ['ST', 'CAM'],
}
export const LINE_OF: Record<string, 'GK' | 'DEF' | 'MID' | 'ATT'> = {
  GK: 'GK', CB: 'DEF', LB: 'DEF', RB: 'DEF', LWB: 'DEF', RWB: 'DEF',
  CDM: 'MID', CM: 'MID', CAM: 'MID', LM: 'MID', RM: 'MID',
  LW: 'ATT', RW: 'ATT', ST: 'ATT', CF: 'ATT',
}
export const W_CORE = 0.75, W_TOP = 0.15, W_DEPTH = 0.10, EMPTY = 50
/** Star thresholds on our scale (½-star steps from 5 down to 1). */
export const STAR_STEPS: [number, number][] = [[85.5, 5], [81.5, 4.5], [77.5, 4], [73.5, 3.5], [71, 3], [69, 2.5], [67, 2], [65, 1.5], [62.5, 1]]
export const ratingStars = (r: number) => STAR_STEPS.find(([t]) => r >= t)?.[1] ?? 0.5

/** How well a player fits a slot: his rating there and how the fit is described. */
export function fitAt(p: Player, slot: string): { eff: number; fit: 'main' | 'secondary' | 'adapted' | 'out' } {
  if (p.pos === slot) return { eff: p.ovr, fit: 'main' }
  if ((p.pos === 'GK') !== (slot === 'GK')) return { eff: p.ovr - 40, fit: 'out' }
  if (p.positions.includes(slot)) return { eff: p.ovr - 1, fit: 'secondary' }
  if (NEAR[slot]?.includes(p.pos) || p.positions.some(x => NEAR[slot]?.includes(x))) return { eff: p.ovr - 4, fit: 'adapted' }
  return { eff: p.ovr - 12, fit: 'out' }
}

/** Maximum-weight assignment (Hungarian, slots × players with empty columns). */
function assign(players: Player[], slots: string[]) {
  const n = slots.length, m = players.length + n
  const fits = slots.map(s => players.map(p => fitAt(p, s).eff))
  const cost = (i: number, j: number) => j >= players.length ? -EMPTY : -fits[i][j]
  const u = Array(n + 1).fill(0), v = Array(m + 1).fill(0), pp = Array(m + 1).fill(0), way = Array(m + 1).fill(0)
  for (let i = 1; i <= n; i++) {
    pp[0] = i; let j0 = 0
    const min = Array(m + 1).fill(Infinity), used = Array(m + 1).fill(false)
    do {
      used[j0] = true; const i0 = pp[j0]; let delta = Infinity, j1 = 0
      for (let j = 1; j <= m; j++) if (!used[j]) {
        const cur = cost(i0 - 1, j - 1) - u[i0] - v[j]
        if (cur < min[j]) { min[j] = cur; way[j] = j0 }
        if (min[j] < delta) { delta = min[j]; j1 = j }
      }
      for (let j = 0; j <= m; j++) if (used[j]) { u[pp[j]] += delta; v[j] -= delta } else min[j] -= delta
      j0 = j1
    } while (pp[j0] !== 0)
    do { const j1 = way[j0]; pp[j0] = pp[j1]; j0 = j1 } while (j0)
  }
  const out: (Player | undefined)[] = Array(n).fill(undefined)
  for (let j = 1; j <= players.length; j++) if (pp[j]) out[pp[j] - 1] = players[j - 1]
  return out
}

export interface XISlot { slot: string; line: 'GK' | 'DEF' | 'MID' | 'ATT'; player?: Player; eff: number; fit: 'main' | 'secondary' | 'adapted' | 'out' | 'empty' }
export interface TeamRating {
  /** Companion rating, one decimal. */
  score: number; stars: number; formation: string; xi: XISlot[]
  core: number; top: number; depth: number
  lines: { GK: number; DEF: number; MID: number; ATT: number }
  bench: Player[]
}
const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
const r1 = (x: number) => Math.round(x * 10) / 10

export function rateTeam(players: Player[]): TeamRating {
  // Cheap pre-filter: nobody outside a club's best 30 can make its XI.
  const pool = players.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 30)
  let best: { f: string; xi: XISlot[]; total: number } | null = null
  for (const [f, slots] of Object.entries(RATING_FORMATIONS)) {
    const picked = assign(pool, slots)
    const xi: XISlot[] = slots.map((slot, i) => {
      const p = picked[i]
      if (!p) return { slot, line: LINE_OF[slot], eff: EMPTY, fit: 'empty' }
      const { eff, fit } = fitAt(p, slot)
      return eff < EMPTY ? { slot, line: LINE_OF[slot], eff: EMPTY, fit: 'empty' } : { slot, line: LINE_OF[slot], player: p, eff, fit }
    })
    const total = xi.reduce((s, x) => s + x.eff, 0)
    if (!best || total > best.total) best = { f, xi, total }
  }
  const { f, xi } = best!
  const effs = xi.map(x => x.eff)
  const core = avg(effs)
  const top = avg(effs.slice().sort((a, b) => b - a).slice(0, 3))
  const used = new Set(xi.map(x => x.player?.id))
  const bench = players.filter(p => !used.has(p.id)).sort((a, b) => b.ovr - a.ovr).slice(0, 7)
  const depth = avg([...bench.map(p => p.ovr), ...Array(7 - bench.length).fill(EMPTY)])
  const score = r1(W_CORE * core + W_TOP * top + W_DEPTH * depth)
  const line = (l: XISlot['line']) => Math.round(avg(xi.filter(x => x.line === l).map(x => x.eff)))
  return {
    score, stars: ratingStars(score), formation: f, xi, core: r1(core), top: r1(top), depth: r1(depth), bench,
    lines: { GK: line('GK'), DEF: line('DEF'), MID: line('MID'), ATT: line('ATT') },
  }
}
