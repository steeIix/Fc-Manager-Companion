import { useEffect, useMemo, useState } from 'react'
import { Table } from './Table'
import { fmtDate, fmtMoney, posGroup, matchesPos, POS_ORDER, POS_GROUPS, type World, type Team } from './model'
import { Logo } from './Logo'
import { allSnapshots, type Snapshot, type PSnap } from './snapshots'

export interface Move {
  id: string; playerId: number; name: string; pos: string; ovr: number; pot: number; age: number; value: number; gender: number
  fromId: number; from: string; toId: number; to: string
  date?: number            // yyyymmdd, only when the game logged it
  window: string           // which pair of saves the change was seen between
  windowKey: string        // id of the later save in that pair ('news' for rows that come only from the game's log)
  confirmed: boolean       // matched to an in-game news row
  kind: 'transfer' | 'released' | 'signed'
}
export interface Retirement { playerId: number; name: string; team: string; date: number
}

const d8 = (n: number) => new Date(Date.UTC(Math.floor(n / 10000), Math.floor(n / 100) % 100 - 1, n % 100))
const FREE = 'Free agent'

/** A club's kit colour, nudged until it reads against the current background. */
function clubInk(t: Team | undefined) {
  if (!t) return undefined
  const dark = document.documentElement.dataset.theme === 'dark'
  for (const hex of t.colors) {
    const v = hex.replace('#', '')
    if (v.length !== 6) continue
    let r = parseInt(v.slice(0, 2), 16), g = parseInt(v.slice(2, 4), 16), b = parseInt(v.slice(4, 6), 16)
    const lum = (r * .299 + g * .587 + b * .114) / 255
    if (dark ? lum < .12 : lum > .82) continue        // unusable against this background
    const mix = (c: number, target: number, amt: number) => Math.round(c + (target - c) * amt)
    if (dark && lum < .45) { r = mix(r, 255, .45); g = mix(g, 255, .45); b = mix(b, 255, .45) }
    if (!dark && lum > .62) { r = mix(r, 0, .35); g = mix(g, 0, .35); b = mix(b, 0, .35) }
    return `rgb(${r},${g},${b})`
  }
  return undefined
}
function ClubLink({ id, name, world, open }: { id: number; name: string; world: World; open: (id: number) => void }) {
  const team = id >= 0 ? world.teamById.get(id) : undefined
  if (!team) return <span className="dim">{name}</span>
  return <a href="#" className="with-crest club-link" style={{ color: clubInk(team) }} onClick={e => { e.preventDefault(); e.stopPropagation(); open(id) }}><Logo team={team} size={18} />{name}</a>
}

/** Squad changes between consecutive saves, enriched with the game's own dated news rows. */
export function buildMoves(snaps: Snapshot[], world: World): Move[] {
  const ordered = snaps.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const moves: Move[] = []
  // every event row we have seen, keyed by player + destination, so a squad change can be dated
  const evIndex = new Map<string, { date: number }>()
  const addEvents = (evs?: { p: number; f: number; t: number; d: number; k: string }[]) => {
    for (const e of evs ?? []) {
      if (e.k !== 'transfer') continue
      const k = `${e.p}:${e.t}`
      const cur = evIndex.get(k)
      if (!cur || e.d > cur.date) evIndex.set(k, { date: e.d })
    }
  }
  for (const s of ordered) addEvents(s.events)
  addEvents(world.events.map(e => ({ p: e.playerId, f: e.fromId, t: e.toId, d: e.date, k: e.kind })))

  const label = (s: Snapshot) => s.label || `Save ${s.order ?? '?'}`
  for (let i = 1; i < ordered.length; i++) {
    const before = new Map(ordered[i - 1].players.map(p => [p.id, p]))
    for (const now of ordered[i].players) {
      const was = before.get(now.id)
      if (!was || was.t === now.t) continue
      const ev = evIndex.get(`${now.id}:${now.t}`)
      const kind: Move['kind'] = now.t < 0 ? 'released' : was.t < 0 ? 'signed' : 'transfer'
      moves.push({
        id: `${now.id}-${ordered[i].id}`, playerId: now.id, name: now.n, pos: now.pos, ovr: now.ovr, pot: now.pot, age: now.age, value: now.v, gender: now.g,
        fromId: was.t, from: was.t < 0 ? FREE : was.team, toId: now.t, to: now.t < 0 ? FREE : now.team,
        date: ev?.date, window: `${label(ordered[i - 1])} → ${label(ordered[i])}`, windowKey: ordered[i].id, confirmed: !!ev, kind,
      })
    }
  }
  // Events for moves we have no snapshot pair for (e.g. only one save imported) still make useful rows.
  const seen = new Set(moves.map(m => `${m.playerId}:${m.toId}`))
  for (const e of world.events) {
    if (e.kind !== 'transfer') continue
    if (seen.has(`${e.playerId}:${e.toId}`)) continue
    const p = world.playerById.get(e.playerId)
    if (!p) continue
    moves.push({
      id: `ev-${e.playerId}-${e.date}`, playerId: e.playerId, name: p.name, pos: p.pos, ovr: p.ovr, pot: p.pot, age: p.age, value: p.value, gender: p.gender,
      fromId: e.fromId, from: world.teamById.get(e.fromId)?.name ?? FREE, toId: e.toId, to: e.toId < 0 ? FREE : world.teamById.get(e.toId)?.name ?? 'Unknown club',
      date: e.date, window: 'In-game news', windowKey: 'news', confirmed: true, kind: 'transfer',
    })
  }
  return moves
}

export function Transfers({ world, gameId, refresh, openClub, pick }: { world: World; gameId?: string; refresh: number; openClub: (id: number) => void; pick: (id: number) => void }) {
  const [snaps, setSnaps] = useState<Snapshot[]>([])
  const [sort, setSort] = useState<'ovr' | 'date' | 'value'>('ovr')
  const [minOvr, setMinOvr] = useState(75)
  const [pos, setPos] = useState('')
  const [gender, setGender] = useState<0 | 1>(0)
  const [club, setClub] = useState(-2)
  const [onlyConfirmed, setOnlyConfirmed] = useState(false)
  const [win, setWin] = useState<string>('latest')
  useEffect(() => { if (gameId) allSnapshots(gameId).then(setSnaps).catch(() => setSnaps([])) }, [gameId, refresh])

  const moves = useMemo(() => buildMoves(snaps, world), [snaps, world])
  const ordered = useMemo(() => snaps.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [snaps])
  // Each import adds a window; by default only the newest one is shown so old transfers don't pile up.
  const windows = useMemo(() => ordered.slice(1).map((s, i) => ({ key: s.id, label: `${ordered[i].label || `Save ${ordered[i].order ?? '?'}`} → ${s.label || `Save ${s.order ?? '?'}`}` })).reverse(), [ordered])
  const latestKey = windows[0]?.key
  const rows = useMemo(() => {
    const wantWin = win === 'latest' ? latestKey : win
    const r = moves.filter(m => !world.playerById.get(m.playerId)?.isYouth && m.ovr >= minOvr && m.gender === gender && matchesPos({ pos: m.pos, positions: [m.pos] }, pos)
      && (club === -2 || m.fromId === club || m.toId === club) && (!onlyConfirmed || m.confirmed)
      && (win === 'all' || !wantWin || m.windowKey === wantWin || (m.windowKey === 'news' && win === 'latest')))
    r.sort((a, b) => sort === 'ovr' ? b.ovr - a.ovr || b.pot - a.pot : sort === 'value' ? b.value - a.value : (b.date ?? 0) - (a.date ?? 0) || b.ovr - a.ovr)
    return r
  }, [moves, minOvr, gender, pos, club, onlyConfirmed, sort, win, latestKey])

  const clubs = useMemo(() => world.teams.filter(t => t.leagueId >= 0 && t.gender === gender && !t.isSpecial && !t.isYouth && !t.isFreeAgentPool).sort((a, b) => a.name.localeCompare(b.name)), [world, gender])
  const confirmedCount = moves.filter(m => m.confirmed).length

  return <>
    <h1>Transfers</h1>
    <p className="sub">Squad changes between your saves, merged with the transfer news the game recorded. Shows the most recent import window by default, so moves you have already seen don't pile up — switch to the whole career or an earlier window below. Live Editor moves appear too; the game never logs those, but the squads still change.</p>
    <div className="bar">
      <div className="seg"><button className={gender === 0 ? 'on' : ''} onClick={() => setGender(0)}>Men</button><button className={gender === 1 ? 'on' : ''} onClick={() => setGender(1)}>Women</button></div>
      <div className="seg">{([['ovr', 'Overall'], ['date', 'Most recent'], ['value', 'Value']] as const).map(([k, l]) => <button key={k} className={sort === k ? 'on' : ''} onClick={() => setSort(k)}>{l}</button>)}</div>
      <span className="range">Min OVR <input type="number" value={minOvr} onChange={e => setMinOvr(+e.target.value)} /></span>
      <select aria-label="Position" value={pos} onChange={e => setPos(e.target.value)}><option value="">Any position</option><optgroup label="Groups">{POS_GROUPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</optgroup><optgroup label="Positions">{POS_ORDER.map(p => <option key={p}>{p}</option>)}</optgroup></select>
      <select aria-label="Club" value={club} onChange={e => setClub(+e.target.value)}><option value={-2}>Any club</option>{clubs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
      <select aria-label="Window" value={win} onChange={e => setWin(e.target.value)}>
        <option value="latest">Since previous save</option>
        <option value="all">Whole career</option>
        {windows.map(w => <option key={w.key} value={w.key}>{w.label}</option>)}
      </select>
      <label className="chk"><input type="checkbox" checked={onlyConfirmed} onChange={e => setOnlyConfirmed(e.target.checked)} /> In-game news only</label>
      <span className="count">{rows.length} moves</span>
    </div>
    {snaps.length < 2 && <p className="sub">Only one save is imported for this game, so the list shows the transfer news held in that save ({confirmedCount} rows). Import a later save to see every squad change between the two.</p>}
    {rows.length === 0 ? <p className="dim">No moves match these filters.</p> :
      <Table className="tbl"><thead><tr><th className="num">#</th><th>Player</th><th>Pos</th><th className="num">Age</th><th className="num">OVR</th><th className="num">POT</th><th>From</th><th>To</th><th className="num">Value</th><th>When</th></tr></thead><tbody>
        {rows.slice(0, 300).map((m, i) => <tr key={m.id} className="click" onClick={() => pick(m.playerId)}>
          <td className="num dim">{i + 1}</td>
          <td className="name">{m.name}{m.kind === 'released' && <span className="tag">released</span>}{m.kind === 'signed' && <span className="tag">free signing</span>}</td>
          <td><span className={'pos ' + posGroup(m.pos).toLowerCase()}>{m.pos}</span></td>
          <td className="num">{m.age}</td><td className="num"><span className={'rt ' + (m.ovr >= 85 ? 'r5' : m.ovr >= 78 ? 'r4' : m.ovr >= 70 ? 'r3' : m.ovr >= 60 ? 'r2' : 'r1')}>{m.ovr}</span></td><td className="num dim">{m.pot}</td>
          <td><ClubLink id={m.fromId} name={m.from} world={world} open={openClub} /></td>
          <td><ClubLink id={m.toId} name={m.to} world={world} open={openClub} /></td>
          <td className="num">{fmtMoney(m.value)}</td>
          <td className="when-cell">{m.date ? fmtDate(d8(m.date)) : <span className="dim">{m.window}</span>}{!m.confirmed && <small title="Squad change seen between two saves; the game logged no news for it — Live Editor edits look like this">not in game news</small>}</td>
        </tr>)}
      </tbody></Table>}
  </>
}
