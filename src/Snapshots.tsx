import { Table } from './Table'
import { useEffect, useMemo, useState } from 'react'
import { Timeline } from './Features'
import {  posGroup, fmtMoney } from './model'
import { snapshotTitle, listSnapshots, getSnapshot, deleteSnapshot, renameSnapshot, type SnapMeta, type Snapshot, type PSnap } from './snapshots'

const Rating = ({ v }: { v: number }) => <span className={'rt ' + (v >= 85 ? 'r5' : v >= 78 ? 'r4' : v >= 70 ? 'r3' : v >= 60 ? 'r2' : 'r1')}>{v}</span>
const Pos = ({ p }: { p: string }) => <span className={'pos ' + posGroup(p).toLowerCase()}>{p}</span>
const Delta = ({ d }: { d: number }) => <span className={'delta ' + (d > 0 ? 'up' : d < 0 ? 'down' : '')}>{d > 0 ? '+' : ''}{d}</span>
const title = snapshotTitle

export function Snapshots({ currentId, refresh, gameId }: { currentId?: string; refresh: number; gameId: string }) {
  const [playerId, setPlayerId] = useState<number | null>(null)
  const [err, setErr] = useState('')
  const [list, setList] = useState<SnapMeta[]>([])
  const [a, setA] = useState(''); const [b, setB] = useState('')
  const [A, setSA] = useState<Snapshot | null>(null); const [B, setSB] = useState<Snapshot | null>(null)
  const [editing, setEditing] = useState<string | null>(null); const [label, setLabel] = useState('')
  const reload = () => listSnapshots(gameId).then(l => { setList(l); if (!a && l.length > 1) setA(l[l.length - 2].id); if (!b && l.length) setB(l[l.length - 1].id) }).catch(e => setErr(String(e)))
  useEffect(() => { reload() }, [refresh])
  useEffect(() => { let live = true; setSA(null); if (a) getSnapshot(a).then(s => { if (live) setSA(s ?? null) }).catch(e => setErr(String(e))); return () => { live = false } }, [a, refresh])
  useEffect(() => { let live = true; setSB(null); if (b) getSnapshot(b).then(s => { if (live) setSB(s ?? null) }).catch(e => setErr(String(e))); return () => { live = false } }, [b, refresh])

  return <>
    <h1>Snapshots</h1>{err && <p className="err">{err}</p>}
    <p className="sub">Every save you open is kept here in your browser. Save numbers follow import order. Compare any two saves to see who improved, who declined, and who came and went.</p>
    {list.length === 0 ? <p className="sub">No snapshots yet. Open a save and it will appear here.</p> :
      <Table className="tbl"><thead><tr><th>Snapshot</th><th className="num">Season</th><th>Club</th><th>File</th><th className="num">Players</th><th></th></tr></thead><tbody>
        {list.map(m => <tr key={m.id} className={m.id === currentId ? 'user' : ''}>
          <td className="name">{editing === m.id ? <span className="bar" style={{ margin: 0 }}><input type="text" value={label} onChange={e => setLabel(e.target.value)} /><button className="btn" onClick={async () => { try { await renameSnapshot(m.id, label); setEditing(null); reload() } catch (e) { setErr(String(e)) } }}>Save</button></span> : <>{title(m)}{m.id === currentId && <span className="tag">Open now</span>}</>}</td>
          <td className="num">{m.season}</td><td>{m.club || '–'}</td><td className="dim file" title={m.fileName}>{m.fileName}</td><td className="num">{m.playerCount.toLocaleString()}</td>
          <td><button className="btn" onClick={() => { setEditing(m.id); setLabel(m.label) }}>Rename</button> <button className="btn" onClick={async () => { if (confirm('Delete this snapshot and its stored save file?')) { try { await deleteSnapshot(m.id); if (a === m.id) setA(''); if (b === m.id) setB(''); reload() } catch (e) { setErr(String(e)) } } }}>Delete</button></td>
        </tr>)}
      </tbody></Table>}
    {list.length >= 2 && <>
      <h2>Compare</h2>
      <div className="bar">
        <select value={a} onChange={e => setA(e.target.value)}><option value="">Earlier snapshot…</option>{list.map(m => <option key={m.id} value={m.id}>{title(m)}</option>)}</select>
        <span style={{ color: 'var(--ink-3)' }}>to</span>
        <select value={b} onChange={e => setB(e.target.value)}><option value="">Later snapshot…</option>{list.map(m => <option key={m.id} value={m.id}>{title(m)}</option>)}</select>
      </div>
      {A && B && A.id !== B.id && <Compare A={A} B={B} pick={setPlayerId} />}
    </>}
    {playerId !== null && <div className="overlay" onClick={() => setPlayerId(null)}><div className="modal" onClick={e => e.stopPropagation()}><button className="x" aria-label="Close timeline" onClick={() => setPlayerId(null)}>✕</button><Timeline id={playerId} gameId={gameId} refresh={refresh} /></div></div>}
  </>
}

function Compare({ A, B, pick }: { A: Snapshot; B: Snapshot; pick: (id: number) => void }) {
  const [clubId, setClubId] = useState(B.clubId || A.clubId)
  const [gender, setGender] = useState<'all' | 0 | 1>('all')
  const [minOvr, setMinOvr] = useState(60)
  const swap = (A.order ?? 0) > (B.order ?? 0); const [X, Y] = swap ? [B, A] : [A, B]
  const data = useMemo(() => {
    const xm = new Map(X.players.map(p => [p.id, p])), ym = new Map(Y.players.map(p => [p.id, p]))
    const both: { x: PSnap; y: PSnap; d: number; dp: number; dc: boolean }[] = []
    for (const y of Y.players) { const x = xm.get(y.id); if (x) both.push({ x, y, d: y.ovr - x.ovr, dp: y.pot - x.pot, dc: y.contract !== x.contract }) }
    const f = both.filter(r => (gender === 'all' || r.y.g === gender) && Math.max(r.x.ovr, r.y.ovr) >= minOvr)
    const risers = f.filter(r => r.d > 0).sort((p, q) => q.d - p.d || q.y.ovr - p.y.ovr).slice(0, 25)
    const fallers = f.filter(r => r.d < 0).sort((p, q) => p.d - q.d || q.y.ovr - p.y.ovr).slice(0, 25)
    const potUp = f.filter(r => r.dp > 0).sort((p, q) => q.dp - p.dp).slice(0, 10)
    const newPlayers = Y.players.filter(p => !xm.has(p.id) && (gender === 'all' || p.g === gender)).sort((p, q) => q.pot - p.pot).slice(0, 15)
    const gone = X.players.filter(p => !ym.has(p.id) && (gender === 'all' || p.g === gender)).sort((p, q) => q.ovr - p.ovr).slice(0, 15)
    const tx = new Map(X.teams.map(t => [t.id, t]))
    const teams = Y.teams.map(t => ({ t, o: tx.get(t.id) })).filter(r => r.o && r.t.ovr !== r.o!.ovr).map(r => ({ ...r, d: r.t.ovr - r.o!.ovr })).sort((p, q) => q.d - p.d)
    const clubX = X.players.filter(p => p.t === clubId), clubY = Y.players.filter(p => p.t === clubId)
    const yIds = new Set(clubY.map(p => p.id)), xIds = new Set(clubX.map(p => p.id))
    const left = clubX.filter(p => !yIds.has(p.id)).map(p => ({ p, now: ym.get(p.id) })).sort((a, b) => b.p.ovr - a.p.ovr)
    const joined = clubY.filter(p => !xIds.has(p.id)).map(p => ({ p, was: xm.get(p.id) })).sort((a, b) => b.p.ovr - a.p.ovr)
    const stayed = clubY.filter(p => xIds.has(p.id)).map(p => ({ x: xm.get(p.id)!, y: p, d: p.ovr - xm.get(p.id)!.ovr })).sort((a, b) => b.d - a.d || b.y.ovr - a.y.ovr)
    const clubs = Y.teams.slice().sort((p, q) => p.n.localeCompare(q.n))
    return { both: f, risers, fallers, potUp, newPlayers, gone, teams, left, joined, stayed, clubs, tx }
  }, [X, Y, clubId, gender, minOvr])
  const clubName = Y.teams.find(t => t.id === clubId)?.n ?? 'Club'


  const PlayerRow = ({ r }: { r: { x: PSnap; y: PSnap; d: number; dp: number; dc: boolean } }) => <tr>
    <td className="name"><button className="text-btn" onClick={() => pick(r.y.id)}>{r.y.n}</button></td><td><Pos p={r.y.pos} /></td><td className="num">{r.y.age}</td><td>{r.y.team}{r.y.t !== r.x.t && <span className="tag" title={`Was at ${r.x.team}`}>from {r.x.team}</span>}</td>
    <td className="num"><Rating v={r.x.ovr} /> → <Rating v={r.y.ovr} /></td><td className="num"><Delta d={r.d} /></td><td className="num">{r.x.pot} → {r.y.pot}{r.dp !== 0 && <> <Delta d={r.dp} /></>}</td><td className="num">{fmtMoney(r.y.v)}{r.y.v !== r.x.v && <> <span className={'delta ' + (r.y.v > r.x.v ? 'up' : 'down')}>{r.y.v > r.x.v ? '+' : '−'}{fmtMoney(Math.abs(r.y.v - r.x.v))}</span></>}</td><td>{r.x.contract ?? '—'} → {r.y.contract ?? '—'}</td>
  </tr>
  const head = <thead><tr><th>Player</th><th>Pos</th><th className="num">Age</th><th>Club</th><th className="num">Overall</th><th className="num">Δ</th><th className="num">Potential</th><th className="num">Value</th><th>Contract</th></tr></thead>

  return <>
    <p className="sub">{title(X)} → {title(Y)} · career season {X.season} → {Y.season}. {data.both.length.toLocaleString()} players appear in both.</p>
    <div className="bar">
      <div className="seg"><button className={gender === 'all' ? 'on' : ''} onClick={() => setGender('all')}>All</button><button className={gender === 0 ? 'on' : ''} onClick={() => setGender(0)}>Men</button><button className={gender === 1 ? 'on' : ''} onClick={() => setGender(1)}>Women</button></div>
      <span className="range">Min overall <input type="number" value={minOvr} onChange={e => setMinOvr(+e.target.value)} /></span>
    </div>

    <h2>{clubName}: who came and went</h2>
    <div className="bar"><select value={clubId} onChange={e => setClubId(+e.target.value)}>{data.clubs.map(t => <option key={t.id} value={t.id}>{t.n}</option>)}</select>
      <span className="count">{data.left.length} left · {data.joined.length} joined · {data.stayed.length} stayed</span></div>
    <div className="two">
      <div><h3 className="h3">Left the club</h3>{data.left.length === 0 ? <p className="dim">Nobody left.</p> : <Table className="tbl"><thead><tr><th>Player</th><th>Pos</th><th className="num">OVR then</th><th>Now at</th></tr></thead><tbody>
        {data.left.map(({ p, now }) => <tr key={p.id}><td className="name"><button className="text-btn" onClick={() => pick(p.id)}>{p.n}</button></td><td><Pos p={p.pos} /></td><td className="num"><Rating v={p.ovr} /></td><td>{now ? <>{now.team} <Rating v={now.ovr} /></> : <span className="dim">Retired / not in save</span>}</td></tr>)}
      </tbody></Table>}</div>
      <div><h3 className="h3">Joined the club</h3>{data.joined.length === 0 ? <p className="dim">No arrivals.</p> : <Table className="tbl"><thead><tr><th>Player</th><th>Pos</th><th>Born</th><th className="num">OVR / POT</th><th>From</th></tr></thead><tbody>
        {data.joined.map(({ p, was }) => <tr key={p.id}><td className="name"><button className="text-btn" onClick={() => pick(p.id)}>{p.n}</button></td><td><Pos p={p.pos} /></td><td>{p.birth ?? '—'}</td><td className="num"><Rating v={p.ovr} /> <Rating v={p.pot} /></td><td>{was ? <>{was.team} {was.ovr !== p.ovr && <Delta d={p.ovr - was.ovr} />}</> : <span className="dim">New (youth / generated)</span>}</td></tr>)}
      </tbody></Table>}</div>
    </div>
    <h3 className="h3">Development of players who stayed</h3>
    <Table className="tbl">{head}<tbody>{data.stayed.map(r => <PlayerRow key={r.y.id} r={{ ...r, dp: r.y.pot - r.x.pot, dc: r.y.contract !== r.x.contract }} />)}</tbody></Table>

    <h2>Biggest improvers in the world</h2>
    <Table className="tbl">{head}<tbody>{data.risers.map(r => <PlayerRow key={r.y.id} r={r} />)}</tbody></Table>
    <h2>Biggest drop-offs</h2>
    <Table className="tbl">{head}<tbody>{data.fallers.map(r => <PlayerRow key={r.y.id} r={r} />)}</tbody></Table>
    {data.potUp.length > 0 && <><h2>Potential re-rated upwards</h2>
      <Table className="tbl">{head}<tbody>{data.potUp.map(r => <PlayerRow key={r.y.id} r={r} />)}</tbody></Table></>}

    <div className="two">
      <div><h2>New faces since {title(X)}</h2><Table className="tbl"><thead><tr><th>Player</th><th>Pos</th><th>Born</th><th>Club</th><th className="num">OVR / POT</th></tr></thead><tbody>
        {data.newPlayers.map(p => <tr key={p.id}><td className="name"><button className="text-btn" onClick={() => pick(p.id)}>{p.n}</button></td><td><Pos p={p.pos} /></td><td>{p.birth ?? '—'}</td><td>{p.team}</td><td className="num"><Rating v={p.ovr} /> <Rating v={p.pot} /></td></tr>)}
      </tbody></Table></div>
      <div><h2>No longer in the game</h2><Table className="tbl"><thead><tr><th>Player</th><th>Pos</th><th>Born</th><th>Last club</th><th className="num">OVR then</th></tr></thead><tbody>
        {data.gone.map(p => <tr key={p.id}><td className="name"><button className="text-btn" onClick={() => pick(p.id)}>{p.n}</button></td><td><Pos p={p.pos} /></td><td>{p.birth ?? '—'}</td><td>{p.team}</td><td className="num"><Rating v={p.ovr} /></td></tr>)}
      </tbody></Table></div>
    </div>

    {data.teams.length > 0 && <><h2>Club ratings that moved</h2>
      <Table className="tbl"><thead><tr><th>Club</th><th>League</th><th className="num">Overall</th><th className="num">Δ</th></tr></thead><tbody>
        {data.teams.slice(0, 15).concat(data.teams.length > 30 ? data.teams.slice(-15) : []).map(r => <tr key={r.t.id}><td className="name">{r.t.n}</td><td className="dim">{r.t.lg}</td><td className="num"><Rating v={r.o!.ovr} /> → <Rating v={r.t.ovr} /></td><td className="num"><Delta d={r.d} /></td></tr>)}
      </tbody></Table></>}
  </>
}
