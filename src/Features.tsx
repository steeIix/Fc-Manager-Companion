import { useEffect, useMemo, useState } from 'react'
import { fmtDate, fmtMoney, type Player, type World } from './model'
import { allSnapshots, exportGame, getSavedFile, importGame, listGames, listSnapshots, saveGame, type Game, type Snapshot, type SnapMeta } from './snapshots'
import { assignXI, FORMATIONS, rankedOptions } from './planning'
const D = (ms: number) => fmtDate(new Date(ms))

export function Games({ active, onSelect, onLoad, refresh }: { active: Game | null; onSelect: (g: Game) => void; onLoad: (f: File, id: string, g: Game) => Promise<void>; refresh: number }) {
  const [rename, setRename] = useState('')
  useEffect(() => setRename(active?.name ?? ''), [active?.id, active?.name])
  const [games, setGames] = useState<Game[]>([]), [name, setName] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const [snaps, setSnaps] = useState<SnapMeta[]>([])
  useEffect(() => { listGames().then(setGames).catch(e => setErr(String(e))) }, [active, refresh])
  useEffect(() => { let live = true; setSnaps([]); if (active) listSnapshots(active.id).then(s => { if (live) setSnaps(s) }).catch(e => setErr(String(e))); return () => { live = false } }, [active, refresh])
  async function run(fn: () => Promise<void>) { setErr(''); setBusy(true); try { await fn() } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) } }
  return <section className="games-panel"><h1>Games &amp; saves</h1><p className="sub">One game is one career. It contains multiple saves, snapshots and a transfer shortlist. Select the correct game before adding a save.</p>
    <div className="bar"><select aria-label="Active game" disabled={busy} value={active?.id ?? ''} onChange={e => { const g = games.find(x => x.id === e.target.value); if (g) onSelect(g) }}><option value="" disabled>Select a game</option>{games.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
      <input aria-label="New game name" placeholder="New game name" value={name} onChange={e => setName(e.target.value)} />
      <button className="btn" disabled={busy || !name.trim()} onClick={() => run(async () => { const g = { id: crypto.randomUUID(), name: name.trim(), createdAt: Date.now(), shortlist: [] }; await saveGame(g); onSelect(g); setName('') })}>Create game</button>
      <label className="btn">Import game<input disabled={busy} type="file" accept=".json,.fc26game" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) run(async () => onSelect(await importGame(await f.text()))) }} /></label>
      {active && <button className="btn" disabled={busy} onClick={() => run(async () => { const json = await exportGame(active); const url = URL.createObjectURL(new Blob([json], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = `${active.name.replace(/[^a-z0-9_-]/gi, '_')}.fc26game.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) })}>Export entire game</button>}
    </div>
    {active && <div className="bar"><input aria-label="Rename active game" value={rename} onChange={e => setRename(e.target.value)} /><button className="btn" disabled={busy || !rename.trim()} onClick={() => run(async () => { const renamed = { ...active, name: rename.trim() }; await saveGame(renamed); onSelect(renamed); setGames(await listGames()) })}>Save game name</button><span className="dim">{snaps.length} snapshots · {active.shortlist.length} targets</span></div>}
    {busy && <p role="status">Working…</p>}{err && <p className="err" role="alert">{err}</p>}
    {active && <><h2>Saved files in {active.name}</h2>{!snaps.length ? <p className="sub">No saves yet. Open an FC 26 career save below to add the first one.</p> : <table className="tbl"><thead><tr><th>Snapshot</th><th>In-game date</th><th>Club</th><th>Open</th></tr></thead><tbody>{snaps.map(s => <tr key={s.id}><td>{s.label || s.fileName}</td><td>{D(s.asOf)}</td><td>{s.club}</td><td><button className="btn" disabled={busy} onClick={() => run(async () => { const f = await getSavedFile(s.id); if (!f) throw new Error('This older snapshot has no saved file attached. Re-open the original FC save to enable full browsing. Its comparison data is still available.'); await onLoad(new File([f.data], f.name), s.id, active) })}>Load save</button></td></tr>)}</tbody></table>}</>}
    <p className="note">Exports include original FC save files, snapshot history and shortlist. Import creates a separate game, preserving existing games. Older snapshots from v2 contain comparison data only.</p>
  </section>
}

export function Timeline({ id, gameId, refresh = 0 }: { id: number; gameId: string; refresh?: number }) {
  const [snaps, setSnaps] = useState<Snapshot[]>([]), [err, setErr] = useState(''), [metric, setMetric] = useState<'ovr' | 'pot' | 'v'>('ovr'), [loading, setLoading] = useState(true)
  useEffect(() => { let live = true; setLoading(true); setSnaps([]); setErr(''); allSnapshots(gameId).then(s => { if (live) setSnaps(s) }).catch(e => { if (live) setErr(String(e)) }).finally(() => { if (live) setLoading(false) }); return () => { live = false } }, [gameId, refresh])
  const data = useMemo(() => snaps.map(s => ({ s, p: s.players.find(p => p.id === id) })), [snaps, id])
  const values = data.flatMap(d => d.p ? [d.p[metric]] : []), min = values.length ? Math.min(...values) : 0, max = values.length ? Math.max(...values) : 1
  const lo = metric === 'v' ? Math.max(0, min * .9) : Math.max(0, min - 2), hi = metric === 'v' ? Math.max(max * 1.1, lo + 1) : Math.min(100, max + 2)
  const x = (i: number) => 70 + i * 620 / Math.max(data.length - 1, 1), y = (v: number) => 185 - (v - lo) / Math.max(hi - lo, 1) * 155
  const show = (v: number) => metric === 'v' ? fmtMoney(v) : String(Math.round(v * 10) / 10)
  return <section className="timeline"><h2>Player timeline{[...data].reverse().find(d => d.p)?.p?.n ? ` · ${[...data].reverse().find(d => d.p)!.p!.n}` : ''}</h2><p className="sub">Every snapshot in this game, ordered by in-game date. Hover a point for club and ratings. Missing observations break the line.</p>
    <div className="seg">{(['ovr','pot','v'] as const).map(k => <button key={k} className={metric === k ? 'on' : ''} onClick={() => setMetric(k)}>{k === 'v' ? 'Estimated value' : k.toUpperCase()}</button>)}</div>
    {err ? <p className="err">{err}</p> : loading ? <p>Loading timeline…</p> : !values.length ? <p className="sub">No recorded appearances for this player.</p> : <><svg className="timeline-chart" viewBox="0 0 760 230" role="img" aria-label={`${metric === 'v' ? 'Estimated value' : metric.toUpperCase()} across ${data.length} snapshots; exact observations in table below`}>
      {[0,.5,1].map(t => <g key={t}><line x1="70" x2="710" y1={30 + t * 155} y2={30 + t * 155} stroke="currentColor" opacity=".15" /><text x="62" y={35 + t * 155} textAnchor="end">{show(hi - t * (hi-lo))}</text></g>)}
      {data.map((d,i) => d.p ? <g key={d.s.id}>{i > 0 && data[i-1].p && <line x1={x(i-1)} y1={y(data[i-1].p![metric])} x2={x(i)} y2={y(d.p[metric])} stroke="var(--gold)" strokeWidth="3" />}<circle tabIndex={0} cx={x(i)} cy={y(d.p[metric])} r="5" fill="var(--gold)"><title>{d.s.label || d.s.fileName} · {D(d.s.asOf)} · {d.p.team} · OVR {d.p.ovr} · POT {d.p.pot} · {fmtMoney(d.p.v)}</title></circle></g> : null)}
      <text x="70" y="213">{D(data[0].s.asOf)}</text><text x="710" y="213" textAnchor="end">{data.length > 1 ? D(data[data.length-1].s.asOf) : 'One observation'}</text>
    </svg><div className="table-scroll"><table className="tbl"><thead><tr><th>Snapshot / date</th><th>OVR</th><th>POT</th><th>Value</th><th>Club</th></tr></thead><tbody>{data.map(({s,p}) => <tr key={s.id}><td>{s.label || s.fileName}<br/><small>{D(s.asOf)}</small></td><td>{p?.ovr ?? '—'}</td><td>{p?.pot ?? '—'}</td><td>{p ? fmtMoney(p.v) : '—'}</td><td>{p?.team ?? 'Not present in snapshot'}</td></tr>)}</tbody></table></div></>}
  </section>
}

export function Youth({ world, pick }: { world: World; pick: (p: Player) => void }) {
  return <><h2>Youth academy</h2><p className="sub">{world.youth.length} academy records. Potential variance and low-potential swing are shown as recorded; the save reader cannot yet reconstruct the displayed potential range or link each player to a scout.</p>
    {!world.youth.length ? <p>No youth players recorded in this save.</p> : <table className="tbl"><thead><tr><th>Player</th><th>Position</th><th>Age</th><th>OVR</th><th>POT</th><th>Potential variance</th><th>Low swing</th><th>Months in academy</th><th>Tier</th></tr></thead><tbody>{world.youth.map((y,i) => <tr key={`${y.id}-${i}`}><td>{y.player ? <button className="text-btn" onClick={() => pick(y.player!)}>{y.name}</button> : y.name}</td><td>{y.player?.positions.join(' / ') ?? 'Unknown'}</td><td>{y.player?.age ?? '—'}</td><td>{y.player?.ovr ?? '—'}</td><td>{y.player?.pot ?? '—'}</td><td>{y.variance ?? '—'}</td><td>{y.swing ?? '—'}</td><td>{y.months ?? '—'}</td><td>{y.tier ?? '—'}</td></tr>)}</tbody></table>}
    <h2>Scouts</h2>{!world.scouts.length ? <p>No scout records in this save.</p> : <table className="tbl"><thead><tr><th>Scout</th><th>Experience</th><th>Knowledge</th><th>Region ID</th><th>State code</th></tr></thead><tbody>{world.scouts.map((s,i) => <tr key={i}><td>{[s.firstname,s.lastname].filter(Boolean).join(' ') || `Scout ${s.scoutid ?? i+1}`}</td><td>{s.experience ?? '—'}</td><td>{s.knowledge ?? '—'}</td><td>{s.regionid ?? '—'}</td><td>{s.state ?? '—'}</td></tr>)}</tbody></table>}
  </>
}

export function Planner({ world, pick }: { world: World; pick: (p: Player) => void }) {
  const [formation, setFormation] = useState('4-3-3'), [fitOnly, setFitOnly] = useState(false)
  const squad = world.career.club?.players ?? [], rows = FORMATIONS[formation], positions = rows.flat()
  const available = squad.filter(p => !fitOnly || !p.injury)
  const xi = assignXI(available, positions), starters = new Set(xi.flatMap(p => p ? [p.id] : []))
  const backups = available.filter(p => !starters.has(p.id)), reserveXI = assignXI(backups, positions)
  const year = world.career.asOf.getUTCFullYear()
  const warnings = positions.flatMap((pos, i) => {
    const starter = xi[i], cover = rankedOptions(backups, pos)
    return [...(!starter ? [`${pos} ${i+1}: no starter`] : []), ...(!cover.length ? [`${pos} ${i+1}: no cover outside the XI`] : !reserveXI[i] ? [`${pos} ${i+1}: cover shared with another slot`] : []), ...(starter && starter.age >= 30 && !available.some(p => p.id !== starter.id && p.age < 24 && p.positions.includes(pos)) ? [`${pos}: ${starter.name} is ${starter.age}; no successor under 24`] : [])]
  })
  const expiring = squad.filter(p => p.contractUntil > 0 && p.contractUntil <= year)
  let index = 0
  return <><h2>Squad planning &amp; depth</h2><div className="bar"><select aria-label="Formation" value={formation} onChange={e => setFormation(e.target.value)}>{Object.keys(FORMATIONS).map(f => <option key={f}>{f}</option>)}</select><label><input type="checkbox" checked={fitOnly} onChange={e => setFitOnly(e.target.checked)} /> Exclude injured players</label></div>
    <p className="sub">Suggested XI fills as many natural/secondary positions as possible, then maximizes total OVR. Each player starts once. Depth ranks use OVR; shared cover is marked. Successor means any eligible player under 24.</p>
    <div className="planning-layout"><div className="pitch">{rows.map((row,r) => <div className="pitch-row" key={r}>{row.map(pos => { const i = index++, p = xi[i]; return <div className="pitch-slot" key={i}><span>{pos}</span>{p ? <button onClick={() => pick(p)}><b>{p.name}</b><small>{p.ovr} OVR · {p.age} yrs{p.injury > 0 ? ' · injured' : ''}</small></button> : <strong>Vacant</strong>}</div> })}</div>)}</div>
    <aside className="needs"><h3>Where to act</h3>{warnings.length ? <ul>{warnings.map((w,i) => <li key={i}>{w}</li>)}</ul> : <p>Every slot has separate cover and a young option for ageing starters.</p>}<h3>Contracts ending by {year}</h3>{expiring.length ? expiring.map(p => <p key={p.id}><button className="text-btn" onClick={() => pick(p)}>{p.name}</button> · {p.contractUntil}</p>) : <p>None recorded.</p>}</aside></div>
    <div className="depth-grid">{[...new Set(positions)].map(pos => { const opts = rankedOptions(available,pos), needed = positions.filter(p => p === pos).length; return <section className="depth-card" key={pos}><h3>{pos} <small>{needed} starting slot{needed > 1 ? 's' : ''} · {opts.length} options</small></h3>{!opts.length ? <p className="warning">Recruit a {pos}</p> : <ol>{opts.map(p => <li key={p.id}><button className="text-btn" onClick={() => pick(p)}>{p.name}</button> <b>{p.ovr}</b><small>{p.pot} POT · {p.age} yrs · {starters.has(p.id) ? `XI: ${positions[xi.findIndex(x => x?.id === p.id)]}` : 'Cover'}{p.positions.filter(x => positions.includes(x)).length > 1 ? ' · multi-position' : ''}{p.contractUntil > 0 && p.contractUntil <= year ? ' · contract ending' : ''}{p.injury > 0 ? ' · injured' : ''}</small></li>)}</ol>}</section> })}</div>
  </>
}

export function Shortlist({ game, world, pick, toggle, refresh }: { game: Game; world: World; pick: (p: Player) => void; toggle: (id: number) => void; refresh: number }) {
  const [snaps, setSnaps] = useState<Snapshot[]>([]), [selected, setSelected] = useState<number | null>(null), [err, setErr] = useState('')
  useEffect(() => { let live = true; allSnapshots(game.id).then(s => { if (live) setSnaps(s) }).catch(e => setErr(String(e))); return () => { live = false } }, [game.id, refresh])
  return <><h1>Transfer shortlist</h1><p className="sub">Star players in search or their profile. Changes compare the first and latest snapshot where the player appears; the open save may be older.</p>{err && <p className="err">{err}</p>}{!game.shortlist.length ? <p>No targets yet. Star a player in Player search.</p> : <table className="tbl"><thead><tr><th>Star</th><th>Player</th><th>OVR</th><th>POT</th><th>Club change</th><th>Observed dates</th><th>Details</th></tr></thead><tbody>{game.shortlist.map(id => { const observations = snaps.flatMap(s => { const p = s.players.find(p => p.id === id); return p ? [{ p, s }] : [] }), first = observations[0], last = observations[observations.length-1], p = world.playerById.get(id); return <tr key={id}><td><button className="star-btn" aria-label={`Remove ${p?.name || last?.p.n || id} from shortlist`} onClick={() => toggle(id)}>★</button></td><td><button className="text-btn" onClick={() => setSelected(id)}>{p?.name || last?.p.n || `Player #${id}`}</button>{!p && <small>Not in open save</small>}</td><td>{last ? `${first.p.ovr} → ${last.p.ovr}` : '—'}</td><td>{last ? `${first.p.pot} → ${last.p.pot}` : '—'}</td><td>{last ? first.p.t === last.p.t ? last.p.team : `${first.p.team} → ${last.p.team}` : '—'}</td><td>{last ? `${D(first.s.asOf)} → ${D(last.s.asOf)}` : '—'}</td><td><button className="btn" onClick={() => setSelected(id)}>Timeline</button>{p && <button className="btn" onClick={() => pick(p)}>Profile</button>}</td></tr> })}</tbody></table>}{selected !== null && <Timeline id={selected} gameId={game.id} refresh={refresh} />}</>
}
