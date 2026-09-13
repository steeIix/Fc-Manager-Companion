import type { Player, World } from './model'
export const FORMATIONS: Record<string, string[][]> = {
  '4-3-3': [['LW','ST','RW'], ['CM','CDM','CM'], ['LB','CB','CB','RB'], ['GK']],
  '4-2-3-1': [['ST'], ['LM','CAM','RM'], ['CDM','CDM'], ['LB','CB','CB','RB'], ['GK']],
  '4-4-2': [['ST','ST'], ['LM','CM','CM','RM'], ['LB','CB','CB','RB'], ['GK']],
  '3-5-2': [['ST','ST'], ['LWB','CM','CDM','CM','RWB'], ['CB','CB','CB'], ['GK']],
  '3-4-3': [['LW','ST','RW'], ['LM','CM','CM','RM'], ['CB','CB','CB'], ['GK']],
  '4-1-2-1-2': [['ST','ST'], ['CAM'], ['CM','CM'], ['CDM'], ['LB','CB','CB','RB'], ['GK']],
}
export function rankedOptions(players: Player[], pos: string) {
  return players.filter(p => p.positions.includes(pos)).sort((a, b) => b.ovr - a.ovr || b.pot - a.pot || a.age - b.age || a.id - b.id)
}
// Maximum-weight matching assigns a player only once, maximizes filled slots first,
// then total OVR. Hungarian assignment includes dummy columns for empty positions.
export function assignXI(players: Player[], positions: string[]): (Player | undefined)[] {
  const n = positions.length, m = players.length + n
  const u = Array(n + 1).fill(0), v = Array(m + 1).fill(0), p = Array(m + 1).fill(0), way = Array(m + 1).fill(0)
  const cost = (i: number, j: number) => j >= players.length ? 0 : players[j].positions.includes(positions[i]) ? -(1000 + players[j].ovr) : 1e6
  for (let i = 1; i <= n; i++) {
    p[0] = i; let j0 = 0
    const min = Array(m + 1).fill(Infinity), used = Array(m + 1).fill(false)
    do {
      used[j0] = true; const i0 = p[j0]; let delta = Infinity, j1 = 0
      for (let j = 1; j <= m; j++) if (!used[j]) {
        const cur = cost(i0 - 1, j - 1) - u[i0] - v[j]
        if (cur < min[j]) { min[j] = cur; way[j] = j0 }
        if (min[j] < delta) { delta = min[j]; j1 = j }
      }
      for (let j = 0; j <= m; j++) if (used[j]) { u[p[j]] += delta; v[j] -= delta } else min[j] -= delta
      j0 = j1
    } while (p[j0] !== 0)
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1 } while (j0)
  }
  const result: (Player | undefined)[] = Array(n).fill(undefined)
  for (let j = 1; j <= m; j++) if (p[j] && j <= players.length && players[j - 1].positions.includes(positions[p[j] - 1])) result[p[j] - 1] = players[j - 1]
  return result
}
export function depthIndex(world: World) {
  const index = new Map<string, Player[]>()
  for (const t of world.teams) for (const p of t.players) for (const pos of new Set(p.positions)) {
    const key = `${t.id}:${pos}`; if (!index.has(key)) index.set(key, []); index.get(key)!.push(p)
  }
  for (const rows of index.values()) rows.sort((a,b) => b.ovr - a.ovr || b.pot - a.pot || a.id - b.id)
  return index
}
export function depthRank(index: Map<string, Player[]>, player: Player, pos: string) {
  const options = index.get(`${player.teamId}:${pos}`) ?? []
  // Equal OVR shares first choice; POT never makes an equally rated player a backup.
  return { best: options[0], rank: options.length ? 1 + options.filter(p => p.ovr > player.ovr).length : null }
}
export const inSavedXI = (p: Player) => !['SUB','RES','?','—'].includes(p.squadPos)
