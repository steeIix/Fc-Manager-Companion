import type { World } from './model'
export interface PSnap { id: number; n: string; ovr: number; pot: number; age: number; birth?: string; contract?: number | null; pos: string; t: number; team: string; v: number; g: number; ar?: string; rk?: number }
export interface TSnap { id: number; n: string; ovr: number; v: number; lg: string }
export interface Snapshot {
  events?: { p: number; f: number; t: number; d: number; k: string }[]; order?: number; history?: HistoryFinish[]; id: string; gameId?: string; label: string; fileName: string; savedAt: number; asOf: number; season: number; manager: string; clubId: number; club: string; players: PSnap[]; teams: TSnap[] }
export type SnapMeta = Omit<Snapshot, 'players' | 'teams'> & { playerCount: number }
export interface HistoryFinish { season: number; team: number; league: number; position: number; completed: boolean }
export interface Game { historyPositions?: Record<string, number>; id: string; name: string; createdAt: number; shortlist: number[] }
export interface SavedFile { id: string; gameId: string; name: string; data: ArrayBuffer }
const DB = 'fc26-companion'
export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 3)
    r.onupgradeneeded = () => {
      const db = r.result
      if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('games')) db.createObjectStore('games', { keyPath: 'id' }).put({ id: 'legacy', name: 'My first game / existing snapshots', createdAt: Date.now(), shortlist: [] })
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' })
      const store = r.transaction!.objectStore('snapshots'), all = store.getAll()
      all.onsuccess = () => {
        const counts = new Map<string,number>()
        const sorted = (all.result as Snapshot[]).sort((a,b) => a.savedAt - b.savedAt || a.id.localeCompare(b.id))
        for (const s of sorted) { const gameId = s.gameId || 'legacy', order = (counts.get(gameId) ?? 0) + 1; counts.set(gameId,order); store.put(recordedSnapshot({ ...s, order })) }
      }
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
    events: w.events.map(e => ({ p: e.playerId, f: e.fromId, t: e.toId, d: e.date, k: e.kind })),
    players: w.players.map(p => ({ id: p.id, n: p.name, ovr: p.ovr, pot: p.pot, age: p.age, birth: p.birth, contract: p.contractUntil || null, pos: p.pos, t: p.teamId, team: p.team, v: p.value, g: p.gender, ar: p.archetype.label, rk: p.rank })),
    history: c.history.map(h => ({ season: Number(h.season), team: Number(h.teamid), league: Number(h.leagueid), position: Number(h.tableposition), completed: Number(h.season) < c.season })),
    teams: w.teams.map(t => ({ id: t.id, n: t.name, ovr: t.ovr, v: t.squadValue, lg: t.league })) }
}
export const saveSnapshot = (s: Snapshot) => tx('snapshots', 'readwrite', st => st.put(recordedSnapshot(s)))
export const saveWithFile = (s: Snapshot, data: ArrayBuffer) => transact(['snapshots', 'files'], 'readwrite', t => {
  const store = t.objectStore('snapshots'), request = store.getAll()
  request.addEventListener('success', () => {
    const all = request.result as Snapshot[], existing = all.find(x => x.id === s.id)
    const order = existing?.order ?? (Math.max(0,...all.filter(x => (x.gameId || 'legacy') === (s.gameId || 'legacy')).map(x => x.order ?? 0)) + 1)
    store.put(recordedSnapshot({ ...s, order }))
    t.objectStore('files').put({ id: s.id, gameId: s.gameId, name: s.fileName, data })
  })
  return request
})
export const deleteSnapshot = (id: string) => transact(['snapshots', 'files'], 'readwrite', t => { t.objectStore('files').delete(id); return t.objectStore('snapshots').delete(id) })
export const getSnapshot = (id: string) => tx<Snapshot | undefined>('snapshots', 'readonly', st => st.get(id))
export const getSavedFile = (id: string) => tx<SavedFile | undefined>('files', 'readonly', st => st.get(id))
export async function allSnapshots(gameId = 'legacy') { return (await tx<Snapshot[]>('snapshots', 'readonly', st => st.getAll())).filter(s => (s.gameId || 'legacy') === gameId).sort((a,b) => (a.order ?? 0) - (b.order ?? 0) || a.savedAt - b.savedAt || a.id.localeCompare(b.id)) }
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
  if (x.game.historyPositions !== undefined && (!x.game.historyPositions || typeof x.game.historyPositions !== 'object' || Array.isArray(x.game.historyPositions) || !Object.entries(x.game.historyPositions).every(([k,v]) => /^\d+:\d+:\d+$/.test(k) && typeof v==='number' && Number.isInteger(v) && v>=1 && v<=100))) throw new Error('Invalid history corrections.')
  const ids = new Set<string>()
  for (const s of x.snapshots) {
    if (!s || !str(s.id) || ids.has(s.id) || !['label','fileName','manager','club'].every(k => str(s[k])) || !['asOf','savedAt','season','clubId'].every(k => num(s[k])) || !Array.isArray(s.players) || !Array.isArray(s.teams)) throw new Error('Invalid or duplicate snapshot in export.')
    if (s.order !== undefined && (!Number.isInteger(s.order) || s.order < 1)) throw new Error('Invalid save order.')
    if (s.history !== undefined && (!Array.isArray(s.history) || !s.history.every((h:any) => h && ['season','team','league','position'].every(k=>num(h[k])) && typeof h.completed === 'boolean'))) throw new Error('Invalid history records.')
    ids.add(s.id)
    const playerIds = new Set<number>()
    for (const p of s.players) { if (!p || !['id','ovr','pot','t','g'].every(k => num(p[k])) || !['age','v'].every(k => p[k] === null || num(p[k])) || (p.birth !== undefined && !str(p.birth)) || (p.contract !== undefined && p.contract !== null && !num(p.contract)) || !['n','pos','team'].every(k => str(p[k])) || playerIds.has(p.id)) throw new Error('Invalid player in export.'); playerIds.add(p.id) }
    for (const t of s.teams) if (!t || !['id','ovr'].every(k => num(t[k])) || !(t.v === null || num(t.v)) || !['n','lg'].every(k => str(t[k]))) throw new Error('Invalid club in export.')
  }
  const fileIds = new Set<string>()
  for (const f of x.files) { if (!f || !ids.has(f.id) || fileIds.has(f.id) || !str(f.name) || !str(f.data)) throw new Error('Invalid saved file in export.'); fileIds.add(f.id) }
  return x
}
export async function importGame(text: string): Promise<Game> {
  const x = validateBundle(JSON.parse(text)), id = crypto.randomUUID()
  const g: Game = { id, name: x.game.name + ' (imported)', createdAt: Date.now(), shortlist: [...new Set(x.game.shortlist)], historyPositions: x.game.historyPositions }
  const ids = new Map(x.snapshots.map(s => [s.id, crypto.randomUUID()]))
  const files = x.files.map(f => { const decoded = atob(f.data); if (!decoded.startsWith('FBCHUNKS')) throw new Error('A saved file in this export is not an FC career save.'); return { id: ids.get(f.id)!, gameId: id, name: f.name, data: Uint8Array.from(decoded, c => c.charCodeAt(0)).buffer } })
  await transact(['games','snapshots','files'], 'readwrite', t => {
    const ordered = x.snapshots.slice().sort((a,b) => a.order != null && b.order != null ? a.order - b.order : a.savedAt - b.savedAt)
    ordered.forEach((s,i) => t.objectStore('snapshots').put(recordedSnapshot({ ...s, order: i + 1, id: ids.get(s.id)!, gameId: id })))
    for (const f of files) t.objectStore('files').put(f)
    return t.objectStore('games').put(g)
  })
  return g
}

export function recordedSnapshot(s: Snapshot): Snapshot {
  const { dateSource, originalAsOf, derivedDataStale, ...rest } = s as Snapshot & {dateSource?: string; originalAsOf?: number; derivedDataStale?: boolean}
  return { ...rest }
}
export const snapshotTitle = (s: { order?: number; label: string }) => `Save ${s.order ?? '?'}${s.label ? ` · ${s.label}` : ''}`
export const historyKey = (season:number,team:number,league:number) => `${season}:${team}:${league}`
export function recoverFinish(history: HistoryFinish[], season:number,team:number,league:number): number | null {
  const positions = new Set(history.filter(h=>h.completed && h.season===season && h.team===team && h.league===league && h.position>0).map(h=>h.position))
  return positions.size===1 ? [...positions][0] : null
}
export const setHistoryPosition = (gameId:string, key:string, position:number | null) => transact(['games'],'readwrite',t=>{
  if (position !== null && (!Number.isInteger(position) || position<1 || position>100)) throw new Error('Enter a position from 1 to 100.')
  const store=t.objectStore('games'),r=store.get(gameId)
  r.addEventListener('success',()=>{ const g:Game=r.result; if(!g){t.abort();return}; const historyPositions={...g.historyPositions}; if(position===null)delete historyPositions[key];else historyPositions[key]=position;store.put({...g,historyPositions}) })
  return r
})
