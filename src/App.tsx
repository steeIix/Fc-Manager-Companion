import { Table } from './Table'
import React, { Fragment, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { parseSave, isCareerSave, type Meta } from './parser'
import { Snapshots } from './Snapshots'
import { fromWorld, saveWithFile, getSnapshot, getSavedFile, saveSnapshot, allSnapshots, setHistoryPosition, recoverFinish, historyKey, type HistoryFinish, listGames, toggleTarget, type Game } from './snapshots'
import { Games, Timeline, Youth, Planner, Shortlist } from './Features'
import { depthIndex, opportunity, lineupIndex, inSavedXI } from './planning'
import { ARCHETYPES, GROUP_LABEL, archetypeBlurb, type Group } from './archetypes'
import { Logo, logosEnabled, setLogosEnabled } from './Logo'
import { buildWorld, fmtMoney, fmtDate, posGroup, POS_ORDER, POS_GROUPS, matchesPos, ATTR_GROUPS, ATTR_LABEL, type World, type Player, type Team, type League, type Names, type ValueModel } from './model'

function useClubTheme(colors?: string[]) {
  useEffect(() => {
    const root = document.documentElement
    const lum = (hex: string) => { const v = hex.replace('#', ''); return (parseInt(v.slice(0, 2), 16) * .299 + parseInt(v.slice(2, 4), 16) * .587 + parseInt(v.slice(4, 6), 16) * .114) / 255 }
    // skip near-white and near-black kit colours — they can't carry the accent
    const club = colors?.find(c => lum(c) > .12 && lum(c) < .72) ?? colors?.[0]
    if (!club) { root.style.removeProperty('--club'); root.style.removeProperty('--club-ink'); root.style.removeProperty('--club-tint'); return }
    const v = club.replace('#', '')
    root.style.setProperty('--club', club)
    root.style.setProperty('--club-ink', lum(club) > .62 ? '#201e1d' : '#ffffff')
    root.style.setProperty('--club-tint', `rgba(${parseInt(v.slice(0, 2), 16)},${parseInt(v.slice(2, 4), 16)},${parseInt(v.slice(4, 6), 16)},.12)`)
  }, [colors?.join()])
}
function useCountUp(target: number, ms = 620) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(target); return }
    let raf = 0; const t0 = performance.now()
    const step = (now: number) => { const t = Math.min((now - t0) / ms, 1); setN(Math.round(target * (1 - Math.pow(1 - t, 3)))); if (t < 1) raf = requestAnimationFrame(step) }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return n
}
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', overflow: 'hidden', transition: 'grid-template-rows .28s cubic-bezier(.2,.8,.2,1)' }}><div style={{ minHeight: 0, overflow: 'hidden' }}>{children}</div></div>
}
function ClubSwitcher({ world, viewed, go }: { world: World; viewed?: Team; go: (id: number) => void }) {
  const [open, setOpen] = useState(false)
  const t = viewed ?? world.career.club
  const options = useMemo(() => {
    const mine = world.career.club
    const league = t ? world.leagues.find(l => l.id === t.leagueId)?.teams ?? [] : []
    const list = [...(mine ? [mine] : []), ...league.filter(x => x.id !== mine?.id).slice().sort((a, b) => b.ovr - a.ovr)]
    return list.slice(0, 24)
  }, [world, t?.leagueId])
  const swatch = (tm: Team, size = 14) => <Logo team={tm} size={size} />
  if (!t) return null
  return <div className="club-switch">
    <div className="kicker">Active club</div>
    <button className="trigger" onClick={() => setOpen(o => !o)} aria-expanded={open}>{swatch(t, 26)}<span style={{ flex: 1, minWidth: 0 }}><b>{t.name}</b><span className="meta">{t.ovr} OVR · {t.league}</span></span><span style={{ transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span></button>
    <Collapse open={open}><div className="menu">{options.map(o => <button key={o.id} className={o.id === t.id ? 'on' : ''} onClick={() => { setOpen(false); go(o.id) }}>{swatch(o, 16)}<span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.name}{o.id === world.career.clubId ? ' · yours' : ''}</span><span className="meta">{o.ovr}</span></button>)}</div></Collapse>
    <div className="meta" style={{ marginTop: 12, lineHeight: 1.5 }}>{world.career.manager} · Season {world.career.season}<br />As of {fmtDate(world.career.asOf)}</div>
  </div>
}

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('fc26-theme') as 'light' | 'dark') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'))
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('fc26-theme', theme) }, [theme])
  return { theme, toggle: () => setTheme(t => t === 'dark' ? 'light' : 'dark') }
}
const ThemeButton = ({ t }: { t: { theme: string; toggle: () => void } }) => <button className="theme-btn" onClick={t.toggle} aria-label="Toggle dark mode">{t.theme === 'dark' ? '☀ Light' : '☾ Dark'}</button>

type View = { kind: 'games' } | { kind: 'shortlist' } | { kind: 'snapshots' } | { kind: 'leagues' } | { kind: 'league'; id: number } | { kind: 'club'; id: number } | { kind: 'players' } | { kind: 'my' }

const Rating = ({ v }: { v: number }) => <span className={'rt ' + (v >= 85 ? 'r5' : v >= 78 ? 'r4' : v >= 70 ? 'r3' : v >= 60 ? 'r2' : 'r1')}>{v}</span>
const Pos = ({ p }: { p: string }) => <span className={'pos ' + posGroup(p).toLowerCase()}>{p}</span>
const Stars = ({ n }: { n: number }) => <span className="stars" title={`${n} stars`}>{'★'.repeat(Math.floor(n))}{n % 1 ? '½' : ''}</span>

const TargetContext = createContext<{ ids: number[]; toggle: (id: number) => void }>({ ids: [], toggle: () => {} })
function StarButton({ p }: { p: Player }) { const targets = useContext(TargetContext); const on = targets.ids.includes(p.id); return <button className="star-btn" aria-label={`${on ? 'Remove' : 'Add'} ${p.name} ${on ? 'from' : 'to'} shortlist`} aria-pressed={on} onClick={e => { e.stopPropagation(); targets.toggle(p.id) }}>{on ? '★' : '☆'}</button> }
export default function App() {
  const loadingFile = useRef(false)
  const [game, setGame] = useState<Game | null>(null)
  const themeCtl = useTheme()
  useEffect(() => { listGames().then(gs => { let active = ''; try { active = localStorage.getItem('fc26-active-game') ?? '' } catch {} setGame(gs.find(g => g.id === active) ?? gs[0] ?? null) }).catch(e => setErr(String(e))) }, [])
  useEffect(() => { if (game) try { localStorage.setItem('fc26-active-game', game.id) } catch {} }, [game?.id])
  const [world, setWorld] = useState<World | null>(null)
  const [fileName, setFileName] = useState('')
  const [view, setView] = useState<View>({ kind: 'leagues' })
  const viewedClub = view.kind === 'club' ? world?.teamById.get(view.id) : world?.career.club
  useClubTheme(world ? viewedClub?.colors : undefined)
  const [sel, setSel] = useState<Player | null>(null)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [snapId, setSnapId] = useState<string>()
  const [snapTick, setSnapTick] = useState(0)
  const assets = useRef<{ meta: Meta; names: Names; nations: Record<string, string>; vm: ValueModel } | null>(null)

  async function ensureAssets() {
      if (!assets.current) {
        const [meta, names, nations, vm] = await Promise.all(['meta', 'names', 'nations', 'valuemodel'].map(n => fetch(`/data/${n}.json`).then(r => r.json())))
        assets.current = { meta, names, nations, vm }
      }
  }
  function selectGame(g: Game) { if (g.id !== game?.id) { setWorld(null); setSel(null); setSnapId(undefined) }; setGame(g) }
  async function toggle(id: number) { if (!game) return; try { const g = await toggleTarget(game.id, id); setGame({ ...g }); } catch (e) { setErr(String(e)) } }
  async function load(file: File, existingId?: string, selectedGame?: Game) {
    if (loadingFile.current) return
    loadingFile.current = true
    setErr(''); setBusy('Reading save…')
    try {
      const active = selectedGame ?? game
      if (!active) throw new Error('Select or create a game before opening a save.')
      await ensureAssets()
      const buf = await file.arrayBuffer()
      if (!isCareerSave(buf)) throw new Error('This file is not an FC 26 career save. Pick a file that starts with "CmMgr" from your settings folder.')
      setBusy('Decoding databases…')
      await new Promise(r => setTimeout(r, 20))
      const tables = parseSave(buf, assets.current!.meta)
      if (!tables.players?.length) throw new Error('No player table was found in this save.')
      const existing = existingId ? await getSnapshot(existingId) : undefined
      const w = buildWorld(tables, assets.current!.names, assets.current!.nations, assets.current!.vm)
      if (existingId) { setSnapId(existingId); if (existing) await saveSnapshot({ ...fromWorld(w, file.name, active.id), id: existing.id, order: existing.order, label: existing.label, savedAt: existing.savedAt }) }
      else { const s = fromWorld(w, file.name, active.id); await saveWithFile(s, buf); setSnapId(s.id); setSnapTick(x => x + 1) }
      setGame(active); setSel(null); setWorld(w); setFileName(file.name); setView(w.career.club ? { kind: 'my' } : { kind: 'leagues' })
    } catch (e: any) { setErr(e.message || String(e)) }
    setBusy(''); loadingFile.current = false
  }

  const gamePanel = <fieldset className="game-controls" disabled={!!busy}><Games active={game} onSelect={selectGame} onLoad={load} refresh={snapTick} /></fieldset>
  if (!world) return <div className="landing">
    <div className="hero"><div><h1>FC26 Manager Companion</h1><p className="sub" style={{ margin: 0 }}>Open a career save and browse every league, club and player in your world — ratings, potential, values, contracts and how they change save by save.</p></div><ThemeButton t={themeCtl} /></div>
    <div className="grid">
      <div className="card"><h2>Add a save</h2><DropScreen onFile={load} busy={busy} err={err} /></div>
      <div className="card"><h2>Your games</h2>{gamePanel}</div>
    </div>
    {game && <details className="landing-history"><summary>Browse this game’s snapshots and player histories</summary><Snapshots key={game.id} gameId={game.id} refresh={snapTick} /></details>}
  </div>

  const c = world.career
  return (
    <TargetContext.Provider value={{ ids: game?.shortlist ?? [], toggle }}><div className="shell">
      <aside className="rail">
        <div className="brand"><small style={{ marginTop: 0, marginBottom: 6 }}>FC26 Companion</small>Manager Desk<small>{fileName}</small></div>
        <ClubSwitcher world={world} viewed={viewedClub ?? undefined} go={id => setView({ kind: 'club', id })} />
        <nav>
          <button className={view.kind === 'games' ? 'on' : ''} onClick={() => setView({ kind: 'games' })}>Games &amp; saves</button>
          <button className={view.kind === 'shortlist' ? 'on' : ''} onClick={() => setView({ kind: 'shortlist' })}>Shortlist ({game?.shortlist.length ?? 0})</button>
          {c.club && <button className={view.kind === 'my' ? 'on' : ''} onClick={() => setView({ kind: 'my' })}>My club</button>}
          <button className={view.kind === 'leagues' || view.kind === 'league' ? 'on' : ''} onClick={() => setView({ kind: 'leagues' })}>Leagues &amp; clubs</button>
          <button className={view.kind === 'players' ? 'on' : ''} onClick={() => setView({ kind: 'players' })}>Player search</button>
          <button className={view.kind === 'snapshots' ? 'on' : ''} onClick={() => setView({ kind: 'snapshots' })}>Snapshots &amp; compare</button>
        </nav>
        <div className="foot">{world.players.length.toLocaleString()} players · {world.teams.length} clubs · {world.leagues.length} leagues<br />Values are estimates from the game's rating curve; wages are shown only where the save holds a contract. In-game date is inferred from the latest event in the save.<div style={{ display: 'flex', gap: 8, marginBottom: 12 }}><ThemeButton t={themeCtl} /><button style={{ margin: 0 }} onClick={() => { setWorld(null); setView({ kind: 'leagues' }) }}>New save</button></div><label className="logo-toggle"><input type="checkbox" defaultChecked={logosEnabled()} onChange={e => { setLogosEnabled(e.target.checked); location.reload() }} /> Club crests</label></div>
      </aside>
      <main className="main">
        {err && <p className="err" role="alert">{err}</p>}{busy && <p role="status">{busy}</p>}
        {view.kind === 'games' && gamePanel}
        {view.kind === 'shortlist' && game && <Shortlist game={game} world={world} pick={setSel} toggle={toggle} refresh={snapTick} />}
        {view.kind === 'leagues' && <Leagues world={world} open={id => setView({ kind: 'league', id })} />}
        {view.kind === 'league' && <LeagueView league={world.leagues.find(l => l.id === view.id)!} back={() => setView({ kind: 'leagues' })} open={id => setView({ kind: 'club', id })} userClub={c.clubId} pick={setSel} world={world} />}
        {view.kind === 'club' && <ClubView team={world.teamById.get(view.id)!} world={world} back={() => setView({ kind: 'league', id: world.teamById.get(view.id)!.leagueId })} pick={setSel} />}
        {view.kind === 'players' && <Search world={world} pick={setSel} openClub={id => setView({ kind: 'club', id })} />}
        {view.kind === 'snapshots' && <Snapshots key={game?.id} gameId={game?.id ?? 'legacy'} currentId={snapId} refresh={snapTick} />}
        {view.kind === 'my' && c.club && <MyClub game={game} onGameChange={setGame} world={world} open={() => setView({ kind: 'club', id: c.club!.id })} pick={setSel} />}
      </main>
      {sel && <PlayerModal gameId={game?.id ?? 'legacy'} refresh={snapTick} p={sel} world={world} close={() => setSel(null)} openClub={id => { setSel(null); setView({ kind: 'club', id }) }} />}
    </div></TargetContext.Provider>
  )
}

function DropScreen({ onFile, busy, err }: { onFile: (f: File) => void; busy: string; err: string }) {
  const [over, setOver] = useState(false)
  return (
    <div className="drop">
      <div className={'zone' + (over ? ' over' : '')} onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); if (busy) return; const f = e.dataTransfer.files[0]; if (f) onFile(f) }}>
        <strong>Drop your career save here</strong>
        <div>Files are named <span className="path">CmMgrC…</span> or <span className="path">CmMgrP…</span> and live in <span className="path">%LOCALAPPDATA%\EA SPORTS FC 26\settings</span></div>
        <label>Choose a file<input disabled={!!busy} type="file" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} /></label>
        {busy && <div className="progress">{busy}</div>}
      </div>
      {err && <div className="err">{err}</div>}
      <p className="note">Everything is decoded in your browser; the save never leaves your machine. Each save you open is stored as a snapshot in the selected game, so later saves from the same career can be compared.</p>
    </div>
  )
}

function Leagues({ world, open }: { world: World; open: (id: number) => void }) {
  const [g, setG] = useState<'all' | 'men' | 'women'>('all')
  const ls = world.leagues.filter(l => g === 'all' || (g === 'women') === l.women)
  return <>
    <h1>Leagues</h1>
    <p className="sub">Ranked by average club rating. Pick a league to see its clubs.</p>
    <div className="bar"><div className="seg">{(['all', 'men', 'women'] as const).map(k => <button key={k} className={g === k ? 'on' : ''} onClick={() => setG(k)}>{k[0].toUpperCase() + k.slice(1)}</button>)}</div><span className="count">{ls.length} leagues</span></div>
    <div className="lg-grid">{ls.map(l => <button key={l.id} className="lg-card" onClick={() => open(l.id)}>
      <div className="big">{l.avgOvr}</div><div><b>{l.name}</b><span>{l.teams.length} clubs · best {Math.max(...l.teams.map(t => t.ovr))} · {l.teams[0]?.played ? `leader ${l.teams[0].name}` : `strongest ${l.teams.slice().sort((a, b) => b.ovr - a.ovr)[0].name}`}</span></div>
    </button>)}</div>
  </>
}

function useSort<T>(rows: T[], init: string, get: (r: T, k: string) => any, initDesc = true) {
  const [k, setK] = useState(init); const [desc, setDesc] = useState(initDesc)
  const sorted = useMemo(() => rows.slice().sort((a, b) => { const x = get(a, k), y = get(b, k); const c = typeof x === 'string' ? x.localeCompare(y) : (x ?? 0) - (y ?? 0); return desc ? -c : c }), [rows, k, desc])
  const Th = ({ id, label, num }: { id: string; label: string; num?: boolean }) => <th className={'sortable' + (num ? ' num' : '')} onClick={() => { if (k === id) setDesc(!desc); else { setK(id); setDesc(true) } }}>{label}{k === id ? (desc ? ' ▾' : ' ▴') : ''}</th>
  return { sorted, Th }
}

function LeagueBest({ league, open, pick, world }: { league: League; open: (id: number) => void; pick: (p: Player) => void; world: World }) {
  const [pos, setPos] = useState(''); const [by, setBy] = useState<'ovr' | 'pot' | 'value' | 'growth'>('ovr'); const [n, setN] = useState(25); const [maxAge, setMaxAge] = useState(99)
  const rows = useMemo(() => {
    const all = league.teams.flatMap(t => t.players).filter(p => matchesPos(p, pos) && p.age <= maxAge)
    all.sort((a, b) => by === 'ovr' ? b.ovr - a.ovr || b.pot - a.pot : by === 'pot' ? b.pot - a.pot || b.ovr - a.ovr : by === 'value' ? b.value - a.value : (b.pot - b.ovr) - (a.pot - a.ovr) || b.pot - a.pot)
    return all.slice(0, n)
  }, [league, pos, by, n, maxAge])
  return <>
    <h2>Best players in {league.name}</h2>
    <div className="bar">
      <select aria-label="Position" value={pos} onChange={e => setPos(e.target.value)}><option value="">Any position</option><optgroup label="Groups">{POS_GROUPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</optgroup><optgroup label="Positions">{POS_ORDER.map(p => <option key={p}>{p}</option>)}</optgroup></select>
      <div className="seg">{(['ovr', 'pot', 'value', 'growth'] as const).map(k => <button key={k} className={by === k ? 'on' : ''} onClick={() => setBy(k)}>{{ ovr: 'Overall', pot: 'Potential', value: 'Value', growth: 'Room to grow' }[k]}</button>)}</div>
      <span className="range">Max age <input type="number" value={maxAge} onChange={e => setMaxAge(+e.target.value || 99)} /></span>
      <div className="seg">{[10, 25, 50, 100].map(k => <button key={k} className={n === k ? 'on' : ''} onClick={() => setN(k)}>Top {k}</button>)}</div>
    </div>
    <Table className="tbl"><thead><tr><th className="num">#</th><th>Player</th><th>Pos</th><th className="num">Age</th><th>Nation</th><th>Club</th><th className="num">OVR</th><th className="num">POT</th><th className="num">Value</th><th className="num">Contract</th></tr></thead><tbody>
      {rows.map((p, i) => <tr key={p.id} className="click" onClick={() => pick(p)}>
        <td className="num dim">{i + 1}</td><td className="name"><span className={p.known ? '' : 'unk'}>{p.name}</span></td><td><Pos p={p.pos} />{pos && !pos.startsWith('G:') && p.pos !== pos && <span className="dim" style={{ marginLeft: 6, fontSize: 12 }}>also {pos}</span>}</td>
        <td className="num">{p.age}</td><td>{p.nation}</td><td><a href="#" className="with-crest" onClick={e => { e.preventDefault(); e.stopPropagation(); open(p.teamId) }}>{world.teamById.get(p.teamId) && <Logo team={world.teamById.get(p.teamId)!} size={18} />}{p.team}</a></td>
        <td className="num"><Rating v={p.ovr} /></td><td className="num"><Rating v={p.pot} /></td><td className="num">{fmtMoney(p.value)}</td><td className="num">{p.contractUntil || '–'}</td>
      </tr>)}
    </tbody></Table>
  </>
}

function LeagueView({ league, back, open, userClub, pick, world }: { league: League; back: () => void; open: (id: number) => void; userClub: number; pick: (p: Player) => void; world: World }) {
  const hasTable = league.teams.some(t => t.played > 0)
  const { sorted, Th } = useSort(league.teams, hasTable ? 'pos' : 'ovr', (t, k) => k === 'pos' ? -(t.tablePos || 99) : k === 'name' ? t.name : (t as any)[k], true)
  return <>
    <div className="crumb"><button onClick={back}>Leagues</button><span>/</span><span>{league.name}</span></div>
    <h1>{league.name}</h1>
    <p className="sub">{league.teams.length} clubs · average rating {league.avgOvr}{league.women ? ' · women\'s competition' : ''}</p>
    <Table className="tbl"><thead><tr>
      {hasTable && <Th id="pos" label="#" num />}<Th id="name" label="Club" /><Th id="ovr" label="OVR" num /><Th id="att" label="ATT" num /><Th id="mid" label="MID" num /><Th id="def" label="DEF" num /><th>Stars</th><Th id="squadValue" label="Squad value" num /><Th id="worth" label="Club worth" num /><Th id="squadSize" label="Squad" num /><Th id="avgAge" label="Avg age" num />
      {hasTable && <><Th id="played" label="P" num /><Th id="points" label="Pts" num /></>}
    </tr></thead><tbody>
      {sorted.map(t => <tr key={t.id} className={'click' + (t.id === userClub ? ' user' : '')} onClick={() => open(t.id)}>
        {hasTable && <td className="num dim">{t.tablePos || '–'}</td>}
        <td className="name"><span className="with-crest"><Logo team={t} size={22} />{t.name}</span></td><td className="num"><Rating v={t.ovr} /></td><td className="num">{t.att}</td><td className="num">{t.mid}</td><td className="num">{t.def}</td>
        <td><Stars n={t.stars} /></td><td className="num">{fmtMoney(t.squadValue)}</td><td className="num">{t.worth ? fmtMoney(t.worth) : '–'}</td><td className="num">{t.squadSize}</td><td className="num">{t.avgAge}</td>
        {hasTable && <><td className="num">{t.played}</td><td className="num"><b>{t.points}</b></td></>}
      </tr>)}
    </tbody></Table>
    <LeagueBest league={league} open={open} pick={pick} world={world} />
  </>
}

function ClubHeader({ t, world }: { t: Team; world: World }) {
  const ovr = useCountUp(t.ovr)
  return <div className="club-head">
    <div className="stripe">{t.colors.map((c, i) => <i key={i} style={{ background: c }} />)}</div>
    <div className="body">
      <div className="ovr">{ovr}<small>overall · <Stars n={t.stars} /></small></div>
      <div className="club-title"><Logo team={t} size={72} className="club-crest" /><div><h1>{t.name}</h1><div className="meta">{t.league}{t.played ? ` · ${ordinal(t.tablePos)} in table, ${t.points} pts from ${t.played}` : ' · season not started'}{t.founded ? ` · est. ${t.founded}` : ''}{t.capacity ? ` · ${t.capacity.toLocaleString()} seats` : ''}{t.id === world.career.clubId ? ' · your club' : ''}</div></div></div>
      <div className="kpis">
        <div className="kpi"><b>{t.att} / {t.mid} / {t.def}</b><span>Attack / midfield / defence</span></div>
        <div className="kpi"><b>{fmtMoney(t.squadValue)}</b><span>Squad value</span></div>
        <div className="kpi"><b>{t.worth ? fmtMoney(t.worth) : '–'}</b><span>Club worth</span></div>
        <div className="kpi"><b>{t.squadSize} · {t.avgAge}</b><span>Players · average age</span></div>
      </div>
    </div>
  </div>
}
const ordinal = (n: number) => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4) % 4] ?? 'th')

function Roster({ players, world, pick, wages }: { players: Player[]; world: World; pick: (p: Player) => void; wages: boolean }) {
  const [mode, setMode] = useState<'pos' | 'ovr' | 'pot' | 'value' | 'age'>('pos')
  const rows = useMemo(() => {
    const r = players.slice()
    if (mode === 'ovr') r.sort((a, b) => b.ovr - a.ovr); else if (mode === 'pot') r.sort((a, b) => b.pot - a.pot || b.ovr - a.ovr)
    else if (mode === 'value') r.sort((a, b) => b.value - a.value); else if (mode === 'age') r.sort((a, b) => a.age - b.age || b.ovr - a.ovr)
    return r
  }, [players, mode])
  let lastGrp = ''
  return <>
    <div className="bar"><span style={{ color: 'var(--ink-2)' }}>Order by</span><div className="seg">{(['pos', 'ovr', 'pot', 'value', 'age'] as const).map(k => <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{{ pos: 'Position', ovr: 'Overall', pot: 'Potential', value: 'Value', age: 'Age' }[k]}</button>)}</div><span className="count">{players.length} players</span></div>
    <Table className="tbl"><thead><tr><th className="num">#</th><th>Player</th><th>Pos</th><th>Also</th><th className="num">Age</th><th>Archetype</th><th className="num">OVR</th><th className="num">POT</th><th className="num">Value</th>{wages && <th className="num">Wage / wk</th>}<th className="num">Contract</th><th className="num">Goals</th></tr></thead><tbody>
      {rows.map(p => {
        const g = mode === 'pos' ? posGroup(p.pos) : ''
        const head = g && g !== lastGrp ? <tr className="grp" key={'g' + g}><td colSpan={wages ? 12 : 11}>{{ GK: 'Goalkeepers', DEF: 'Defenders', MID: 'Midfielders', ATT: 'Forwards' }[g]}</td></tr> : null
        lastGrp = g
        return <Fragment key={p.id}>{head}<tr className="click" onClick={() => pick(p)}>
          <td className="num dim">{p.jersey || '–'}</td>
          <td className="name"><span className={p.known ? '' : 'unk'}>{p.name}</span>{p.id === world.teamById.get(p.teamId)?.captainId && <span className="tag">C</span>}{p.injury > 0 && <span className="tag inj">Injured</span>}{p.onLoanFrom && <span className="tag loan" title={`From ${p.onLoanFrom} until ${p.loanEnd}`}>Loan record</span>}</td>
          <td><Pos p={p.pos} /></td><td className="dim">{p.positions.slice(1).join(' ')}</td><td className="num">{p.age}</td><td className="arch-cell" title={p.nation}>{p.archetype.label}</td>
          <td className="num"><Rating v={p.ovr} /></td><td className="num"><Rating v={p.pot} /></td><td className="num">{fmtMoney(p.value)}</td>
          {wages && <td className="num">{p.wage != null ? fmtMoney(p.wage) : '–'}</td>}
          <td className="num">{p.contractUntil || '–'}</td><td className="num dim">{p.leagueGoals}</td>
        </tr></Fragment>
      })}
    </tbody></Table>
  </>
}

function ClubView({ team, world, back, pick }: { team: Team; world: World; back: () => void; pick: (p: Player) => void }) {
  return <>
    <div className="crumb"><button onClick={back}>{team.league}</button><span>/</span><span>{team.name}</span></div>
    <ClubHeader t={team} world={world} />
    <Roster players={team.players} world={world} pick={pick} wages={team.id === world.career.clubId} />
  </>
}

function MyClub({ world, open, pick, game, onGameChange }: { game: Game | null; onGameChange: (g:Game)=>void; world: World; open: () => void; pick: (p: Player) => void }) {
  const [tab, setTab] = useState('overview')
  const [recordedHistory,setRecordedHistory]=useState<HistoryFinish[]>([])
  useEffect(()=>{let live=true;if(game)allSnapshots(game.id).then(snaps=>{if(live)setRecordedHistory(snaps.flatMap(s=>s.history??[]))});return()=>{live=false}},[game?.id,world])
  async function changeFinish(key:string,position:number|null){if(!game)return;await setHistoryPosition(game.id,key,position);const updated=(await listGames()).find(g=>g.id===game.id);if(updated)onGameChange(updated)}
  const c = world.career, t = c.club!
  const contracted = t.players.filter(p => p.wage != null)
  const wageBill = contracted.reduce((s, p) => s + (p.wage ?? 0), 0)
  const contracts = t.players.filter(p=>p.contractUntil>0)
  const rising = t.players.filter(p => p.pot - p.ovr >= 5).sort((a, b) => b.pot - a.pot).slice(0, 8)
  return <>
    <ClubHeader t={t} world={world} />
    <div className="seg club-tabs">{['overview','youth','planning'].map(k => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{{overview:'Overview',youth:`Youth (${world.youth.length})`,planning:'Squad planning & depth'}[k]}</button>)}</div>
    {tab === 'youth' ? <Youth world={world} pick={pick} /> : tab === 'planning' ? <Planner world={world} pick={pick} /> : <>
    <div className="split">
      <div className="kpi"><b>{fmtMoney(wageBill)}</b><span>Weekly wage bill across {contracted.length} contracts</span></div>
      <div className="kpi"><b>{c.manager}</b><span>Manager · season {c.season} · {fmtMoney(c.wage)}/wk</span></div>
      <div className="kpi"><b>{contracts.length}</b><span>Recorded contract end years</span></div>
    </div>
    {c.history.length > 0 && <>
      <h2>Manager history</h2><p className="sub">This save contains the career’s history from earlier seasons. A zero finishing position means the save has no recorded placement; it is never displayed as 0th. Each history row is not a stored snapshot. The first snapshot you imported can be from a later season.</p>
      <Table className="tbl"><thead><tr><th className="num">Season</th><th>Club</th><th>League</th><th className="num">Pos</th><th className="num">P</th><th className="num">W</th><th className="num">D</th><th className="num">L</th><th className="num">GF</th><th className="num">GA</th><th className="num">Pts</th><th>Biggest signing</th><th>Biggest sale</th><th className="num">Job security</th></tr></thead><tbody>
        {c.history.map((h, i) => <tr key={`${h.season}-${h.teamid}-${i}`}><td className="num">{h.season as number}</td><td className="name">{world.teamById.get(h.teamid as number)?.name ?? '–'}</td><td className="dim">{world.leagues.find(l => l.id === h.leagueid)?.name ?? '–'}</td><td className="num"><HistoryPosition season={Number(h.season)} team={Number(h.teamid)} league={Number(h.leagueid)} recorded={Number(h.tableposition)} currentSeason={c.season} history={recordedHistory} game={game} onSave={changeFinish} /></td><td className="num">{h.games_played as number}</td><td className="num">{h.wins as number}</td><td className="num">{h.draws as number}</td><td className="num">{h.losses as number}</td><td className="num">{h.goals_for as number}</td><td className="num">{h.goals_against as number}</td><td className="num"><b>{h.points as number}</b></td>
          <td>{h.bigbuyplayername ? `${h.bigbuyplayername} (${fmtMoney(h.bigbuyamount as number)})` : '–'}</td><td>{h.bigsellplayername ? `${h.bigsellplayername} (${fmtMoney(h.bigsellamount as number)})` : '–'}</td><td className="num">{h.jobsecurityscore as number}</td></tr>)}
      </tbody></Table>
    </>}
    {rising.length > 0 && <>
      <h2>Room to grow</h2>
      <Table className="tbl"><thead><tr><th>Player</th><th>Pos</th><th>Born</th><th className="num">OVR</th><th className="num">POT</th></tr></thead><tbody>
        {rising.map(p => <tr key={p.id} className="click" onClick={() => pick(p)}><td className="name">{p.name}</td><td><Pos p={p.pos} /></td><td>{p.birth}</td><td className="num"><Rating v={p.ovr} /></td><td className="num"><Rating v={p.pot} /></td></tr>)}
      </tbody></Table>
    </>}
    <h2>Squad</h2>
    <Roster players={t.players} world={world} pick={pick} wages />
    <p className="sub" style={{ marginTop: 12 }}><button className="lg-card" style={{ padding: '8px 14px' }} onClick={open}>Open club page</button></p>
    </>}
  </>
}

const R = ({ v, set }: { v: number[]; set: (v: number[]) => void }) => <><input type="number" value={v[0]} onChange={e => set([+e.target.value, v[1]])} /><span>–</span><input type="number" value={v[1]} onChange={e => set([v[0], +e.target.value])} /></>

function Search({ world, pick, openClub }: { world: World; pick: (p: Player) => void; openClub: (id: number) => void }) {
  const [role, setRole] = useState('all'), [contract, setContract] = useState(''), [foot, setFoot] = useState(''), [minGrowth, setMinGrowth] = useState(''), [minSkill, setMinSkill] = useState(''), [minWeak, setMinWeak] = useState(''), [fit, setFit] = useState(false), [notLoan, setNotLoan] = useState(false)
  const [includeSecondary, setIncludeSecondary] = useState(false), [slotOverride, setSlotOverride] = useState(0), [minAhead, setMinAhead] = useState(0)
  const depth = useMemo(() => depthIndex(world, includeSecondary), [world, includeSecondary])
  const lineups = useMemo(() => lineupIndex(world), [world])
  const youthIds = useMemo(() => new Set(world.youth.map(y => y.id)), [world])
  const [q, setQ] = useState(''); const [g, setG] = useState<'all' | 0 | 1>('all'); const [pos, setPos] = useState('')
  const [adv, setAdv] = useState(false); const [arch, setArch] = useState(''); const [tag, setTag] = useState(''); const [ovr, setOvr] = useState([40, 99]); const [pot, setPot] = useState([40, 99]); const [age, setAge] = useState([15, 45]); const [lg, setLg] = useState(-2); const [page, setPage] = useState(0)
  const specialLeagues = useMemo(() => new Set(world.leagues.filter(l => l.intl).map(l => l.id)), [world])
  const opportunities = useMemo(() => new Map(world.players.map(p => [p.id, opportunity(depth, lineups, p, pos || p.pos, slotOverride)])), [world, depth, lineups, pos, slotOverride])
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return world.players.filter(p => !youthIds.has(p.id) &&
      (!contract || (p.contractUntil > 0 && p.contractUntil <= Number(contract))) && (!foot || p.foot === foot) && (!minGrowth || p.pot - p.ovr >= Number(minGrowth)) && (!minSkill || p.skill >= Number(minSkill)) && (!minWeak || p.weak >= Number(minWeak)) && (!fit || !p.injury) && (!notLoan || !p.onLoanFrom) &&
      opportunities.get(p.id)!.ahead.length >= minAhead && (role === 'all' || (role === 'backup' && opportunities.get(p.id)!.blocked) || (role === 'best' && opportunities.get(p.id)!.rank !== null && (opportunities.get(p.id)!.slots ?? 0) > 0 && !opportunities.get(p.id)!.blocked) || (role === 'buried' && opportunities.get(p.id)!.blocked && opportunities.get(p.id)!.ahead.length >= 2) || (role === 'bench' && p.teamId >= 0 && ['SUB','RES'].includes(p.squadPos)) || (role === 'xi' && p.teamId >= 0 && inSavedXI(p))) && (g === 'all' || p.gender === g) && (!pos || (pos.startsWith('G:') ? matchesPos(p, pos) : includeSecondary ? p.positions.includes(pos) : p.pos === pos)) && p.ovr >= ovr[0] && p.ovr <= ovr[1] && p.pot >= pot[0] && p.pot <= pot[1] && p.age >= age[0] && p.age <= age[1] && (!arch || p.archetype.id === arch) && (!tag || p.archetype.tags.includes(tag)) && (lg === -2 ? !specialLeagues.has(p.leagueId) : p.leagueId === lg) && (!s || p.name.toLowerCase().includes(s) || p.team.toLowerCase().includes(s) || p.nation.toLowerCase().includes(s)))
  }, [world, q, g, pos, ovr, pot, age, arch, tag, lg, specialLeagues, role, contract, foot, minGrowth, minSkill, minWeak, fit, notLoan, depth, youthIds, opportunities, minAhead, includeSecondary])
  const allTags = useMemo(() => Array.from(new Set(world.players.flatMap(p => p.archetype.tags))).sort(), [world])
  const showDepth = adv || role !== 'all' || minAhead > 0
  const { sorted, Th } = useSort(rows, 'ovr', (p, k) => (p as any)[k])
  useEffect(() => setPage(0), [rows])
  const per = 100, pages = Math.ceil(sorted.length / per)
  return <>
    <h1>Player search</h1>
    <p className="sub">Every player in the save. Search by name, club or nation; narrow by rating, potential, age, position and league. Open the squad-depth filters to find players stuck behind better options.</p>
    <div className="bar">
      <input type="text" placeholder="Name, club or nation" value={q} onChange={e => setQ(e.target.value)} />
      <div className="seg"><button className={g === 'all' ? 'on' : ''} onClick={() => setG('all')}>All</button><button className={g === 0 ? 'on' : ''} onClick={() => setG(0)}>Men</button><button className={g === 1 ? 'on' : ''} onClick={() => setG(1)}>Women</button></div>
      <select aria-label="Search position" value={pos} onChange={e => setPos(e.target.value)}><option value="">Any position</option><optgroup label="Groups">{POS_GROUPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</optgroup><optgroup label="Positions">{POS_ORDER.map(p => <option key={p}>{p}</option>)}</optgroup></select>
      <select value={lg} onChange={e => setLg(+e.target.value)}><option value={-2}>Any club league</option><option value={-1}>Free agents</option>{world.leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
    </div>
    <div className="bar">
      <span className="range">OVR <R v={ovr} set={setOvr} /></span><span className="range">POT <R v={pot} set={setPot} /></span><span className="range">Age <R v={age} set={setAge} /></span>
      <select aria-label="Archetype" value={arch} onChange={e => setArch(e.target.value)}><option value="">Any archetype</option>{(Object.keys(GROUP_LABEL) as Group[]).map(g => <optgroup key={g} label={GROUP_LABEL[g]}>{ARCHETYPES.filter(x => x.group === g).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>)}</select>
      <select aria-label="Style tag" value={tag} onChange={e => setTag(e.target.value)}><option value="">Any style tag</option>{allTags.map(t => <option key={t}>{t}</option>)}</select>
      <span className="count">{sorted.length.toLocaleString()} players</span>
    </div>
    <details className="adv" open={adv} onToggle={e => setAdv((e.target as HTMLDetailsElement).open)}><summary>Squad-depth filters (role, starting slots, contract, foot, skills)</summary><div className="bar advanced-filters">
      <label>Club role<select value={role} onChange={e => setRole(e.target.value)}><option value="all">Any role</option><option value="backup">Outside starting slots</option><option value="buried">Buried behind 2+ players</option><option value="best">Within starting slots</option><option value="bench">Saved substitutes / reserves</option><option value="xi">Saved starting XI</option></select></label>
      <label>Position matching<select value={includeSecondary ? 'all' : 'primary'} onChange={e => setIncludeSecondary(e.target.value === 'all')}><option value="primary">Primary position only</option><option value="all">Include secondary positions</option></select></label>
      <label>Starting slots<select aria-label="Starting slots" value={slotOverride} onChange={e => setSlotOverride(Number(e.target.value))}><option value={0}>Auto: recorded XI only</option>{[1,2,3,4].map(n => <option key={n} value={n}>{n} starting slot{n > 1 ? 's' : ''}</option>)}</select></label>
      <label>Minimum players ahead<select value={minAhead} onChange={e => setMinAhead(Number(e.target.value))}>{[0,1,2,3,4].map(n => <option key={n} value={n}>{n === 0 ? 'Any' : `${n}+ higher-rated players`}</option>)}</select></label>
      
      <label>Contract ending by<input type="number" min="2000" placeholder="Year" value={contract} onChange={e => setContract(e.target.value)} /></label>
      <label>Min growth (POT − OVR)<input type="number" min="0" value={minGrowth} onChange={e => setMinGrowth(e.target.value)} /></label>
      <label>Foot<select value={foot} onChange={e => setFoot(e.target.value)}><option value="">Either</option><option>Right</option><option>Left</option></select></label>
      <label>Min skills<select value={minSkill} onChange={e => setMinSkill(e.target.value)}><option value="">Any</option>{[1,2,3,4,5].map(n => <option key={n} value={n}>{n}★</option>)}</select></label>
      <label>Min weak foot<select value={minWeak} onChange={e => setMinWeak(e.target.value)}><option value="">Any</option>{[1,2,3,4,5].map(n => <option key={n} value={n}>{n}★</option>)}</select></label>
      <label><input type="checkbox" checked={fit} onChange={e => setFit(e.target.checked)} /> Fit players only</label><label><input type="checkbox" checked={notLoan} onChange={e => setNotLoan(e.target.checked)} /> Exclude loan records</label>
      <button className="btn" onClick={() => { setQ(''); setG('all'); setPos(''); setOvr([40,99]); setPot([40,99]); setLg(-2); setRole('all'); setContract(''); setFoot(''); setMinGrowth(''); setMinSkill(''); setMinWeak(''); setFit(false); setNotLoan(false); setIncludeSecondary(false); setSlotOverride(0); setMinAhead(0) }}>Reset filters</button>
    </div><p className="note">Primary positions only by default. Slot counts come from the club's saved XI; if none is recorded, pick a slot count. Equal OVR does not count as "ahead".</p></details>
    {!sorted.length && <p className="sub">No players match these filters.</p>}
    <Table className="tbl"><thead><tr><th>Star</th><Th id="name" label="Player" /><th>Pos</th><Th id="age" label="Age" num /><th>Nation</th><Th id="team" label="Club" /><th>Archetype</th><Th id="ovr" label="OVR" num /><Th id="pot" label="POT" num /><Th id="value" label="Value" num /><Th id="contractUntil" label="Contract" num />{showDepth && <><th>Starting opportunity</th><th>Players ahead at this position</th></>}</tr></thead><tbody>
      {sorted.slice(page * per, page * per + per).map(p => <tr key={p.id} className="click" onClick={() => pick(p)}>
        <td><StarButton p={p} /></td><td className="name"><span className={p.known ? '' : 'unk'}>{p.name}</span>{p.onLoanFrom && <span className="tag loan">Loan record</span>}</td><td><Pos p={p.pos} />{p.positions.length > 1 && <span className="dim" style={{ color: 'var(--ink-3)', marginLeft: 6, fontSize: 12 }}>{p.positions.slice(1).join(' ')}</span>}</td>
        <td className="num">{p.age}</td><td>{p.nation}</td><td>{p.teamId >= 0 ? <a href="#" className="with-crest" onClick={e => { e.preventDefault(); e.stopPropagation(); openClub(p.teamId) }}>{world.teamById.get(p.teamId) && <Logo team={world.teamById.get(p.teamId)!} size={18} />}{p.team}</a> : <span className="dim">Free agent</span>}</td><td className="arch-cell">{p.archetype.label}</td>
        <td className="num"><Rating v={p.ovr} /></td><td className="num"><Rating v={p.pot} /></td><td className="num">{fmtMoney(p.value)}</td><td className="num">{p.contractUntil || '–'}</td>{showDepth && <><td className="hierarchy-cell">{(() => { const h = opportunities.get(p.id)!; return <><b>{h.status}</b><small>{h.rank !== null ? `#${h.rank} · ${pos || p.pos} · ${h.slots ?? '?'} starting slot${h.slots === 1 ? '' : 's'}` : 'Unassigned'}<br />{h.source}</small></> })()}</td><td className="competition-cell">{(() => { const h = opportunities.get(p.id)!; return h.ahead.length ? <>{h.ahead.map(a => <button key={a.id} className="text-btn" onClick={e => { e.stopPropagation(); pick(a) }}>{a.name} · {a.ovr}<small>{a.pos}{a.pos !== (pos || p.pos) ? ' · secondary option' : ' · primary'}{inSavedXI(a) ? ` · saved: ${a.squadPos}` : ''}</small></button>)}</> : h.rank !== null ? <span className="dim">No higher-rated peers</span> : '—' })()}</td></>}
      </tr>)}
    </tbody></Table>
    {pages > 1 && <div className="pager"><button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1} of {pages}</span><button disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button></div>}
  </>
}

function PlayerModal({ p, world, close, openClub, gameId, refresh }: { gameId: string; refresh: number; p: Player; world: World; close: () => void; openClub: (id: number) => void }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && close(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [close])
  const gk = p.pos === 'GK'
  const face = gk ? p.gk : p.face
  const groups = ATTR_GROUPS.filter(([n]) => gk ? n !== 'Defending' : n !== 'Goalkeeping')
  return <div className="overlay" onClick={close}><div className="modal" onClick={e => e.stopPropagation()}>
    <button className="x" onClick={close} aria-label="Close">✕</button>
    <div className="top">
      <div className={'card' + (p.ovr >= 85 ? ' gold' : '')}><div className="o">{p.ovr}</div><div className="p">{p.pos}</div><div className="pot">Potential {p.pot}</div></div>
      <div>
        <h1 className={p.known ? '' : 'unk'}><StarButton p={p} />{p.name}</h1>
        <div className="meta" style={{ color: 'var(--ink-2)' }}>{p.teamId >= 0 ? <a href="#" className="with-crest" onClick={e => { e.preventDefault(); openClub(p.teamId) }}>{world.teamById.get(p.teamId) && <Logo team={world.teamById.get(p.teamId)!} size={18} />}{p.team}</a> : 'Free agent'} · {p.league} · {p.nation}{p.nationalTeam ? ` (${p.nationalTeam} squad)` : ''} · {p.gender ? 'Women' : 'Men'}{p.fullName !== p.name ? ` · full name: ${p.fullName}` : ''}{p.onLoanFrom && ` · loan record: ${p.onLoanFrom}, recorded end ${p.loanEnd}`}</div>
        <div className="facts">
          <div><span>Age</span><b>{p.age} · {p.birth}</b></div><div><span>Positions</span><b>{p.positions.join(', ')}</b></div><div><span>Squad role</span><b>{p.squadPos}{p.jersey ? ` · #${p.jersey}` : ''}</b></div>
          <div><span>Estimated value</span><b>{fmtMoney(p.value)}</b></div><div><span>Wage</span><b>{p.wage != null ? fmtMoney(p.wage) + ' / wk' : 'Not in save'}</b></div><div><span>Contract until</span><b>{p.contractUntil || '–'}</b></div>
          <div><span>Foot · skill · weak foot</span><b>{p.foot} · {p.skill}★ · {p.weak}★</b></div><div><span>Height · weight</span><b>{p.height} cm · {p.weight} kg</b></div><div><span>League goals</span><b>{p.leagueGoals}{p.injury > 0 ? ' · currently injured' : ''}</b></div>
        </div>
      </div>
    </div>

    <div className="face">{Object.entries(face).map(([k, v]) => <div key={k}><b>{v}</b><span>{k}</span></div>)}</div>
    <div className="arch">
      <div className="arch-main"><span className="arch-kicker">Archetype · {GROUP_LABEL[p.archetype.group]}</span><b>{p.archetype.label}</b><p>{archetypeBlurb(p.archetype.id)}</p>
        {p.archetype.tags.length > 0 && <div className="tags">{p.archetype.tags.map(t => <span key={t} className="tag style">{t}</span>)}</div>}</div>
      <div className="arch-scores"><span className="arch-kicker">Profile fit {p.archetype.fit}%</span>{p.archetype.scores.map(sc => <div className="arow" key={sc.id}><div>{sc.name}<div className="bar-bg"><div className="bar-fg" style={{ width: `${sc.score}%`, background: sc.id === p.archetype.id ? 'var(--gold)' : 'var(--green)' }} /></div></div><b>{sc.score}</b></div>)}</div>
    </div>
    <div className="attrs">{groups.map(([name, keys]) => <div key={name}><h3>{name}</h3>{keys.map(k => <div className="arow" key={k}><div>{ATTR_LABEL[k]}<div className="bar-bg"><div className="bar-fg" style={{ width: `${p.attrs[k]}%`, background: p.attrs[k] >= 80 ? 'var(--gold)' : p.attrs[k] >= 65 ? 'var(--green)' : '#8d948f' }} /></div></div><b>{p.attrs[k]}</b></div>)}</div>)}</div>
    <Timeline id={p.id} gameId={gameId} refresh={refresh} />
    {!p.known && <p className="sub" style={{ marginTop: 16 }}>This player's name ID isn't in the bundled name pool. Player ID {p.id}{world.career.club ? '' : ''}.</p>}
  </div></div>
}

function HistoryPosition({season,team,league,recorded,currentSeason,history,game,onSave}: {season:number;team:number;league:number;recorded:number;currentSeason:number;history:HistoryFinish[];game:Game|null;onSave:(key:string,position:number|null)=>Promise<void>}) {
  const key=historyKey(season,team,league), manual=game?.historyPositions?.[key], recovered=recorded>0?null:recoverFinish(history,season,team,league)
  const [editing,setEditing]=useState(false), [value,setValue]=useState(''), [busy,setBusy]=useState(false),[error,setError]=useState('')
  const position=manual??(recorded>0?recorded:recovered)
  async function save(position:number|null){setBusy(true);setError('');try{await onSave(key,position);setEditing(false)}catch(e){setError(String(e))}finally{setBusy(false)}}
  return <div className="history-position"><b>{position??(season>=currentSeason?'In progress':'Not recorded')}</b>{manual!=null?<small>User-entered</small>:recovered!=null&&recorded<=0?<small>Recorded in another save</small>:null}
  {game && (editing?<div><input aria-label={`Finish for season ${season} club ${team}`} type="number" min="1" max="100" value={value} onChange={e=>setValue(e.target.value)} /><button className="btn" disabled={busy||!value} onClick={()=>save(Number(value))}>Save finish</button><button className="btn" disabled={busy} onClick={()=>setEditing(false)}>Cancel</button>{manual!=null&&<button className="btn" disabled={busy} onClick={()=>save(null)}>Use recorded result</button>}</div>:<button className="btn" onClick={()=>{setValue(position==null?'':String(position));setEditing(true)}}>{position==null?'Set known finish':'Edit finish'}</button>)}{error&&<small role="alert">{error}</small>}</div>
}
