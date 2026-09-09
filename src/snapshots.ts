import type { World } from './model'

export interface PSnap { id: number; n: string; ovr: number; pot: number; age: number; pos: string; t: number; team: string; v: number; g: number }
export interface TSnap { id: number; n: string; ovr: number; v: number; lg: string }
export interface Snapshot { id: string; label: string; fileName: string; savedAt: number; asOf: number; season: number; manager: string; clubId: number; club: string; players: PSnap[]; teams: TSnap[] }
export type SnapMeta = Omit<Snapshot, 'players' | 'teams'> & { playerCount: number }

const DB = 'fc26-companion', STORE = 'snapshots'
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' })
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
  })
}
function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(db => new Promise<T>((res, rej) => { const q = fn(db.transaction(STORE, mode).objectStore(STORE)); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error) }))
}

export function fromWorld(w: World, fileName: string): Snapshot {
  const c = w.career
  return {
    id: `${c.asOf.getTime()}-${fileName}`, label: '', fileName, savedAt: Date.now(), asOf: c.asOf.getTime(), season: c.season, manager: c.manager, clubId: c.clubId, club: c.club?.name ?? '',
    players: w.players.map(p => ({ id: p.id, n: p.name, ovr: p.ovr, pot: p.pot, age: p.age, pos: p.pos, t: p.teamId, team: p.team, v: p.value, g: p.gender })),
    teams: w.teams.map(t => ({ id: t.id, n: t.name, ovr: t.ovr, v: t.squadValue, lg: t.league })),
  }
}
export const saveSnapshot = (s: Snapshot) => tx('readwrite', st => st.put(s))
export const deleteSnapshot = (id: string) => tx('readwrite', st => st.delete(id))
export const getSnapshot = (id: string) => tx<Snapshot | undefined>('readonly', st => st.get(id))
export async function listSnapshots(): Promise<SnapMeta[]> {
  const all = await tx<Snapshot[]>('readonly', st => st.getAll())
  return all.map(({ players, teams, ...m }) => ({ ...m, playerCount: players.length })).sort((a, b) => a.asOf - b.asOf)
}
export async function renameSnapshot(id: string, label: string) { const s = await getSnapshot(id); if (s) { s.label = label; await saveSnapshot(s) } }
