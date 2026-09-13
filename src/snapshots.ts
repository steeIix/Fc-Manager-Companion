import type { World } from './model'
export interface PSnap { id: number; n: string; ovr: number; pot: number; age: number; pos: string; t: number; team: string; v: number; g: number }
export interface TSnap { id: number; n: string; ovr: number; v: number; lg: string }
export interface Snapshot { id: string; gameId?: string; label: string; fileName: string; savedAt: number; asOf: number; season: number; manager: string; clubId: number; club: string; players: PSnap[]; teams: TSnap[] }
export type SnapMeta = Omit<Snapshot, 'players' | 'teams'> & { playerCount: number }
export interface Game { id: string; name: string; createdAt: number; shortlist: number[] }
export interface SavedFile { id: string; gameId: string; name: string; data: ArrayBuffer }
const DB = 'fc26-companion'
export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 2)
    r.onupgradeneeded = () => {
      const db = r.result
      if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots', { keyPath: 'id' })
      db.createObjectStore('games', { keyPath: 'id' }).put({ id: 'legacy', name: 'My first game / existing snapshots', createdAt: Date.now(), shortlist: [] })
      db.createObjectStore('files', { keyPath: 'id' })
    }
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
    r.onblocked = () => reject(new Error('Close other Companion tabs, then try again.'))
  })
}
export async function transact<T>(stores: string[], mode: IDBTransactionMode, work: (tx: IDBTransaction) => IDBRequest<T>): Promise<T> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode); let result: T
    t.oncomplete = () => { db.close(); resolve(result) }
    t.onabort = t.onerror = () => { db.close(); reject(t.error || new Error('Could not store data. Check browser storage space.')) }
    try { const r = work(t); r.onsuccess = () => { result = r.result } } catch (e) { t.abort(); reject(e) }
  })
}
const tx = <T,>(store: string, mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>) => transact([store], mode, t => work(t.objectStore(store)))
export function fromWorld(w: World, fileName: string, gameId = 'legacy'): Snapshot {
  const c = w.career
  return { id: crypto.randomUUID(), gameId, label: '', fileName, savedAt: Date.now(), asOf: c.asOf.getTime(), season: c.season, manager: c.manager, clubId: c.clubId, club: c.club?.name ?? '',
    players: w.players.map(p => ({ id: p.id, n: p.name, ovr: p.ovr, pot: p.pot, age: p.age, pos: p.pos, t: p.teamId, team: p.team, v: p.value, g: p.gender })),
    teams: w.teams.map(t => ({ id: t.id, n: t.name, ovr: t.ovr, v: t.squadValue, lg: t.league })) }
}
export const saveSnapshot = (s: Snapshot) => tx('snapshots', 'readwrite', st => st.put(s))
export const saveWithFile = (s: Snapshot, data: ArrayBuffer) => transact(['snapshots', 'files'], 'readwrite', t => { t.objectStore('files').put({ id: s.id, gameId: s.gameId, name: s.fileName, data }); return t.objectStore('snapshots').put(s) })
export const deleteSnapshot = (id: string) => transact(['snapshots', 'files'], 'readwrite', t => { t.objectStore('files').delete(id); return t.objectStore('snapshots').delete(id) })
export const getSnapshot = (id: string) => tx<Snapshot | undefined>('snapshots', 'readonly', st => st.get(id))
export const getSavedFile = (id: string) => tx<SavedFile | undefined>('files', 'readonly', st => st.get(id))
export async function allSnapshots(gameId = 'legacy') { return (await tx<Snapshot[]>('snapshots', 'readonly', st => st.getAll())).filter(s => (s.gameId || 'legacy') === gameId).sort((a, b) => a.asOf - b.asOf || a.savedAt - b.savedAt || a.id.localeCompare(b.id)) }
export async function listSnapshots(gameId = 'legacy'): Promise<SnapMeta[]> { return (await allSnapshots(gameId)).map(({ players, teams, ...m }) => ({ ...m, playerCount: players.length })) }
export async function renameSnapshot(id: string, label: string) { const s = await getSnapshot(id); if (s) await saveSnapshot({ ...s, label }) }
export const listGames = () => tx<Game[]>('games', 'readonly', s => s.getAll())
export const saveGame = (g: Game) => tx('games', 'readwrite', s => s.put(g))
export async function toggleTarget(gameId: string, id: number) {
  return transact(['games'], 'readwrite', t => {
    const s = t.objectStore('games'), r = s.get(gameId)
    r.addEventListener('success', () => { const g: Game = r.result; if (!g) { t.abort(); return }; g.shortlist = g.shortlist.includes(id) ? g.shortlist.filter(x => x !== id) : [...g.shortlist, id]; s.put(g) })
    return r
  })
}
export async function exportGame(game: Game) {
  const snapshots = await allSnapshots(game.id)
  const files = (await tx<SavedFile[]>('files', 'readonly', s => s.getAll())).filter(f => f.gameId === game.id)
  const encoded = await Promise.all(files.map(f => new Promise<{ id: string; name: string; data: string }>((resolve, reject) => {
    const r = new FileReader(); r.onerror = () => reject(r.error); r.onload = () => resolve({ id: f.id, name: f.name, data: String(r.result).split(',')[1] }); r.readAsDataURL(new Blob([f.data]))
  })))
  return JSON.stringify({ format: 'fc26-companion-game', version: 1, game, snapshots, files: encoded })
}
export function validateBundle(value: unknown): { game: Game; snapshots: Snapshot[]; files: { id: string; name: string; data: string }[] } {
  const x = value as any
  const str = (v: unknown) => typeof v === 'string'
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
  if (!x || x.format !== 'fc26-companion-game' || x.version !== 1 || !x.game || !str(x.game.name) || !Array.isArray(x.game.shortlist) || !x.game.shortlist.every(num) || !Array.isArray(x.snapshots) || !Array.isArray(x.files)) throw new Error('Not a supported Companion game export.')
  const ids = new Set<string>()
  for (const s of x.snapshots) {
    if (!s || !str(s.id) || ids.has(s.id) || !['label','fileName','manager','club'].every(k => str(s[k])) || !['asOf','savedAt','season','clubId'].every(k => num(s[k])) || !Array.isArray(s.players) || !Array.isArray(s.teams)) throw new Error('Invalid or duplicate snapshot in export.')
    ids.add(s.id)
    const playerIds = new Set<number>()
    for (const p of s.players) { if (!p || !['id','ovr','pot','age','t','v','g'].every(k => num(p[k])) || !['n','pos','team'].every(k => str(p[k])) || playerIds.has(p.id)) throw new Error('Invalid player in export.'); playerIds.add(p.id) }
    for (const t of s.teams) if (!t || !['id','ovr','v'].every(k => num(t[k])) || !['n','lg'].every(k => str(t[k]))) throw new Error('Invalid club in export.')
  }
  const fileIds = new Set<string>()
  for (const f of x.files) { if (!f || !ids.has(f.id) || fileIds.has(f.id) || !str(f.name) || !str(f.data)) throw new Error('Invalid saved file in export.'); fileIds.add(f.id) }
  return x
}
export async function importGame(text: string): Promise<Game> {
  const x = validateBundle(JSON.parse(text)), id = crypto.randomUUID()
  const g: Game = { id, name: x.game.name + ' (imported)', createdAt: Date.now(), shortlist: [...new Set(x.game.shortlist)] }
  const ids = new Map(x.snapshots.map(s => [s.id, crypto.randomUUID()]))
  const files = x.files.map(f => { const decoded = atob(f.data); if (!decoded.startsWith('FBCHUNKS')) throw new Error('A saved file in this export is not an FC career save.'); return { id: ids.get(f.id)!, gameId: id, name: f.name, data: Uint8Array.from(decoded, c => c.charCodeAt(0)).buffer } })
  await transact(['games','snapshots','files'], 'readwrite', t => {
    for (const s of x.snapshots) t.objectStore('snapshots').put({ ...s, id: ids.get(s.id), gameId: id })
    for (const f of files) t.objectStore('files').put(f)
    return t.objectStore('games').put(g)
  })
  return g
}
