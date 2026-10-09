import { Fragment, useMemo, useState } from 'react'
import { fmtMoney, posGroup, rankOrder, type World, type Player, type Team } from './model'
import { STAR_STEPS } from './teamrating'
import { Logo } from './Logo'
import { Table } from './Table'
import type { TSnap } from './snapshots'

const Rating = ({ v }: { v: number }) => <span className={'rt ' + (v >= 85 ? 'r5' : v >= 78 ? 'r4' : v >= 70 ? 'r3' : v >= 60 ? 'r2' : 'r1')}>{v}</span>
const Stars = ({ n }: { n: number }) => <span className="stars" title={`${n} stars`}>{'★'.repeat(Math.floor(n))}{n % 1 ? '½' : ''}</span>
const Pos = ({ p }: { p: string }) => <span className={'pos ' + posGroup(p).toLowerCase()}>{p}</span>
const starLabel = (n: number) => `${Math.floor(n) || ''}${n % 1 ? '½' : ''} star${n === 1 ? '' : 's'}`
const TIERS = [...STAR_STEPS.map(([t, s]) => ({ s, from: t })), { s: 0.5, from: 0 }]

/** A club's headline players: best three by the same order used for world rankings. */
const starsOf = (t: Team, n = 3) => t.players.slice().sort(rankOrder).slice(0, n)

function StarPlayers({ t, pick, n = 3, big }: { t: Team; pick: (p: Player) => void; n?: number; big?: boolean }) {
  return <div className={'sp-list' + (big ? ' big' : '')}>{starsOf(t, n).map(p => <button key={p.id} className="sp" onClick={e => { e.stopPropagation(); pick(p) }} title={`${p.name} · ${p.pos} · ${p.ovr} OVR${p.rank ? ` · #${p.rank} in the world in his group` : ''} · ${p.classification.label}`}>
    <b className="sp-ovr">{p.ovr}</b><span className="sp-name">{p.shortName}</span><Pos p={p.pos} />
  </button>)}</div>
}

function Move({ now, was }: { now: number; was?: number }) {
  if (!was || was === now) return null
  const up = now < was
  return <span className={'trend ' + (up ? 'up' : 'down')} title={`Was #${was} in the previous save`}>{up ? '▲' : '▼'}{Math.abs(now - was)}</span>
}

export function Rankings({ world, prevTeams, prevLabel, openClub, pick }: { world: World; prevTeams?: Map<number, TSnap>; prevLabel?: string; openClub: (id: number) => void; pick: (p: Player) => void }) {
  const hasWomen = world.teams.some(t => t.gender === 1 && t.ratingRank)
  const [gender, setGender] = useState(0)
  const [league, setLeague] = useState(-1)
  const [tier, setTier] = useState<number | null>(null)
  const [limit, setLimit] = useState(50)
  const mine = world.career.clubId

  const leagues = useMemo(() => world.leagues.filter(l => !l.intl && l.teams.some(t => t.gender === gender && t.ratingRank)), [world, gender])
  const scope = useMemo(() => world.teams.filter(t => t.ratingRank && t.gender === gender && (league < 0 || t.leagueId === league)).sort((a, b) => a.ratingRank - b.ratingRank), [world, gender, league])
  const counts = useMemo(() => { const m = new Map<number, number>(); for (const t of scope) m.set(t.stars, (m.get(t.stars) ?? 0) + 1); return m }, [scope])
  const rows = useMemo(() => scope.filter(t => tier == null || t.stars === tier), [scope, tier])
  const shown = rows.slice(0, limit)
  const podium = tier == null ? scope.slice(0, 3) : []
  const myClub = world.teamById.get(mine)
  const meInScope = myClub && scope.includes(myClub) ? myClub : undefined

  return <>
    <h1>Strongest clubs</h1>
    <p className="sub">Every club ranked by squad rating — the best XI, its top three and the bench — rebuilt from this save, not the game's stored figure.{prevLabel ? <> Arrows compare with {prevLabel}.</> : null}</p>

    <div className="bar">
      {hasWomen && <div className="seg">{[['Men', 0], ['Women', 1]].map(([l, g]) => <button key={g} className={gender === g ? 'on' : ''} onClick={() => { setGender(g as number); setLeague(-1); setTier(null) }}>{l}</button>)}</div>}
      <select value={league} onChange={e => { setLeague(+e.target.value); setTier(null) }} aria-label="League">
        <option value={-1}>Every league</option>
        {leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      <div className="seg">{[25, 50, 100, 1000].map(n => <button key={n} className={limit === n ? 'on' : ''} onClick={() => setLimit(n)}>{n === 1000 ? 'All' : `Top ${n}`}</button>)}</div>
      {meInScope && <span className="count">Your club: <b>#{league < 0 ? meInScope.ratingRank : meInScope.ratingLeagueRank}</b></span>}
    </div>

    <div className="tierbar" role="group" aria-label="Filter by stars">
      <button className={tier == null ? 'on' : ''} onClick={() => setTier(null)}><b>{scope.length}</b><span>All clubs</span></button>
      {TIERS.filter(x => counts.get(x.s)).map(x => <button key={x.s} className={tier === x.s ? 'on' : ''} onClick={() => setTier(tier === x.s ? null : x.s)} title={x.from ? `Squad rating ${x.from}+` : undefined}>
        <Stars n={x.s} /><b>{counts.get(x.s)}</b><span>{starLabel(x.s)}</span>
      </button>)}
    </div>

    {podium.length > 0 && <div className="podium">
      {podium.map((t, i) => <article key={t.id} className={'pod pod-' + (i + 1) + (t.id === mine ? ' mine' : '')} onClick={() => openClub(t.id)} style={{ ['--c1' as string]: t.colors[0], ['--c2' as string]: t.colors[1], animationDelay: `${i * 70}ms` }}>
        <div className="pod-stripe"><i style={{ background: t.colors[0] }} /><i style={{ background: t.colors[1] }} /><i style={{ background: t.colors[2] }} /></div>
        <div className="pod-top"><span className="pod-rank">{league < 0 ? t.ratingRank : t.ratingLeagueRank}<Move now={t.ratingRank} was={prevTeams?.get(t.id)?.rk} /></span><Logo team={t} size={64} /></div>
        <h2>{t.name}</h2><p className="dim">{t.league}</p>
        <div className="pod-score"><b>{t.rating!.score}</b><Stars n={t.stars} /></div>
        <div className="pod-lines">{(['ATT', 'MID', 'DEF', 'GK'] as const).map(l => <span key={l}><small>{l}</small>{t.rating!.lines[l]}</span>)}</div>
        <h3>Star players</h3>
        <StarPlayers t={t} pick={pick} big />
      </article>)}
    </div>}

    <Table className="tbl power"><thead><tr>
      <th className="num">#</th><th>Club</th><th className="num">Rating</th><th>Stars</th><th className="num">In-game</th><th className="num">ATT</th><th className="num">MID</th><th className="num">DEF</th><th className="num">GK</th><th>Star players</th>
    </tr></thead><tbody>
      {shown.map((t, i) => {
        const header = tier == null && (i === 0 || shown[i - 1].stars !== t.stars)
        const was = prevTeams?.get(t.id)
        const d = was?.cr != null && t.rating ? Math.round((t.rating.score - was.cr) * 10) / 10 : 0
        return <Fragment key={t.id}>
          {header && <tr className="tier-row"><td colSpan={10}><Stars n={t.stars} /> <b>{starLabel(t.stars)}</b><span className="dim"> · {counts.get(t.stars)} club{counts.get(t.stars) === 1 ? '' : 's'}{TIERS.find(x => x.s === t.stars)?.from ? ` · rating ${TIERS.find(x => x.s === t.stars)!.from}+` : ''}</span></td></tr>}
          <tr className={'click' + (t.id === mine ? ' user' : '')} onClick={() => openClub(t.id)}>
            <td className="num"><b>{league < 0 ? t.ratingRank : t.ratingLeagueRank}</b> <Move now={t.ratingRank} was={was?.rk} /></td>
            <td className="name"><span className="with-crest"><Logo team={t} size={24} /><span>{t.name}<small className="sub-nation">{t.league} · {fmtMoney(t.squadValue)}</small></span></span></td>
            <td className="num" title={`Squad rating ${t.rating!.score}`}><Rating v={t.ovr} /><small className="sub-nation">{t.rating!.score}{d ? <span className={'trend ' + (d > 0 ? 'up' : 'down')}> {d > 0 ? '▲' : '▼'}{Math.abs(d)}</span> : null}</small></td>
            <td className="stars-cell"><Stars n={t.stars} /></td>
            <td className="num dim">{t.game.ovr}</td>
            <td className="num">{t.att}</td><td className="num">{t.mid}</td><td className="num">{t.def}</td><td className="num">{t.gk}</td>
            <td><StarPlayers t={t} pick={pick} /></td>
          </tr>
        </Fragment>
      })}
    </tbody></Table>
    {rows.length > shown.length && <p className="dim" style={{ marginTop: 12 }}>{rows.length - shown.length} more — choose “All” to see every club.</p>}
  </>
}
