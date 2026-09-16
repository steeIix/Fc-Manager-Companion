import { useContext, useMemo, useState } from 'react'
import { Table } from './Table'
import { fmtMoney, posGroup, matchesPos, rankOrder, POS_ORDER, POS_GROUPS, type World, type Player, type Team } from './model'
import { Logo } from './Logo'
import type { PSnap } from './snapshots'

type Lens = 'expiring' | 'free' | 'gems' | 'drops' | 'stuck'
const LENSES: { key: Lens; label: string; blurb: string }[] = [
  { key: 'expiring', label: 'Expiring contracts', blurb: 'Deals running out at strong clubs — cheap now, free soon.' },
  { key: 'free', label: 'Free agents', blurb: 'No club at all: signable for nothing but wages.' },
  { key: 'gems', label: 'Hidden gems', blurb: 'High potential at clubs too small to keep them.' },
  { key: 'drops', label: 'Value drops', blurb: 'Worth less than in your previous save — cheaper than they were.' },
  { key: 'stuck', label: 'Blocked talent', blurb: 'Good young players behind someone better at their own club.' },
]

export function Market({ world, prev, openClub, pick }: { world: World; prev: Map<number, PSnap> | null; openClub: (id: number) => void; pick: (p: Player) => void }) {
  const [lens, setLens] = useState<Lens>('expiring')
  const [gender, setGender] = useState<0 | 1>(0)
  const [pos, setPos] = useState('')
  const [maxAge, setMaxAge] = useState(40)
  const [minOvr, setMinOvr] = useState(70)
  const [minPot, setMinPot] = useState(0)
  const [minStars, setMinStars] = useState(0)

  const season = world.career.asOf.getUTCFullYear() + (world.career.asOf.getUTCMonth() >= 6 ? 1 : 0) // contracts run to 30 June

  const rows = useMemo(() => {
    const base = world.players.filter(p => p.gender === gender && !p.isSpecial && matchesPos(p, pos) && p.age <= maxAge && p.ovr >= minOvr && p.pot >= minPot)
    const byClubStars = (p: Player) => world.teamById.get(p.teamId)?.stars ?? 0
    switch (lens) {
      case 'expiring': {
        return base.filter(p => !p.isFreeAgent && p.contractUntil && p.contractUntil <= season && byClubStars(p) >= (minStars || 4))
          .sort((a, b) => a.contractUntil - b.contractUntil || rankOrder(a, b))
      }
      case 'free':
        return base.filter(p => p.isFreeAgent).sort(rankOrder)
      case 'gems':
        return base.filter(p => !p.isFreeAgent && p.pot - p.ovr >= 5 && p.age <= Math.min(maxAge, 23) && byClubStars(p) <= (minStars || 3.5))
          .sort((a, b) => b.pot - a.pot || rankOrder(a, b))
      case 'drops': {
        if (!prev) return []
        return base.filter(p => { const w = prev.get(p.id); return w && p.value < w.v }).sort((a, b) => (prev.get(a.id)!.v - a.value) > (prev.get(b.id)!.v - b.value) ? -1 : 1)
      }
      case 'stuck': {
        return base.filter(p => {
          if (p.isFreeAgent || p.age > Math.min(maxAge, 24)) return false
          const team = world.teamById.get(p.teamId)
          if (!team) return false
          return team.players.some(q => q.id !== p.id && q.positions.includes(p.pos) && q.ovr > p.ovr + 2)
        }).sort((a, b) => b.pot - a.pot || rankOrder(a, b))
      }
    }
  }, [world, prev, lens, gender, pos, maxAge, minOvr, minPot, minStars, season])

  const current = LENSES.find(l => l.key === lens)!
  const starLabel = lens === 'gems' ? 'Club at most' : 'Club at least'
  const showStars = lens === 'expiring' || lens === 'gems'

  return <>
    <h1>Market finder</h1>
    <p className="sub">Ready-made searches for the players worth chasing. Everything respects the save's date, so "expiring" means expiring in this season.</p>
    <div className="lens-row">
      {LENSES.map(l => <button key={l.key} className={'lens' + (lens === l.key ? ' on' : '')} onClick={() => setLens(l.key)}>
        <b>{l.label}</b><span>{l.blurb}</span>
      </button>)}
    </div>
    <div className="bar">
      <div className="seg"><button className={gender === 0 ? 'on' : ''} onClick={() => setGender(0)}>Men</button><button className={gender === 1 ? 'on' : ''} onClick={() => setGender(1)}>Women</button></div>
      <select aria-label="Market position" value={pos} onChange={e => setPos(e.target.value)}><option value="">Any position</option><optgroup label="Groups">{POS_GROUPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</optgroup><optgroup label="Positions">{POS_ORDER.map(p => <option key={p}>{p}</option>)}</optgroup></select>
      <span className="range">Min OVR <input type="number" value={minOvr} onChange={e => setMinOvr(+e.target.value)} /></span>
      <span className="range">Min POT <input type="number" value={minPot} onChange={e => setMinPot(+e.target.value)} /></span>
      <span className="range">Max age <input type="number" value={maxAge} onChange={e => setMaxAge(+e.target.value)} /></span>
      {showStars && <span className="range">{starLabel} <select aria-label="Club stars" value={minStars} onChange={e => setMinStars(+e.target.value)}>{(lens === 'gems' ? [0, 2, 2.5, 3, 3.5, 4] : [0, 3, 3.5, 4, 4.5, 5]).map(s => <option key={s} value={s}>{s === 0 ? 'default' : `${s}★`}</option>)}</select></span>}
      <span className="count">{rows.length} players</span>
    </div>
    <p className="sub" style={{ marginTop: -6 }}>{current.blurb}</p>
    {lens === 'drops' && !prev && <p className="dim">Import a second save into this game and any player who lost value between the two will show up here.</p>}
    {rows.length === 0 ? <p className="dim">Nothing matches — loosen the filters.</p> :
      <Table className="tbl"><thead><tr>
        <th className="num">#</th><th>Player</th><th>Pos</th><th className="num">Age</th><th>Club</th><th className="num">OVR</th><th className="num">POT</th><th className="num">Value</th>
        <th>{lens === 'expiring' ? 'Contract' : lens === 'gems' ? 'Growth' : lens === 'drops' ? 'Since last save' : lens === 'stuck' ? 'Behind' : 'Was at'}</th>
      </tr></thead><tbody>
        {rows.slice(0, 200).map((p, i) => {
          const team = world.teamById.get(p.teamId)
          const was = prev?.get(p.id)
          const blocker = lens === 'stuck' ? team?.players.filter(q => q.id !== p.id && q.positions.includes(p.pos)).sort((a, b) => b.ovr - a.ovr)[0] : undefined
          return <tr key={p.id} className="click" onClick={() => pick(p)}>
            <td className="num dim">{i + 1}</td>
            <td className="name"><span className={p.known ? '' : 'unk'}>{p.name}</span>{p.onLoanFrom && <span className="tag loan">Loan</span>}</td>
            <td><span className={'pos ' + posGroup(p.pos).toLowerCase()}>{p.pos}</span></td>
            <td className="num">{p.age}</td>
            <td>{team ? <a href="#" className="with-crest" onClick={e => { e.preventDefault(); e.stopPropagation(); openClub(team.id) }}><Logo team={team} size={18} />{team.name}<span className="dim" style={{ marginLeft: 6 }}>{team.ovr}</span></a> : <span className="dim">Free agent</span>}</td>
            <td className="num"><span className={'rt ' + (p.ovr >= 85 ? 'r5' : p.ovr >= 78 ? 'r4' : p.ovr >= 70 ? 'r3' : p.ovr >= 60 ? 'r2' : 'r1')}>{p.ovr}</span></td>
            <td className="num dim">{p.pot}</td>
            <td className="num">{fmtMoney(p.value)}</td>
            <td className="dim">
              {lens === 'expiring' && <>{p.contractUntil}{p.wage != null && <> · {fmtMoney(p.wage)}/wk</>}</>}
              {lens === 'gems' && <>+{p.pot - p.ovr} to come</>}
              {lens === 'drops' && was && <span className="trend down">−{fmtMoney(was.v - p.value)}</span>}
              {lens === 'stuck' && blocker && <>{blocker.shortName} <span className="dim">{blocker.ovr}</span></>}
              {lens === 'free' && <>{p.tenure === 'Just signed' ? 'newly released' : p.joinedLabel}</>}
            </td>
          </tr>
        })}
      </tbody></Table>}
  </>
}
