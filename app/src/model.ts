import type { Row } from './parser'
import { rawScores, groupStats, finalize, type ArchetypeResult } from './archetypes'

export const POS = ['GK','SW','RWB','RB','RCB','CB','LCB','LB','LWB','RDM','CDM','LDM','RM','RCM','CM','LCM','LM','RAM','CAM','LAM','RF','CF','LF','RW','RS','ST','LS','LW','SUB','RES']
export const POS_SIMPLE: Record<string, string> = { SW:'CB', RCB:'CB', LCB:'CB', LWB:'LB', RWB:'RB', RDM:'CDM', LDM:'CDM', RCM:'CM', LCM:'CM', RAM:'CAM', LAM:'CAM', RF:'CF', LF:'CF', RS:'ST', LS:'ST' }
export const POS_ORDER = ['GK','CB','LB','RB','CDM','CM','CAM','LM','RM','LW','RW','CF','ST']
export const posGroup = (p: string) => p === 'GK' ? 'GK' : ['CB','LB','RB','LWB','RWB'].includes(p) ? 'DEF' : ['CDM','CM','CAM','LM','RM'].includes(p) ? 'MID' : 'ATT'
export const POS_GROUPS: [string, string][] = [['G:GK', 'All goalkeepers'], ['G:DEF', 'All defenders'], ['G:MID', 'All midfielders'], ['G:WNG', 'All wingers'], ['G:ST', 'All strikers'], ['G:ATT', 'All forwards']]
/** Position filter: a specific position (any of the player's positions) or a group ("G:DEF"). */
export const matchesPos = (p: { pos: string; positions: string[] }, f: string) => !f || (f.startsWith('G:') ? (f === 'G:ATT' ? posGroup(p.pos) === 'ATT' : rankGroupOf(p.pos) === f.slice(2)) : p.positions.includes(f))
// EA ships some clubs under placeholder names; show the real ones.
export const TEAM_DISPLAY: Record<number, string> = { 131682: 'Inter', 131681: 'AC Milan', 115841: 'Lazio', 115845: 'Atalanta' }
export const teamDisplayName = (id: number, name: string) => TEAM_DISPLAY[id] ?? name
/** Careers start in 2026/27, so season N is (2025+N)/(2026+N). */
export const seasonLabel = (n: number) => `${2025 + n}/${String(2026 + n).slice(2)}`

export const POS_LONG: Record<string, string> = { GK: 'Goalkeeper', CB: 'Centre-Back', LB: 'Left-Back', RB: 'Right-Back', CDM: 'Defensive Midfielder', CM: 'Central Midfielder', CAM: 'Attacking Midfielder', LM: 'Left Midfielder', RM: 'Right Midfielder', LW: 'Left Winger', RW: 'Right Winger', CF: 'Centre-Forward', ST: 'Striker' }
/** Ranking groups: wingers and strikers are different kinds of forward, so they are ranked apart. */
export type RankGroup = 'GK' | 'DEF' | 'MID' | 'WNG' | 'ST'
export const rankGroupOf = (p: string): RankGroup => p === 'GK' ? 'GK' : ['CB','LB','RB','LWB','RWB'].includes(p) ? 'DEF' : ['CDM','CM','CAM'].includes(p) ? 'MID' : ['LM','RM','LW','RW'].includes(p) ? 'WNG' : 'ST'
export const GROUP_LONG: Record<string, string> = { GK: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', WNG: 'Winger', ST: 'Striker' }
export const GROUP_PLURAL: Record<string, string> = { GK: 'goalkeepers', DEF: 'defenders', MID: 'midfielders', WNG: 'wingers', ST: 'strikers' }
export const GROUP_SHORT: Record<string, string> = { GK: 'GK', DEF: 'DEF', MID: 'MID', WNG: 'WNG', ST: 'ST' }
/** One ordering used for ranks and for rating-sorted lists, so #1 is always listed first. */
export const rankOrder = (a: { ovr: number; pot: number; value: number; id: number }, b: { ovr: number; pot: number; value: number; id: number }) => b.ovr - a.ovr || b.pot - a.pot || b.value - a.value || a.id - b.id
export type Tone = 'best' | 'great' | 'legend' | 'worldclass' | 'elite' | 'generational' | 'wonderkid' | 'rising' | 'evergreen' | 'prime' | 'topprospect' | 'established' | 'bloomer' | 'prospect' | 'squad' | 'veteran' | 'journeyman' | 'developing'
export interface Classification { label: string; tone: Tone; why: string }
/** Rank is the player's world rank within their position group (GK / DEF / MID / FWD), men and women separately. */
export function classify(p: { age: number; ovr: number; pot: number; pos: string }, rank: number): Classification {
  const a = p.age, o = p.ovr, t = p.pot, gap = t - o, grp = GROUP_LONG[rankGroupOf(p.pos)] ?? 'Player'
  if (rank === 1) return a >= 32 ? { label: 'One of the Greats', tone: 'great', why: `#1 ${grp.toLowerCase()} in the world at ${a}` } : { label: `World's Best ${grp}`, tone: 'best', why: `#1 ${grp.toLowerCase()} in the world` }
  if (rank <= 10) return a >= 32 ? { label: 'World-Class Legend', tone: 'legend', why: `#${rank} ${grp.toLowerCase()} at ${a}` } : { label: 'World-Class', tone: 'worldclass', why: `#${rank} ${grp.toLowerCase()} in the world` }
  if (rank <= 30) return { label: 'Elite', tone: 'elite', why: `#${rank} ${grp.toLowerCase()} in the world` }
  if (a <= 21 && t >= 92) return { label: 'Generational Talent', tone: 'generational', why: `${t} potential at ${a}` }
  if (a <= 19 && t >= 86) return { label: 'Wonderkid', tone: 'wonderkid', why: `${t} potential at ${a}` }
  if (a <= 23 && t >= 84 && gap >= 4) return { label: 'Rising Star', tone: 'rising', why: `${o} → ${t} by ${a}` }
  if (a >= 34 && o >= 80) return { label: 'Evergreen', tone: 'evergreen', why: `${o} overall at ${a}` }
  if (a >= 25 && a <= 30 && (o >= 82 || rank <= 60)) return { label: 'In His Prime', tone: 'prime', why: `${o} overall, #${rank} ${GROUP_SHORT[rankGroupOf(p.pos)]}` }
  if (a <= 22 && t >= 80) return { label: 'Top Prospect', tone: 'topprospect', why: `${t} potential at ${a}` }
  if (o >= 78) return { label: 'Established', tone: 'established', why: `${o} overall` }
  if (a >= 27 && gap >= 3 && o >= 72) return { label: 'Late Bloomer', tone: 'bloomer', why: `still ${gap} to grow at ${a}` }
  if (a <= 22 && t >= 74) return { label: 'Prospect', tone: 'prospect', why: `${t} potential` }
  if (o >= 72) return { label: 'Squad Player', tone: 'squad', why: `${o} overall` }
  if (a >= 33) return { label: 'Veteran', tone: 'veteran', why: `${a} years old` }
  if (a >= 29) return { label: 'Journeyman', tone: 'journeyman', why: `${o} overall at ${a}` }
  return { label: 'Developing', tone: 'developing', why: `${o} → ${t}` }
}

export function posName(code: number) { const p = POS[code] ?? '?'; return POS_SIMPLE[p] ?? p }

export type Names = { first: Record<string, string>; last: Record<string, string>; common: Record<string, string>; byId: Record<string, string> }
export type ValueModel = { ovrMin: number; ovr: number[]; ageMin: number; age: number[]; grp: number[]; k: number[] }

export interface Player {
  id: number; name: string; fullName: string; shortName: string; known: boolean; gender: number
  ovr: number; pot: number; age: number; birth: string; nationality: number; nation: string
  pos: string; positions: string[]; foot: string; skill: number; weak: number; height: number; weight: number
  teamId: number; team: string; leagueId: number; league: string; jersey: number; nationalTeam: string | null; squadPos: string; injury: number
  contractUntil: number; value: number; wage: number | null; onLoanFrom: string | null; loanEnd: string | null
  face: { PAC: number; SHO: number; PAS: number; DRI: number; DEF: number; PHY: number }
  gk: { DIV: number; HAN: number; KIC: number; REF: number; POS: number; SPD: number }
  archetype: ArchetypeResult; rank: number; rankPos: number; rankLeague: number; classification: Classification; attrs: Record<string, number>; leagueApps: number; leagueGoals: number; form: number
}
export interface Team {
  id: number; name: string; gender: number; ovr: number; att: number; mid: number; def: number; worth: number
  stars: number; leagueId: number; league: string; tablePos: number; points: number; played: number; w: number; d: number; l: number; gf: number; ga: number
  prestige: number; intlPrestige: number; founded: number; capacity: number; colors: [string, string, string]
  squadSize: number; avgAge: number; squadValue: number; captainId: number; players: Player[]
}
export interface League { id: number; name: string; intl: boolean; level: number; women: boolean; teams: Team[]; avgOvr: number }
export interface Career {
  manager: string; clubId: number; club?: Team; season: number; asOf: Date; wage: number
  history: Row[]; contracts: Map<number, Row>
}
export interface YouthPlayer { id: number; name: string; player?: Player; months: number | null; variance: number | null; swing: number | null; tier: number | null; raw: Row }
export interface World { youth: YouthPlayer[]; scouts: Row[]; players: Player[]; teams: Team[]; leagues: League[]; career: Career; playerById: Map<number, Player>; teamById: Map<number, Team> }

const ATTR_KEYS = ['acceleration','sprintspeed','positioning','finishing','shotpower','longshots','volleys','penalties','vision','crossing','freekickaccuracy','shortpassing','longpassing','curve','dribbling','agility','balance','reactions','ballcontrol','composure','interceptions','headingaccuracy','defensiveawareness','standingtackle','slidingtackle','jumping','stamina','strength','aggression','gkdiving','gkhandling','gkkicking','gkpositioning','gkreflexes']
export const ATTR_GROUPS: [string, string[]][] = [
  ['Pace', ['acceleration','sprintspeed']],
  ['Shooting', ['positioning','finishing','shotpower','longshots','volleys','penalties']],
  ['Passing', ['vision','crossing','freekickaccuracy','shortpassing','longpassing','curve']],
  ['Dribbling', ['agility','balance','reactions','ballcontrol','dribbling','composure']],
  ['Defending', ['interceptions','headingaccuracy','defensiveawareness','standingtackle','slidingtackle']],
  ['Physical', ['jumping','stamina','strength','aggression']],
  ['Goalkeeping', ['gkdiving','gkhandling','gkkicking','gkpositioning','gkreflexes']],
]
export const ATTR_LABEL: Record<string, string> = { acceleration:'Acceleration', sprintspeed:'Sprint speed', positioning:'Att. positioning', finishing:'Finishing', shotpower:'Shot power', longshots:'Long shots', volleys:'Volleys', penalties:'Penalties', vision:'Vision', crossing:'Crossing', freekickaccuracy:'FK accuracy', shortpassing:'Short passing', longpassing:'Long passing', curve:'Curve', dribbling:'Dribbling', agility:'Agility', balance:'Balance', reactions:'Reactions', ballcontrol:'Ball control', composure:'Composure', interceptions:'Interceptions', headingaccuracy:'Heading', defensiveawareness:'Def. awareness', standingtackle:'Standing tackle', slidingtackle:'Sliding tackle', jumping:'Jumping', stamina:'Stamina', strength:'Strength', aggression:'Aggression', gkdiving:'GK diving', gkhandling:'GK handling', gkkicking:'GK kicking', gkpositioning:'GK positioning', gkreflexes:'GK reflexes' }

const LILIAN = Date.UTC(1582, 9, 14)
export const lilianToDate = (d: number) => new Date(LILIAN + d * 86400000)
const yyyymmdd = (n: number) => new Date(Date.UTC(Math.floor(n / 10000), Math.floor(n / 100) % 100 - 1, n % 100))
export function ageAt(birth: Date, at: Date) {
  let a = at.getUTCFullYear() - birth.getUTCFullYear()
  if (at.getUTCMonth() < birth.getUTCMonth() || (at.getUTCMonth() === birth.getUTCMonth() && at.getUTCDate() < birth.getUTCDate())) a--
  return a
}
export const stars = (ovr: number) => ovr >= 83 ? 5 : ovr >= 79 ? 4.5 : ovr >= 75 ? 4 : ovr >= 71 ? 3.5 : ovr >= 69 ? 3 : ovr >= 67 ? 2.5 : ovr >= 65 ? 2 : ovr >= 63 ? 1.5 : ovr >= 60 ? 1 : 0.5
/** Market value estimate. Fitted on FC 26 launch values: rating curve × age curve × position, plus potential-gap and youth interactions. */
export function estimateValue(vm: ValueModel, ovr: number, age: number, pot: number, group: string) {
  const o = Math.min(Math.max(ovr, vm.ovrMin), vm.ovrMin + vm.ovr.length - 1), a = Math.min(Math.max(age, vm.ageMin), vm.ageMin + vm.age.length - 1)
  const d = Math.max(pot - ovr, 0), ay = Math.max(0, 27 - a), g = ['GK', 'DEF', 'MID', 'ATT'].indexOf(group), k = vm.k
  const log = vm.ovr[o - vm.ovrMin] + vm.age[a - vm.ageMin] + vm.grp[g] + k[0] * d + k[1] * d * d + k[2] * d * ay + k[3] * (o - 70) * (a - 27) + k[4] * g * d + k[5] * (o - 70) * ay
  const v = Math.exp(log)
  const step = v >= 5e7 ? 1e6 : v >= 1e7 ? 5e5 : v >= 1e6 ? 1e5 : v >= 1e5 ? 1e4 : 1e3
  return Math.round(v / step) * step
}
export const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
export function fmtMoney(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return '—'
  if (v >= 1e9) return `€${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `€${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M`
  if (v >= 1e3) return `€${Math.round(v / 1e3)}K`
  return `€${v}`
}

const wavg = (r: Row, w: [string, number][]) => Math.round(w.reduce((s, [k, x]) => s + (r[k] as number) * x, 0))

export function buildWorld(t: Record<string, Row[]>, names: Names, nations: Record<string, string>, vm: ValueModel, overrides: Record<string, string> = {}): World {
  const dc = new Map<number, string>(); for (const r of t.dcplayernames ?? []) dc.set(r.nameid as number, r.name as string)
  const edited = new Map<number, Row>(); for (const r of t.editedplayernames ?? []) edited.set(r.playerid as number, r)
  const intlLeague = new Set<number>(); for (const r of t.leagues ?? []) if ((r.isinternationalleague as number) === 1 || /international/i.test(r.leaguename as string)) intlLeague.add(r.leagueid as number)
  const tlPre = new Map<number, number>(); for (const r of t.leagueteamlinks ?? []) tlPre.set(r.teamid as number, r.leagueid as number)
  const link = new Map<number, Row>(), natLink = new Map<number, Row>()
  for (const r of t.teamplayerlinks ?? []) {
    const isNat = intlLeague.has(tlPre.get(r.teamid as number) ?? -1)
    if (isNat) natLink.set(r.playerid as number, r); else if (!link.has(r.playerid as number)) link.set(r.playerid as number, r)
  }
  for (const [pid, r] of natLink) if (!link.has(pid)) link.set(pid, r)
  const tl = new Map<number, Row>(); for (const r of t.leagueteamlinks ?? []) tl.set(r.teamid as number, r)
  const leagueRows = new Map<number, Row>(); for (const r of t.leagues ?? []) leagueRows.set(r.leagueid as number, r)
    const contracts = new Map<number, Row>(); for (const r of t.career_playercontract ?? []) contracts.set(r.playerid as number, r)

  // The save has no usable "today". Use the latest date the game itself wrote for a past event
  // (transfer/news events); contract dates are only trusted if they are within a month of that,
  // since pre-contract agreements can carry future start dates.
  const dv = (x: unknown) => (typeof x === 'number' && x > 19000000 && x < 21000000) ? x : 0
  let ev = 0; for (const r of t.persistent_events ?? []) ev = Math.max(ev, dv(r.eventdate))
  let latest = ev
  const cap = ev ? ev + 100 : 21000000 // ~1 month in yyyymmdd arithmetic
  for (const r of t.career_playercontract ?? []) for (const k of ['last_status_change_date', 'contract_date']) { const x = dv(r[k]); if (x <= cap) latest = Math.max(latest, x) }
  const asOf = latest ? yyyymmdd(latest) : new Date()
  const loans = new Map<number, Row>()
  for (const r of t.playerloans ?? []) if (Number(r.teamidloanedfrom) > 0 && link.has(Number(r.playerid)) && Number(link.get(Number(r.playerid))!.teamid) !== Number(r.teamidloanedfrom) && lilianToDate(r.loandateend as number) >= asOf) loans.set(Number(r.playerid), r)

  const teams: Team[] = []
  const teamById = new Map<number, Team>()
  for (const r of t.teams ?? []) {
    const l = tl.get(r.teamid as number)
    const lg = l ? leagueRows.get(l.leagueid as number) : undefined
    const hex = (a: number, b: number, c: number) => '#' + [a, b, c].map(x => x.toString(16).padStart(2, '0')).join('')
    const tm: Team = {
      id: r.teamid as number, name: teamDisplayName(r.teamid as number, r.teamname as string), gender: r.gender as number,
      ovr: r.overallrating as number, att: r.attackrating as number, mid: r.midfieldrating as number, def: r.defenserating as number,
      worth: (r.clubworth as number) * 1000, stars: stars(r.overallrating as number),
      leagueId: l ? (l.leagueid as number) : -1, league: lg ? ((lg.leaguename as string) || 'Special teams') : 'Unassigned',
      tablePos: l ? (l.currenttableposition as number) : 0, points: l ? (l.points as number) : 0, played: l ? (l.nummatchesplayed as number) : 0,
      w: l ? (l.homewins as number) + (l.awaywins as number) : 0, d: l ? (l.homedraws as number) + (l.awaydraws as number) : 0, l: l ? (l.homelosses as number) + (l.awaylosses as number) : 0,
      gf: l ? (l.homegf as number) + (l.awaygf as number) : 0, ga: l ? (l.homega as number) + (l.awayga as number) : 0,
      prestige: r.domesticprestige as number, intlPrestige: r.internationalprestige as number, founded: r.foundationyear as number, capacity: r.teamstadiumcapacity as number,
      colors: [hex(r.teamcolor1r as number, r.teamcolor1g as number, r.teamcolor1b as number), hex(r.teamcolor2r as number, r.teamcolor2g as number, r.teamcolor2b as number), hex(r.teamcolor3r as number, r.teamcolor3g as number, r.teamcolor3b as number)],
      squadSize: 0, avgAge: 0, squadValue: 0, captainId: r.captainid as number, players: [],
    }
    teams.push(tm); teamById.set(tm.id, tm)
  }

  const players: Player[] = []
  const playerById = new Map<number, Player>()
  for (const r of t.players ?? []) {
    const id = r.playerid as number
    const F = r.firstnameid as number, L = r.lastnameid as number, C = r.commonnameid as number
    const ed = edited.get(id)
    let first = ed?.firstname as string || dc.get(F) || names.first[F] || ''
    let last = ed?.surname as string || dc.get(L) || names.last[L] || ''
    let common = ed?.commonname as string || (C ? dc.get(C) || names.common[C] || '' : '')
    let known = true, name: string, shortName: string
    if (overrides[String(id)]) { name = shortName = overrides[String(id)]; first = ''; last = ''; common = name }
    else if (common) { name = common; shortName = common }
    else if (last) { name = (first ? first.split(' ')[0] + ' ' : '') + last; shortName = (first ? first[0] + '. ' : '') + last }
    else if (names.byId[id]) { name = shortName = names.byId[id] }
    else { known = false; name = shortName = `Unknown #${id}` }
    if (first === 'x') name = last, shortName = last

    const lk = link.get(id)
    const team = lk ? teamById.get(lk.teamid as number) : undefined
    const birth = lilianToDate(r.birthdate as number)
    const age = ageAt(birth, asOf)
    const positions = [1,2,3,4,5,6,7].map(i => r[`preferredposition${i}`] as number).filter(p => p >= 0).map(posName)
    const pos = positions[0] ?? '?'
    const ovr = r.overallrating as number, pot = r.potential as number
    const ct = contracts.get(id)
    const lo = loans.get(id)
    const isGK = pos === 'GK'
    const face = {
      PAC: wavg(r, [['acceleration', .45], ['sprintspeed', .55]]),
      SHO: wavg(r, [['finishing', .45], ['shotpower', .2], ['longshots', .2], ['positioning', .05], ['volleys', .05], ['penalties', .05]]),
      PAS: wavg(r, [['shortpassing', .35], ['vision', .2], ['crossing', .2], ['longpassing', .15], ['freekickaccuracy', .05], ['curve', .05]]),
      DRI: wavg(r, [['dribbling', .5], ['ballcontrol', .35], ['agility', .1], ['balance', .05]]),
      DEF: wavg(r, [['defensiveawareness', .3], ['standingtackle', .3], ['interceptions', .2], ['headingaccuracy', .1], ['slidingtackle', .1]]),
      PHY: wavg(r, [['strength', .5], ['stamina', .25], ['aggression', .2], ['jumping', .05]]),
    }
    const gk = { DIV: r.gkdiving as number, HAN: r.gkhandling as number, KIC: r.gkkicking as number, REF: r.gkreflexes as number, POS: r.gkpositioning as number, SPD: Math.floor((r.acceleration as number) * .45 + (r.sprintspeed as number) * .55) }
    const attrs: Record<string, number> = {}; for (const k of ATTR_KEYS) attrs[k] = r[k] as number
    const p: Player = {
      id, name, fullName: common ? (first || last ? `${first} ${last}`.trim() : common) : `${first} ${last}`.trim() || name, shortName, known, gender: r.gender as number, ovr, pot, age, birth: fmtDate(birth),
      nationality: r.nationality as number, nation: nations[String(r.nationality)] ?? `Nation ${r.nationality}`,
      pos, positions, foot: (r.preferredfoot as number) === 1 ? 'Right' : 'Left', skill: r.skillmoves as number, weak: r.weakfootabilitytypecode as number,
      height: r.height as number, weight: r.weight as number,
      teamId: team?.id ?? -1, team: team?.name ?? 'Free agent', leagueId: team?.leagueId ?? -1, league: team?.league ?? '—',
      jersey: lk ? (lk.jerseynumber as number) : 0, nationalTeam: natLink.has(id) ? (teamById.get(natLink.get(id)!.teamid as number)?.name ?? null) : null, squadPos: lk ? (POS[lk.position as number] ?? '?') : '—', injury: lk ? (lk.injury as number) : 0,
      contractUntil: r.contractvaliduntil as number, value: estimateValue(vm, ovr, age, pot, isGK ? 'GK' : posGroup(pos)),
      wage: ct ? (ct.wage as number) : null,
      onLoanFrom: lo ? (teamById.get(lo.teamidloanedfrom as number)?.name ?? 'Unknown club') : null, loanEnd: lo ? fmtDate(lilianToDate(lo.loandateend as number)) : null,
      face, gk, attrs, archetype: null as unknown as ArchetypeResult, rank: 0, rankPos: 0, rankLeague: 0, classification: null as unknown as Classification, leagueApps: lk ? (lk.leagueappearances as number) : 0, leagueGoals: lk ? (lk.leaguegoals as number) : 0, form: lk ? (lk.form as number) : 0,
    }
    players.push(p); playerById.set(id, p)
    if (team) team.players.push(p)
  }
  // Archetypes: two passes so each archetype is judged against the same position group's population.
  const rawAll = players.map(p => rawScores(p.pos, p.attrs))
  const stats = groupStats(rawAll)
  players.forEach((p, i) => { p.archetype = finalize(rawAll[i].group, rawAll[i].raw, stats, p.attrs, { skill: p.skill, height: p.height, ovr: p.ovr }) })
  // Rankings: world rank within position group (GK/DEF/MID/FWD), plus rank at the exact position and group rank inside the league; per gender.
  const intl = new Set<number>(); for (const r of t.leagues ?? []) if (intlLeague.has(r.leagueid as number) || !(r.leaguename as string) || /free agent/i.test(r.leaguename as string)) intl.add(r.leagueid as number)
  const better = rankOrder
  const groupPools = new Map<string, Player[]>(), posPools = new Map<string, Player[]>(), leaguePools = new Map<string, Player[]>()
  const push = (mp: Map<string, Player[]>, k: string, p: Player) => (mp.get(k) ?? mp.set(k, []).get(k)!).push(p)
  for (const p of players) {
    if (intl.has(p.leagueId) || p.teamId < 0 || p.age > 45) continue
    push(groupPools, `${p.gender}:${rankGroupOf(p.pos)}`, p); push(posPools, `${p.gender}:${p.pos}`, p); push(leaguePools, `${p.leagueId}:${rankGroupOf(p.pos)}`, p)
  }
  for (const arr of groupPools.values()) arr.sort(better).forEach((p, i) => { p.rank = i + 1 })
  for (const arr of posPools.values()) arr.sort(better).forEach((p, i) => { p.rankPos = i + 1 })
  for (const arr of leaguePools.values()) arr.sort(better).forEach((p, i) => { p.rankLeague = i + 1 })
  for (const p of players) p.classification = classify(p, p.rank || 9999)
  for (const tm of teams) {
    tm.players.sort((a, b) => POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos) || rankOrder(a, b))
    tm.squadSize = tm.players.length
  }
  const leagues: League[] = []
  for (const r of t.leagues ?? []) {
    const lt = teams.filter(x => x.leagueId === r.leagueid).sort((a, b) => (a.tablePos || 99) - (b.tablePos || 99) || b.ovr - a.ovr)
    if (!lt.length) continue
    leagues.push({ id: r.leagueid as number, name: (r.leaguename as string) || 'Special teams', intl: intlLeague.has(r.leagueid as number) || !(r.leaguename as string) || /free agent/i.test(r.leaguename as string), level: r.level as number, women: (r.iswomencompetition as number) === 1, teams: lt, avgOvr: +(lt.reduce((s, x) => s + x.ovr, 0) / lt.length).toFixed(1) })
  }
  leagues.sort((a, b) => Number(a.intl) - Number(b.intl) || b.avgOvr - a.avgOvr)

  const u = (t.career_users ?? [])[0] ?? {}
  const club = teamById.get(u.clubteamid as number)
  const career: Career = {
    manager: (u.commonname as string) || [u.firstname, u.surname].filter(Boolean).join(' ') || 'Manager', clubId: u.clubteamid as number, club,
    season: u.seasoncount as number, asOf, wage: u.wage as number, history: (t.career_managerhistory ?? []).slice().sort((a, b) => (a.season as number) - (b.season as number)), contracts,
  }
  const youth = (t.career_youthplayers ?? []).map(r => {
    const p = playerById.get(Number(r.playerid))
    const val = (k: string) => typeof r[k] === 'number' ? r[k] as number : null
    return { id: Number(r.playerid), name: p?.name ?? `Youth #${r.playerid}`, player: p, months: val('monthsinsquad'), variance: val('potentialvariance'), swing: val('swinglowpotential'), tier: val('playertier'), raw: r }
  })
  // Academy players are tracked separately; they are not free agents or senior squad options.
  const youthIds = new Set(youth.map(y => y.id))
  for (const tm of teams) {
    tm.players = tm.players.filter(p => !youthIds.has(p.id))
    tm.squadSize = tm.players.length
    tm.avgAge = tm.players.length ? +(tm.players.reduce((s, p) => s + p.age, 0) / tm.players.length).toFixed(1) : 0
    tm.squadValue = tm.players.reduce((s, p) => s + p.value, 0)
  }
  for (const y of youth) if (y.player) { y.player.team = `${club?.name ?? 'My club'} · Youth`; y.player.teamId = club?.id ?? -1 }
  return { players, teams, leagues, career, playerById, teamById, youth, scouts: t.career_scouts ?? [] }
}
