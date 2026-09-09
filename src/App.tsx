import { useEffect, useMemo, useRef, useState } from 'react'
import { parseSave, isCareerSave, type Meta } from './parser'
import { Snapshots } from './Snapshots'
import { fromWorld, saveSnapshot } from './snapshots'
import { buildWorld, fmtMoney, fmtDate, posGroup, POS_ORDER, ATTR_GROUPS, ATTR_LABEL, type World, type Player, type Team, type League, type Names, type ValueModel } from './model'

type View = { kind: 'snapshots' } | { kind: 'leagues' } | { kind: 'league'; id: number } | { kind: 'club'; id: number } | { kind: 'players' } | { kind: 'my' }

const Rating = ({ v }: { v: number }) => <span className={'rt ' + (v >= 85 ? 'r5' : v >= 78 ? 'r4' : v >= 70 ? 'r3' : v >= 60 ? 'r2' : 'r1')}>{v}</span>
const Pos = ({ p }: { p: string }) => <span className={'pos ' + posGroup(p).toLowerCase()}>{p}</span>
const Stars = ({ n }: { n: number }) => <span className="stars" title={`${n} stars`}>{'★'.repeat(Math.floor(n))}{n % 1 ? '½' : ''}</span>

export default function App() {
  const [world, setWorld] = useState<World | null>(null)
  const [fileName, setFileName] = useState('')
  const [view, setView] = useState<View>({ kind: 'leagues' })
  const [sel, setSel] = useState<Player | null>(null)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [snapId, setSnapId] = useState<string>()
  const [snapTick, setSnapTick] = useState(0)
  const assets = useRef<{ meta: Meta; names: Names; nations: Record<string, string>; vm: ValueModel } | null>(null)

  async function load(file: File) {
    setErr(''); setBusy('Reading save…')
    try {
      if (!assets.current) {
        setBusy('Loading name database…')
        const [meta, names, nations, vm] = await Promise.all(['meta', 'names', 'nations', 'valuemodel'].map(n => fetch(`/data/${n}.json`).then(r => r.json())))
        assets.current = { meta, names, nations, vm }
      }
      const buf = await file.arrayBuffer()
      if (!isCareerSave(buf)) throw new Error('This file is not an FC 26 career save. Pick a file that starts with "CmMgr" from your settings folder.')
      setBusy('Decoding databases…')
      await new Promise(r => setTimeout(r, 20))
      const tables = parseSave(buf, assets.current.meta)
      if (!tables.players?.length) throw new Error('No player table was found in this save.')
      const w = buildWorld(tables, assets.current.names, assets.current.nations, assets.current.vm)
      setWorld(w); setFileName(file.name); setView(w.career.club ? { kind: 'my' } : { kind: 'leagues' })
      try { const s = fromWorld(w, file.name); await saveSnapshot(s); setSnapId(s.id); setSnapTick(x => x + 1) } catch (e) { console.warn('Snapshot not stored', e) }
    } catch (e: any) { setErr(e.message || String(e)) }
    setBusy('')
  }

  if (!world) return <DropScreen onFile={load} busy={busy} err={err} />

  const c = world.career
  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">FC26 Manager Companion<small>{fileName}</small></div>
        {c.club && <div className="club-chip"><b>{c.club.name}</b>{c.manager} · Season {c.season}<br />As of {fmtDate(c.asOf)}</div>}
        <nav>
          {c.club && <button className={view.kind === 'my' ? 'on' : ''} onClick={() => setView({ kind: 'my' })}>My club</button>}
          <button className={view.kind === 'leagues' || view.kind === 'league' ? 'on' : ''} onClick={() => setView({ kind: 'leagues' })}>Leagues &amp; clubs</button>
          <button className={view.kind === 'players' ? 'on' : ''} onClick={() => setView({ kind: 'players' })}>Player search</button>
          <button className={view.kind === 'snapshots' ? 'on' : ''} onClick={() => setView({ kind: 'snapshots' })}>Snapshots &amp; compare</button>
        </nav>
        <div className="foot">{world.players.length.toLocaleString()} players · {world.teams.length} clubs · {world.leagues.length} leagues<br />Values are estimates from the game's rating curve; wages are shown only where the save holds a contract.<button onClick={() => { setWorld(null); setView({ kind: 'leagues' }) }}>Open another save</button></div>
      </aside>
      <main className="main">
        {view.kind === 'leagues' && <Leagues world={world} open={id => setView({ kind: 'league', id })} />}
        {view.kind === 'league' && <LeagueView league={world.leagues.find(l => l.id === view.id)!} back={() => setView({ kind: 'leagues' })} open={id => setView({ kind: 'club', id })} userClub={c.clubId} />}
        {view.kind === 'club' && <ClubView team={world.teamById.get(view.id)!} world={world} back={() => setView({ kind: 'league', id: world.teamById.get(view.id)!.leagueId })} pick={setSel} />}
        {view.kind === 'players' && <Search world={world} pick={setSel} openClub={id => setView({ kind: 'club', id })} />}
        {view.kind === 'snapshots' && <Snapshots currentId={snapId} refresh={snapTick} />}
        {view.kind === 'my' && c.club && <MyClub world={world} open={() => setView({ kind: 'club', id: c.club!.id })} pick={setSel} />}
      </main>
      {sel && <PlayerModal p={sel} world={world} close={() => setSel(null)} openClub={id => { setSel(null); setView({ kind: 'club', id }) }} />}
    </div>
  )
}

function DropScreen({ onFile, busy, err }: { onFile: (f: File) => void; busy: string; err: string }) {
  const [over, setOver] = useState(false)
  return (
    <div className="main"><div className="drop">
      <h1>FC26 Manager Companion</h1>
      <p className="sub">Open a career save and browse every league, club roster and player in your world — ratings, potential, positions, values and contracts — without launching the game.</p>
      <div className={'zone' + (over ? ' over' : '')} onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f) }}>
        <strong>Drop your career save here</strong>
        <div>Files are named <span className="path">CmMgrC…</span> or <span className="path">CmMgrP…</span> and live in <span className="path">%LOCALAPPDATA%\EA SPORTS FC 26\settings</span></div>
        <label>Choose a file<input type="file" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} /></label>
        {busy && <div className="progress">{busy}</div>}
      </div>
      {err && <div className="err">{err}</div>}
      <p className="note">Everything is decoded in your browser; the save never leaves your machine. Each save you open is stored as a snapshot in this browser, so you can open later saves from the same career and compare how players and squads changed. Player names are stored in the game's own name table rather than the save, so they are reconstructed from public FC 26 datasets — around 95% resolve, and the rest show as "Unknown" with their ID.</p>
    </div></div>
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

function LeagueView({ league, back, open, userClub }: { league: League; back: () => void; open: (id: number) => void; userClub: number }) {
  const hasTable = league.teams.some(t => t.played > 0)
  const { sorted, Th } = useSort(league.teams, hasTable ? 'pos' : 'ovr', (t, k) => k === 'pos' ? -(t.tablePos || 99) : k === 'name' ? t.name : (t as any)[k], true)
  return <>
    <div className="crumb"><button onClick={back}>Leagues</button><span>/</span><span>{league.name}</span></div>
    <h1>{league.name}</h1>
    <p className="sub">{league.teams.length} clubs · average rating {league.avgOvr}{league.women ? ' · women\'s competition' : ''}</p>
    <table className="tbl"><thead><tr>
      {hasTable && <Th id="pos" label="#" num />}<Th id="name" label="Club" /><Th id="ovr" label="OVR" num /><Th id="att" label="ATT" num /><Th id="mid" label="MID" num /><Th id="def" label="DEF" num /><th>Stars</th><Th id="squadValue" label="Squad value" num /><Th id="worth" label="Club worth" num /><Th id="squadSize" label="Squad" num /><Th id="avgAge" label="Avg age" num />
      {hasTable && <><Th id="played" label="P" num /><Th id="points" label="Pts" num /></>}
    </tr></thead><tbody>
      {sorted.map(t => <tr key={t.id} className={'click' + (t.id === userClub ? ' user' : '')} onClick={() => open(t.id)}>
        {hasTable && <td className="num dim">{t.tablePos || '–'}</td>}
        <td className="name">{t.name}</td><td className="num"><Rating v={t.ovr} /></td><td className="num">{t.att}</td><td className="num">{t.mid}</td><td className="num">{t.def}</td>
        <td><Stars n={t.stars} /></td><td className="num">{fmtMoney(t.squadValue)}</td><td className="num">{t.worth ? fmtMoney(t.worth) : '–'}</td><td className="num">{t.squadSize}</td><td className="num">{t.avgAge}</td>
        {hasTable && <><td className="num">{t.played}</td><td className="num"><b>{t.points}</b></td></>}
      </tr>)}
    </tbody></table>
  </>
}

function ClubHeader({ t, world }: { t: Team; world: World }) {
  return <div className="club-head">
    <div className="stripe">{t.colors.map((c, i) => <i key={i} style={{ background: c }} />)}</div>
    <div className="body">
      <div className="ovr">{t.ovr}<small>overall · <Stars n={t.stars} /></small></div>
      <div><h1>{t.name}</h1><div className="meta">{t.league}{t.played ? ` · ${ordinal(t.tablePos)} in table, ${t.points} pts from ${t.played}` : ' · season not started'}{t.founded ? ` · est. ${t.founded}` : ''}{t.capacity ? ` · ${t.capacity.toLocaleString()} seats` : ''}{t.id === world.career.clubId ? ' · your club' : ''}</div></div>
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
    <table className="tbl"><thead><tr><th className="num">#</th><th>Player</th><th>Pos</th><th>Also</th><th className="num">Age</th><th>Nation</th><th className="num">OVR</th><th className="num">POT</th><th className="num">Value</th>{wages && <th className="num">Wage / wk</th>}<th className="num">Contract</th><th className="num">Goals</th></tr></thead><tbody>
      {rows.map(p => {
        const g = mode === 'pos' ? posGroup(p.pos) : ''
        const head = g && g !== lastGrp ? <tr className="grp" key={'g' + g}><td colSpan={wages ? 12 : 11}>{{ GK: 'Goalkeepers', DEF: 'Defenders', MID: 'Midfielders', ATT: 'Forwards' }[g]}</td></tr> : null
        lastGrp = g
        return <>{head}<tr key={p.id} className="click" onClick={() => pick(p)}>
          <td className="num dim">{p.jersey || '–'}</td>
          <td className="name"><span className={p.known ? '' : 'unk'}>{p.name}</span>{p.id === world.teamById.get(p.teamId)?.captainId && <span className="tag">C</span>}{p.injury > 0 && <span className="tag inj">Injured</span>}{p.onLoanFrom && <span className="tag loan" title={`From ${p.onLoanFrom} until ${p.loanEnd}`}>Loan</span>}</td>
          <td><Pos p={p.pos} /></td><td className="dim">{p.positions.slice(1).join(' ')}</td><td className="num">{p.age}</td><td>{p.nation}</td>
          <td className="num"><Rating v={p.ovr} /></td><td className="num"><Rating v={p.pot} /></td><td className="num">{fmtMoney(p.value)}</td>
          {wages && <td className="num">{p.wage != null ? fmtMoney(p.wage) : '–'}</td>}
          <td className="num">{p.contractUntil || '–'}</td><td className="num dim">{p.leagueGoals}</td>
        </tr></>
      })}
    </tbody></table>
  </>
}

function ClubView({ team, world, back, pick }: { team: Team; world: World; back: () => void; pick: (p: Player) => void }) {
  return <>
    <div className="crumb"><button onClick={back}>{team.league}</button><span>/</span><span>{team.name}</span></div>
    <ClubHeader t={team} world={world} />
    <Roster players={team.players} world={world} pick={pick} wages={team.id === world.career.clubId} />
  </>
}

function MyClub({ world, open, pick }: { world: World; open: () => void; pick: (p: Player) => void }) {
  const c = world.career, t = c.club!
  const contracted = t.players.filter(p => p.wage != null)
  const wageBill = contracted.reduce((s, p) => s + (p.wage ?? 0), 0)
  const expiring = t.players.filter(p => p.contractUntil && p.contractUntil <= c.asOf.getUTCFullYear() + 1).sort((a, b) => b.ovr - a.ovr)
  const rising = t.players.filter(p => p.pot - p.ovr >= 5).sort((a, b) => b.pot - a.pot).slice(0, 8)
  return <>
    <ClubHeader t={t} world={world} />
    <div className="split">
      <div className="kpi"><b>{fmtMoney(wageBill)}</b><span>Weekly wage bill across {contracted.length} contracts</span></div>
      <div className="kpi"><b>{c.manager}</b><span>Manager · season {c.season} · {fmtMoney(c.wage)}/wk</span></div>
      <div className="kpi"><b>{expiring.length}</b><span>Contracts ending by {c.asOf.getUTCFullYear() + 1}</span></div>
    </div>
    {c.history.length > 0 && <>
      <h2>Season history</h2>
      <table className="tbl"><thead><tr><th className="num">Season</th><th className="num">Pos</th><th className="num">P</th><th className="num">W</th><th className="num">D</th><th className="num">L</th><th className="num">GF</th><th className="num">GA</th><th className="num">Pts</th><th>Biggest signing</th><th>Biggest sale</th><th className="num">Job security</th></tr></thead><tbody>
        {c.history.map(h => <tr key={String(h.season)}><td className="num">{h.season as number}</td><td className="num">{h.tableposition as number}</td><td className="num">{h.games_played as number}</td><td className="num">{h.wins as number}</td><td className="num">{h.draws as number}</td><td className="num">{h.losses as number}</td><td className="num">{h.goals_for as number}</td><td className="num">{h.goals_against as number}</td><td className="num"><b>{h.points as number}</b></td>
          <td>{h.bigbuyplayername ? `${h.bigbuyplayername} (${fmtMoney(h.bigbuyamount as number)})` : '–'}</td><td>{h.bigsellplayername ? `${h.bigsellplayername} (${fmtMoney(h.bigsellamount as number)})` : '–'}</td><td className="num">{h.jobsecurityscore as number}</td></tr>)}
      </tbody></table>
    </>}
    {rising.length > 0 && <>
      <h2>Room to grow</h2>
      <table className="tbl"><thead><tr><th>Player</th><th>Pos</th><th className="num">Age</th><th className="num">OVR</th><th className="num">POT</th><th className="num">Value</th></tr></thead><tbody>
        {rising.map(p => <tr key={p.id} className="click" onClick={() => pick(p)}><td className="name">{p.name}</td><td><Pos p={p.pos} /></td><td className="num">{p.age}</td><td className="num"><Rating v={p.ovr} /></td><td className="num"><Rating v={p.pot} /></td><td className="num">{fmtMoney(p.value)}</td></tr>)}
      </tbody></table>
    </>}
    <h2>Squad</h2>
    <Roster players={t.players} world={world} pick={pick} wages />
    <p className="sub" style={{ marginTop: 12 }}><button className="lg-card" style={{ padding: '8px 14px' }} onClick={open}>Open club page</button></p>
  </>
}

function Search({ world, pick, openClub }: { world: World; pick: (p: Player) => void; openClub: (id: number) => void }) {
  const [q, setQ] = useState(''); const [g, setG] = useState<'all' | 0 | 1>('all'); const [pos, setPos] = useState('')
  const [ovr, setOvr] = useState([40, 99]); const [pot, setPot] = useState([40, 99]); const [age, setAge] = useState([15, 45]); const [lg, setLg] = useState(-2); const [page, setPage] = useState(0)
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return world.players.filter(p => (g === 'all' || p.gender === g) && (!pos || p.positions.includes(pos)) && p.ovr >= ovr[0] && p.ovr <= ovr[1] && p.pot >= pot[0] && p.pot <= pot[1] && p.age >= age[0] && p.age <= age[1] && (lg === -2 || p.leagueId === lg) && (!s || p.name.toLowerCase().includes(s) || p.team.toLowerCase().includes(s) || p.nation.toLowerCase().includes(s)))
  }, [world, q, g, pos, ovr, pot, age, lg])
  const { sorted, Th } = useSort(rows, 'ovr', (p, k) => (p as any)[k])
  useEffect(() => setPage(0), [rows])
  const per = 100, pages = Math.ceil(sorted.length / per)
  const R = ({ v, set }: { v: number[]; set: (v: number[]) => void }) => <><input type="number" value={v[0]} onChange={e => set([+e.target.value, v[1]])} /><span>–</span><input type="number" value={v[1]} onChange={e => set([v[0], +e.target.value])} /></>
  return <>
    <h1>Player search</h1>
    <p className="sub">Every player in the save. Search by name, club or nation; narrow by rating, potential, position and age.</p>
    <div className="bar">
      <input type="text" placeholder="Name, club or nation" value={q} onChange={e => setQ(e.target.value)} />
      <div className="seg"><button className={g === 'all' ? 'on' : ''} onClick={() => setG('all')}>All</button><button className={g === 0 ? 'on' : ''} onClick={() => setG(0)}>Men</button><button className={g === 1 ? 'on' : ''} onClick={() => setG(1)}>Women</button></div>
      <select value={pos} onChange={e => setPos(e.target.value)}><option value="">Any position</option>{POS_ORDER.map(p => <option key={p}>{p}</option>)}</select>
      <select value={lg} onChange={e => setLg(+e.target.value)}><option value={-2}>Any league</option><option value={-1}>Free agents</option>{world.leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
    </div>
    <div className="bar">
      <span className="range">OVR <R v={ovr} set={setOvr} /></span><span className="range">POT <R v={pot} set={setPot} /></span><span className="range">Age <R v={age} set={setAge} /></span>
      <span className="count">{sorted.length.toLocaleString()} players</span>
    </div>
    <table className="tbl"><thead><tr><Th id="name" label="Player" /><th>Pos</th><Th id="age" label="Age" num /><th>Nation</th><Th id="team" label="Club" /><Th id="ovr" label="OVR" num /><Th id="pot" label="POT" num /><Th id="value" label="Value" num /><Th id="contractUntil" label="Contract" num /></tr></thead><tbody>
      {sorted.slice(page * per, page * per + per).map(p => <tr key={p.id} className="click" onClick={() => pick(p)}>
        <td className="name"><span className={p.known ? '' : 'unk'}>{p.name}</span>{p.onLoanFrom && <span className="tag loan">Loan</span>}</td><td><Pos p={p.pos} />{p.positions.length > 1 && <span className="dim" style={{ color: 'var(--ink-3)', marginLeft: 6, fontSize: 12 }}>{p.positions.slice(1).join(' ')}</span>}</td>
        <td className="num">{p.age}</td><td>{p.nation}</td><td>{p.teamId >= 0 ? <a href="#" onClick={e => { e.preventDefault(); e.stopPropagation(); openClub(p.teamId) }}>{p.team}</a> : <span className="dim">Free agent</span>}</td>
        <td className="num"><Rating v={p.ovr} /></td><td className="num"><Rating v={p.pot} /></td><td className="num">{fmtMoney(p.value)}</td><td className="num">{p.contractUntil || '–'}</td>
      </tr>)}
    </tbody></table>
    {pages > 1 && <div className="pager"><button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1} of {pages}</span><button disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button></div>}
  </>
}

function PlayerModal({ p, world, close, openClub }: { p: Player; world: World; close: () => void; openClub: (id: number) => void }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && close(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [close])
  const gk = p.pos === 'GK'
  const face = gk ? p.gk : p.face
  const groups = ATTR_GROUPS.filter(([n]) => gk ? n !== 'Defending' : n !== 'Goalkeeping')
  return <div className="overlay" onClick={close}><div className="modal" onClick={e => e.stopPropagation()}>
    <button className="x" onClick={close} aria-label="Close">✕</button>
    <div className="top">
      <div className={'card' + (p.ovr >= 85 ? ' gold' : '')}><div className="o">{p.ovr}</div><div className="p">{p.pos}</div><div className="pot">Potential {p.pot}</div></div>
      <div>
        <h1 className={p.known ? '' : 'unk'}>{p.name}</h1>
        <div className="meta" style={{ color: 'var(--ink-2)' }}>{p.teamId >= 0 ? <a href="#" onClick={e => { e.preventDefault(); openClub(p.teamId) }}>{p.team}</a> : 'Free agent'} · {p.league} · {p.nation}{p.nationalTeam ? ` (${p.nationalTeam} squad)` : ''} · {p.gender ? 'Women' : 'Men'}{p.onLoanFrom && ` · on loan from ${p.onLoanFrom} until ${p.loanEnd}`}</div>
        <div className="facts">
          <div><span>Age</span><b>{p.age} · {p.birth}</b></div><div><span>Positions</span><b>{p.positions.join(', ')}</b></div><div><span>Squad role</span><b>{p.squadPos}{p.jersey ? ` · #${p.jersey}` : ''}</b></div>
          <div><span>Estimated value</span><b>{fmtMoney(p.value)}</b></div><div><span>Wage</span><b>{p.wage != null ? fmtMoney(p.wage) + ' / wk' : 'Not in save'}</b></div><div><span>Contract until</span><b>{p.contractUntil || '–'}</b></div>
          <div><span>Foot · skill · weak foot</span><b>{p.foot} · {p.skill}★ · {p.weak}★</b></div><div><span>Height · weight</span><b>{p.height} cm · {p.weight} kg</b></div><div><span>League goals</span><b>{p.leagueGoals}{p.injury > 0 ? ' · currently injured' : ''}</b></div>
        </div>
      </div>
    </div>
    <div className="face">{Object.entries(face).map(([k, v]) => <div key={k}><b>{v}</b><span>{k}</span></div>)}</div>
    <div className="attrs">{groups.map(([name, keys]) => <div key={name}><h3>{name}</h3>{keys.map(k => <div className="arow" key={k}><div>{ATTR_LABEL[k]}<div className="bar-bg"><div className="bar-fg" style={{ width: `${p.attrs[k]}%`, background: p.attrs[k] >= 80 ? 'var(--gold)' : p.attrs[k] >= 65 ? 'var(--green)' : '#8d948f' }} /></div></div><b>{p.attrs[k]}</b></div>)}</div>)}</div>
    {!p.known && <p className="sub" style={{ marginTop: 16 }}>This player's name ID isn't in the bundled name pool. Player ID {p.id}{world.career.club ? '' : ''}.</p>}
  </div></div>
}
