import { Table } from './Table'
import { useEffect, useMemo, useState } from 'react'
import {  type Player, type World } from './model'
import { snapshotTitle, allSnapshots, exportGame, getSavedFile, importGame, listGames, listSnapshots, saveGame, type Game, type Snapshot, type SnapMeta } from './snapshots'
import { assignXI, FORMATIONS, rankedOptions } from './planning'

export function Games({ active, onSelect, onLoad, refresh }: { active: Game | null; onSelect: (g: Game) => void; onLoad: (f: File, id: string | undefined, g: Game) => Promise<void>; refresh: number }) {
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
      {active && <label className="btn primary">Import save<input disabled={busy} type="file" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) run(() => onLoad(f, undefined, active)) }} /></label>}
      <label className="btn">Import game<input disabled={busy} type="file" accept=".json,.fc26game" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) run(async () => onSelect(await importGame(await f.text()))) }} /></label>
      {active && <button className="btn" disabled={busy} onClick={() => run(async () => { const json = await exportGame(active); const url = URL.createObjectURL(new Blob([json], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = `${active.name.replace(/[^a-z0-9_-]/gi, '_')}.fc26game.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) })}>Export entire game</button>}
    </div>
    {active && <div className="bar"><input aria-label="Rename active game" value={rename} onChange={e => setRename(e.target.value)} /><button className="btn" disabled={busy || !rename.trim()} onClick={() => run(async () => { const renamed = { ...active, name: rename.trim() }; await saveGame(renamed); onSelect(renamed); setGames(await listGames()) })}>Save game name</button><span className="dim">{snaps.length} snapshots · {active.shortlist.length} targets</span></div>}
    {busy && <p role="status">Working…</p>}{err && <p className="err" role="alert">{err}</p>}
    {active && <><h2>Saved files in {active.name}</h2>{!snaps.length ? <p className="sub">No saves yet. Use Import save to add a CmMgr file from %LOCALAPPDATA%\EA SPORTS FC 26\settings.</p> : <Table className="tbl"><thead><tr><th>Snapshot</th><th>Career season</th><th>Club</th><th>Open</th></tr></thead><tbody>{snaps.map(s => <tr key={s.id}><td>{snapshotTitle(s)}<small className="date-source">{s.fileName}</small></td><td>Season {s.season}</td><td>{s.club}</td><td><button className="btn" disabled={busy} onClick={() => run(async () => { const f = await getSavedFile(s.id); if (!f) throw new Error('This older snapshot has no saved file attached. Re-open the original FC save to enable full browsing. Its comparison data is still available.'); await onLoad(new File([f.data], f.name), s.id, active) })}>Load save</button></td></tr>)}</tbody></Table>}</>}
    <p className="note">Exports include original FC save files, snapshot history and shortlist. Import creates a separate game, preserving existing games. Save numbers follow the order you added them. Original save files are kept, so you can reopen any of them later.</p>
  </section>
}

export function Timeline({ id, gameId, refresh = 0 }: { id: number; gameId: string; refresh?: number }) {
  const [snaps,setSnaps]=useState<Snapshot[]>([]),[err,setErr]=useState(''),[metric,setMetric]=useState<'ovr'|'pot'|'contract'>('ovr'),[loading,setLoading]=useState(true)
  useEffect(()=>{let live=true;setLoading(true);allSnapshots(gameId).then(s=>{if(live)setSnaps(s)}).catch(e=>{if(live)setErr(String(e))}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[gameId,refresh])
  const data=useMemo(()=>snaps.map(s=>({s,p:s.players.find(p=>p.id===id)})),[snaps,id])
  const values=data.flatMap(d=>typeof d.p?.[metric]==='number'?[d.p[metric] as number]:[])
  const lo=values.length?Math.min(...values)-1:0,hi=values.length?Math.max(...values)+1:1
  const x=(i:number)=>70+i*620/Math.max(data.length-1,1),y=(v:number)=>185-(v-lo)/(hi-lo)*155
  const name=[...data].reverse().find(d=>d.p)?.p?.n
  return <section className="timeline"><h2>Player timeline{name?` · ${name}`:''}</h2><p className="sub">Import order: Save 1 → Save 2 → Save 3. Only recorded ratings, contract end years and clubs are compared. Missing observations break the line.</p>
  <div className="seg">{(['ovr','pot','contract'] as const).map(k=><button key={k} className={metric===k?'on':''} onClick={()=>setMetric(k)}>{k==='contract'?'Contract end year':k.toUpperCase()}</button>)}</div>
  {err?<p className="err">{err}</p>:loading?<p>Loading timeline…</p>:!values.length?<p>No recorded values for this metric.</p>:<svg className="timeline-chart" viewBox="0 0 760 230" role="img" aria-label={`${metric} across saves in import order`}>
  {[0,.5,1].map(t=><g key={t}><line x1="70" x2="710" y1={30+t*155} y2={30+t*155} stroke="currentColor" opacity=".15"/><text x="62" y={35+t*155} textAnchor="end">{Math.round((hi-t*(hi-lo))*10)/10}</text></g>)}
  {data.map((d,i)=>{const value=d.p?.[metric],previous=i?data[i-1].p?.[metric]:null;return typeof value==='number'?<g key={d.s.id}>{typeof previous==='number'&&<line x1={x(i-1)} y1={y(previous)} x2={x(i)} y2={y(value)} stroke="var(--gold)" strokeWidth="3"/>}<circle tabIndex={0} cx={x(i)} cy={y(value)} r="5" fill="var(--gold)"><title>{snapshotTitle(d.s)} · {d.p!.team} · OVR {d.p!.ovr} · POT {d.p!.pot} · contract {d.p!.contract??'not recorded'}</title></circle></g>:null})}
  <text x="70" y="213">{data[0]?snapshotTitle(data[0].s):''}</text><text x="710" y="213" textAnchor="end">{data.length>1?snapshotTitle(data[data.length-1].s):'One observation'}</text></svg>}
  {!!data.length&&<div className="table-scroll"><Table className="tbl"><thead><tr><th>Save</th><th>Career season</th><th>OVR</th><th>POT</th><th>Contract end year</th><th>Club</th></tr></thead><tbody>{data.map(({s,p})=><tr key={s.id}><td>{snapshotTitle(s)}<small className="date-source">{s.fileName}</small></td><td>{s.season}</td><td>{p?.ovr??'—'}</td><td>{p?.pot??'—'}</td><td>{p?.contract??'—'}</td><td>{p?.team??'Not present in this save'}</td></tr>)}</tbody></Table></div>}
  </section>
}

export function Youth({ world, pick }: { world: World; pick: (p: Player) => void }) {
  return <><h2>Youth academy</h2><p className="sub">{world.youth.length} academy records. Potential variance and low-potential swing are shown as recorded; the save reader cannot yet reconstruct the displayed potential range or link each player to a scout.</p>
    {!world.youth.length ? <p>No youth players recorded in this save.</p> : <Table className="tbl"><thead><tr><th>Player</th><th>Position</th><th>Born</th><th>OVR</th><th>POT</th><th>Potential variance</th><th>Low swing</th><th>Months in academy</th><th>Tier</th></tr></thead><tbody>{world.youth.map((y,i) => <tr key={`${y.id}-${i}`}><td>{y.player ? <button className="text-btn" onClick={() => pick(y.player!)}>{y.name}</button> : y.name}</td><td>{y.player?.positions.join(' / ') ?? 'Unknown'}</td><td>{y.player?.birth ?? '—'}</td><td>{y.player?.ovr ?? '—'}</td><td>{y.player?.pot ?? '—'}</td><td>{y.variance ?? '—'}</td><td>{y.swing ?? '—'}</td><td>{y.months ?? '—'}</td><td>{y.tier ?? '—'}</td></tr>)}</tbody></Table>}
    <h2>Scouts</h2>{!world.scouts.length ? <p>No scout records in this save.</p> : <Table className="tbl"><thead><tr><th>Scout</th><th>Experience</th><th>Knowledge</th><th>Region ID</th><th>State code</th></tr></thead><tbody>{world.scouts.map((s,i) => <tr key={i}><td>{[s.firstname,s.lastname].filter(Boolean).join(' ') || `Scout ${s.scoutid ?? i+1}`}</td><td>{s.experience ?? '—'}</td><td>{s.knowledge ?? '—'}</td><td>{s.regionid ?? '—'}</td><td>{s.state ?? '—'}</td></tr>)}</tbody></Table>}
  </>
}

export function Planner({ world, pick }: { world: World; pick: (p: Player) => void }) {
  const [formation, setFormation] = useState('4-3-3'), [fitOnly, setFitOnly] = useState(false), [contractYear,setContractYear]=useState('')
  const squad = world.career.club?.players ?? [], rows = FORMATIONS[formation], positions = rows.flat()
  const available = squad.filter(p => !fitOnly || !p.injury)
  const xi = assignXI(available, positions), starters = new Set(xi.flatMap(p => p ? [p.id] : []))
  const backups = available.filter(p => !starters.has(p.id)), reserveXI = assignXI(backups, positions)
  const year = contractYear ? Number(contractYear) : null
  const warnings = positions.flatMap((pos, i) => {
    const starter = xi[i], cover = rankedOptions(backups, pos)
    return [...(!starter ? [`${pos} ${i+1}: no starter`] : []), ...(!cover.length ? [`${pos} ${i+1}: no cover outside the XI`] : !reserveXI[i] ? [`${pos} ${i+1}: cover shared with another slot`] : [])]
  })
  const expiring = squad.filter(p => p.contractUntil > 0 && (year===null || p.contractUntil <= year))
  let index = 0
  return <><h2>Squad planning &amp; depth</h2><div className="bar"><select aria-label="Formation" value={formation} onChange={e => setFormation(e.target.value)}>{Object.keys(FORMATIONS).map(f => <option key={f}>{f}</option>)}</select><label><input type="checkbox" checked={fitOnly} onChange={e => setFitOnly(e.target.checked)} /> Exclude injured players</label></div>
    <p className="sub">Suggested XI fills as many natural/secondary positions as possible, then maximizes total OVR. Each player starts once. Depth ranks use OVR; shared cover is marked. Age-based alerts are unavailable without a recorded current age. No ages are reconstructed.</p>
    <div className="planning-layout"><div className="pitch">{rows.map((row,r) => <div className="pitch-row" key={r}>{row.map(pos => { const i = index++, p = xi[i]; return <div className="pitch-slot" key={i}><span>{pos}</span>{p ? <button onClick={() => pick(p)}><b>{p.name}</b><small>{p.ovr} OVR{p.injury > 0 ? ' · injured' : ''}</small></button> : <strong>Vacant</strong>}</div> })}</div>)}</div>
    <aside className="needs"><h3>Where to act</h3>{warnings.length ? <ul>{warnings.map((w,i) => <li key={i}>{w}</li>)}</ul> : <p>Every slot has separate cover.</p>}<h3>Recorded contracts</h3><label>Ending by year (optional)<input aria-label="Planning contract end year" type="number" value={contractYear} onChange={e=>setContractYear(e.target.value)} /></label>{expiring.length ? expiring.map(p => <p key={p.id}><button className="text-btn" onClick={() => pick(p)}>{p.name}</button> · {p.contractUntil}</p>) : <p>None recorded.</p>}</aside></div>
    <div className="depth-grid">{[...new Set(positions)].map(pos => { const opts = rankedOptions(available,pos), needed = positions.filter(p => p === pos).length; return <section className="depth-card" key={pos}><h3>{pos} <small>{needed} starting slot{needed > 1 ? 's' : ''} · {opts.length} options</small></h3>{!opts.length ? <p className="warning">Recruit a {pos}</p> : <ol>{opts.map(p => <li key={p.id}><button className="text-btn" onClick={() => pick(p)}>{p.name}</button> <b>{p.ovr}</b><small>{p.pot} POT · {starters.has(p.id) ? `XI: ${positions[xi.findIndex(x => x?.id === p.id)]}` : 'Cover'}{p.positions.filter(x => positions.includes(x)).length > 1 ? ' · multi-position' : ''}{p.contractUntil > 0 ? ` · contract: ${p.contractUntil}` : ''}{p.injury > 0 ? ' · injured' : ''}</small></li>)}</ol>}</section> })}</div>
  </>
}

export function Shortlist({ game, world, pick, toggle, refresh }: { game: Game; world: World; pick: (p: Player) => void; toggle: (id: number) => void; refresh: number }) {
  const [snaps, setSnaps] = useState<Snapshot[]>([]), [selected, setSelected] = useState<number | null>(null), [err, setErr] = useState('')
  useEffect(() => { let live = true; allSnapshots(game.id).then(s => { if (live) setSnaps(s) }).catch(e => setErr(String(e))); return () => { live = false } }, [game.id, refresh])
  return <><h1>Transfer shortlist</h1><p className="sub">Star players in search or their profile. Changes compare the first and latest snapshot where the player appears; the open save may be older.</p>{err && <p className="err">{err}</p>}{!game.shortlist.length ? <p>No targets yet. Star a player in Player search.</p> : <Table className="tbl"><thead><tr><th>Star</th><th>Player</th><th>OVR</th><th>POT</th><th>Club change</th><th>Observed saves</th><th>Details</th></tr></thead><tbody>{game.shortlist.map(id => { const observations = snaps.flatMap(s => { const p = s.players.find(p => p.id === id); return p ? [{ p, s }] : [] }), first = observations[0], last = observations[observations.length-1], p = world.playerById.get(id); return <tr key={id}><td><button className="star-btn" aria-label={`Remove ${p?.name || last?.p.n || id} from shortlist`} onClick={() => toggle(id)}>★</button></td><td><button className="text-btn" onClick={() => setSelected(id)}>{p?.name || last?.p.n || `Player #${id}`}</button>{!p && <small>Not in open save</small>}</td><td>{last ? `${first.p.ovr} → ${last.p.ovr}` : '—'}</td><td>{last ? `${first.p.pot} → ${last.p.pot}` : '—'}</td><td>{last ? first.p.t === last.p.t ? last.p.team : `${first.p.team} → ${last.p.team}` : '—'}</td><td>{last ? `${snapshotTitle(first.s)} → ${snapshotTitle(last.s)}` : '—'}</td><td><button className="btn" onClick={() => setSelected(id)}>Timeline</button>{p && <button className="btn" onClick={() => pick(p)}>Profile</button>}</td></tr> })}</tbody></Table>}{selected !== null && <Timeline id={selected} gameId={game.id} refresh={refresh} />}</>
}
