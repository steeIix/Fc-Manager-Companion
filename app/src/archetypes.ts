// Archetype system: every player gets a primary archetype (and a hybrid label when a second one is close),
// derived purely from attributes. Think NBA 2K builds — "Slashing Playmaker" — but for football.

export type Group = 'GK' | 'CB' | 'FB' | 'DM' | 'CM' | 'AM' | 'W' | 'ST'
export interface Archetype { id: string; name: string; adj: string; group: Group; blurb: string; w: [string, number][] }
export interface ArchetypeResult { id: string; name: string; label: string; fit: number; group: Group; scores: { id: string; name: string; score: number }[]; tags: string[] }

const A = (id: string, name: string, adj: string, group: Group, blurb: string, w: [string, number][]): Archetype => ({ id, name, adj, group, blurb, w })

export const ARCHETYPES: Archetype[] = [
  // Goalkeepers
  A('shotstopper', 'Shot Stopper', 'Shot-Stopping', 'GK', 'Reflexes and diving first; wins games on the line.', [['gkreflexes', 4], ['gkdiving', 4], ['gkpositioning', 1], ['agility', 1]]),
  A('sweeperkeeper', 'Sweeper Keeper', 'Sweeping', 'GK', 'Plays high, quick off the line, comfortable with the ball.', [['gkkicking', 3], ['sprintspeed', 2], ['acceleration', 2], ['gkpositioning', 2], ['composure', 1]]),
  A('commander', 'Box Commander', 'Commanding', 'GK', 'Claims crosses, organises the box, safe hands.', [['gkhandling', 4], ['gkpositioning', 3], ['jumping', 1], ['strength', 1], ['reactions', 1]]),
  // Centre-backs
  A('ballplaying', 'Ball-Playing Defender', 'Ball-Playing', 'CB', 'Builds from the back with composure and passing range.', [['shortpassing', 3], ['longpassing', 2], ['composure', 2], ['ballcontrol', 1], ['vision', 1], ['defensiveawareness', 1]]),
  A('stopper', 'Stopper', 'Stopping', 'CB', 'Aggressive, physical, wins duels and steps in hard.', [['standingtackle', 3], ['strength', 3], ['aggression', 2], ['slidingtackle', 1], ['defensiveawareness', 1]]),
  A('aerial', 'Aerial Dominator', 'Aerial', 'CB', 'Owns both boxes in the air.', [['headingaccuracy', 4], ['jumping', 3], ['strength', 2], ['defensiveawareness', 1]]),
  A('cover', 'Cover Defender', 'Covering', 'CB', 'Reads the game and uses pace to sweep behind the line.', [['interceptions', 3], ['sprintspeed', 2], ['acceleration', 2], ['defensiveawareness', 2], ['reactions', 1]]),
  // Full-backs / wing-backs
  A('attackingfb', 'Attacking Wing-Back', 'Attacking', 'FB', 'Overlaps constantly and delivers from wide.', [['crossing', 3], ['sprintspeed', 2], ['acceleration', 1], ['stamina', 2], ['dribbling', 1], ['shortpassing', 1]]),
  A('defensivefb', 'Defensive Full-Back', 'Defensive', 'FB', 'Stays home, wins the one-v-ones, rarely beaten.', [['standingtackle', 3], ['defensiveawareness', 3], ['slidingtackle', 1], ['interceptions', 2], ['strength', 1]]),
  A('invertedfb', 'Inverted Full-Back', 'Inverted', 'FB', 'Steps into midfield to pass and control tempo.', [['shortpassing', 3], ['vision', 2], ['ballcontrol', 2], ['composure', 2], ['interceptions', 1]]),
  A('tuckedwb', 'Two-Way Wing-Back', 'Two-Way', 'FB', 'Runs the whole flank both ways for ninety minutes.', [['stamina', 3], ['sprintspeed', 2], ['standingtackle', 2], ['crossing', 1], ['interceptions', 1], ['acceleration', 1]]),
  // Defensive midfield
  A('anchor', 'Anchor', 'Anchoring', 'DM', 'Sits, screens the back four and breaks play up.', [['interceptions', 3], ['standingtackle', 3], ['defensiveawareness', 2], ['strength', 1], ['aggression', 1]]),
  A('regista', 'Deep-Lying Playmaker', 'Deep-Lying', 'DM', 'Dictates from deep with range and vision.', [['longpassing', 3], ['vision', 3], ['shortpassing', 2], ['composure', 1], ['ballcontrol', 1]]),
  A('destroyer', 'Destroyer', 'Destroying', 'DM', 'Physical presence who hunts the ball and the man.', [['aggression', 3], ['strength', 3], ['slidingtackle', 2], ['standingtackle', 1], ['stamina', 1]]),
  // Central midfield
  A('boxtobox', 'Box-to-Box', 'Box-to-Box', 'CM', 'Covers every blade of grass; contributes at both ends.', [['stamina', 3], ['standingtackle', 1], ['interceptions', 1], ['shortpassing', 1], ['longshots', 1], ['strength', 1], ['sprintspeed', 1], ['dribbling', 1]]),
  A('playmaker', 'Playmaker', 'Playmaking', 'CM', 'Sees the pass early and executes it.', [['vision', 3], ['shortpassing', 3], ['longpassing', 1], ['ballcontrol', 1], ['composure', 1], ['curve', 1]]),
  A('ballwinner', 'Ball-Winner', 'Ball-Winning', 'CM', 'Wins it back high and often.', [['standingtackle', 3], ['interceptions', 3], ['aggression', 2], ['defensiveawareness', 1], ['stamina', 1]]),
  A('mezzala', 'Mezzala', 'Half-Space', 'CM', 'Drifts into half-spaces, drives with the ball, shoots.', [['dribbling', 3], ['longshots', 2], ['agility', 1], ['acceleration', 1], ['finishing', 1], ['shortpassing', 1], ['ballcontrol', 1]]),
  // Attacking midfield
  A('classic10', 'Classic No.10', 'Creative', 'AM', 'Threads the final pass between the lines.', [['vision', 3], ['shortpassing', 2], ['ballcontrol', 2], ['dribbling', 1], ['curve', 1], ['composure', 1]]),
  A('shadowstriker', 'Shadow Striker', 'Shadow-Striking', 'AM', 'Arrives late in the box and finishes.', [['finishing', 3], ['positioning', 3], ['longshots', 1], ['shotpower', 1], ['reactions', 1], ['acceleration', 1]]),
  A('advplaymaker', 'Roaming Creator', 'Roaming', 'AM', 'Carries the ball through pressure to create.', [['dribbling', 3], ['agility', 2], ['balance', 1], ['ballcontrol', 2], ['vision', 1], ['acceleration', 1]]),
  // Wide players
  A('speedster', 'Speedster', 'Rapid', 'W', 'Beats the full-back for pace and gets to the byline.', [['sprintspeed', 4], ['acceleration', 3], ['crossing', 1], ['dribbling', 1], ['stamina', 1]]),
  A('insideforward', 'Inside Forward', 'Cut-Inside', 'W', 'Cuts in on the strong foot to shoot.', [['finishing', 3], ['longshots', 1], ['curve', 1], ['dribbling', 2], ['positioning', 2], ['shotpower', 1]]),
  A('wideplaymaker', 'Wide Playmaker', 'Wide-Creative', 'W', 'Creates from the touchline rather than dribbling past you.', [['crossing', 3], ['vision', 2], ['shortpassing', 2], ['curve', 1], ['longpassing', 1], ['ballcontrol', 1]]),
  A('trickster', 'Trickster', 'Tricky', 'W', 'Takes players on with skill and balance.', [['dribbling', 3], ['agility', 3], ['balance', 2], ['ballcontrol', 2]]),
  // Strikers
  A('poacher', 'Poacher', 'Poaching', 'ST', 'Lives in the box; one touch and it is in.', [['finishing', 4], ['positioning', 3], ['reactions', 1], ['composure', 1], ['volleys', 1]]),
  A('targetman', 'Target Man', 'Target', 'ST', 'Holds it up, wins headers, brings others in.', [['strength', 3], ['headingaccuracy', 3], ['jumping', 2], ['shotpower', 1], ['ballcontrol', 1]]),
  A('pressingfwd', 'Pressing Forward', 'Pressing', 'ST', 'First line of defence: relentless, aggressive, tireless.', [['stamina', 3], ['aggression', 2], ['sprintspeed', 2], ['standingtackle', 1], ['interceptions', 1], ['finishing', 1]]),
  A('advancedfwd', 'Advanced Forward', 'Running', 'ST', 'Runs the channels in behind and finishes at speed.', [['sprintspeed', 3], ['acceleration', 2], ['finishing', 2], ['positioning', 1], ['dribbling', 1], ['composure', 1]]),
  A('false9', 'False 9', 'Deep-Dropping', 'ST', 'Drops off to link play, creates as much as he scores.', [['vision', 2], ['shortpassing', 2], ['dribbling', 2], ['ballcontrol', 2], ['finishing', 1], ['composure', 1]]),
]

export function groupOf(pos: string): Group {
  if (pos === 'GK') return 'GK'
  if (pos === 'CB') return 'CB'
  if (['LB', 'RB', 'LWB', 'RWB'].includes(pos)) return 'FB'
  if (pos === 'CDM') return 'DM'
  if (pos === 'CM') return 'CM'
  if (pos === 'CAM') return 'AM'
  if (['LM', 'RM', 'LW', 'RW'].includes(pos)) return 'W'
  return 'ST'
}
export const GROUP_LABEL: Record<Group, string> = { GK: 'Goalkeepers', CB: 'Centre-backs', FB: 'Full-backs', DM: 'Defensive midfielders', CM: 'Central midfielders', AM: 'Attacking midfielders', W: 'Wingers', ST: 'Strikers' }

const wavg = (a: Record<string, number>, w: [string, number][]) => w.reduce((s, [k, x]) => s + (a[k] ?? 0) * x, 0) / w.reduce((s, [, x]) => s + x, 0)

// Derived playstyle-like tags (attribute thresholds, not the game's PlayStyle table — that isn't stored in the save).
type TagCtx = { skill: number; height: number; gk: boolean }
// Each tag returns the smallest margin above its thresholds (negative = not earned); tags are shown by margin.
const m = (...xs: number[]) => Math.min(...xs)
const TAGS: [string, (a: Record<string, number>, p: TagCtx) => number][] = [
  ['Finesse Shot', (a, p) => p.gk ? -1 : m(a.curve - 80, a.finishing - 76, a.longshots - 74)],
  ['Power Shot', (a, p) => p.gk ? -1 : m(a.shotpower - 86, a.longshots - 72)],
  ['Rapid', (a, p) => p.gk ? -1 : m(a.sprintspeed - 88, a.acceleration - 85)],
  ['Technical', (a, p) => p.gk ? -1 : m(a.dribbling - 86, a.ballcontrol - 86, a.agility - 78)],
  ['Trickster', (a, p) => p.gk || p.skill < 4 ? -1 : m(a.agility - 82, a.balance - 75)],
  ['Aerial', (a, p) => p.gk ? -1 : m(a.jumping - 82, a.headingaccuracy - 78)],
  ['Bruiser', (a, p) => p.gk ? -1 : m(a.strength - 86, a.aggression - 76)],
  ['Anticipate', (a, p) => p.gk ? -1 : m(a.interceptions - 82, a.standingtackle - 82)],
  ['Jockey', (a, p) => p.gk ? -1 : m(a.defensiveawareness - 84, a.balance - 70, a.agility - 65)],
  ['Relentless', (a, p) => p.gk ? -1 : a.stamina - 90],
  ['Tiki Taka', (a, p) => p.gk ? -1 : m(a.shortpassing - 86, a.vision - 80, a.ballcontrol - 82)],
  ['Long Ball Pass', (a, p) => p.gk ? -1 : m(a.longpassing - 85, a.vision - 78)],
  ['Whipped Pass', (a, p) => p.gk ? -1 : m(a.crossing - 85, a.curve - 78)],
  ['Dead Ball', (a, p) => p.gk ? -1 : Math.max(a.freekickaccuracy - 82, m(a.penalties - 88, a.curve - 75))],
  ['Press Proven', (a, p) => p.gk ? -1 : m(a.composure - 86, a.balance - 78, a.strength - 72)],
  ['Quick Step', (a, p) => p.gk ? -1 : a.acceleration - 90],
  ['Footwork', (a, p) => p.gk ? a.gkkicking - 80 : -1],
  ['Cross Claimer', (a, p) => p.gk ? m(a.gkhandling - 84, a.gkpositioning - 82) : -1],
  ['Far Reach', (a, p) => p.gk && p.height >= 190 ? a.gkdiving - 87 : -1],
  ['Deflector', (a, p) => p.gk ? a.gkreflexes - 88 : -1],
  ['Rush Out', (a, p) => p.gk ? m(a.sprintspeed - 60, a.acceleration - 60, a.gkpositioning - 80) : -1],
]

export type GroupStats = Record<string, { mean: number; sd: number }> // key: `${group}:${archetype id}`

export function rawScores(pos: string, attrs: Record<string, number>): { group: Group; raw: Record<string, number> } {
  const group = groupOf(pos); const raw: Record<string, number> = {}
  for (const a of ARCHETYPES) if (a.group === group) raw[a.id] = wavg(attrs, a.w)
  return { group, raw }
}

/** Population statistics per (position group, archetype) so that labels describe a player's shape relative to peers. */
export function groupStats(items: { group: Group; raw: Record<string, number> }[]): GroupStats {
  const acc: Record<string, number[]> = {}
  for (const it of items) for (const [id, v] of Object.entries(it.raw)) (acc[`${it.group}:${id}`] ??= []).push(v)
  const out: GroupStats = {}
  for (const [k, xs] of Object.entries(acc)) { const mean = xs.reduce((s, x) => s + x, 0) / xs.length; const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length) || 1; out[k] = { mean, sd } }
  return out
}

const COMPLETE: Record<Group, string> = { GK: 'Complete Keeper', CB: 'Complete Defender', FB: 'Complete Full-Back', DM: 'Complete Midfielder', CM: 'Complete Midfielder', AM: 'Complete Playmaker', W: 'Complete Winger', ST: 'Complete Forward' }

export function finalize(group: Group, raw: Record<string, number>, stats: GroupStats, attrs: Record<string, number>, extra: { skill: number; height: number; ovr: number }): ArchetypeResult {
  const z = Object.entries(raw).map(([id, v]) => { const st = stats[`${group}:${id}`]; return { id, v, z: st ? (v - st.mean) / st.sd : 0 } })
  const mean = z.reduce((s, r) => s + r.z, 0) / z.length
  const scored = z.map(r => { const a = ARCHETYPES.find(x => x.id === r.id)!; return { id: r.id, name: a.name, adj: a.adj, score: Math.round(r.v), rel: r.z - mean } }).sort((x, y) => y.rel - x.rel)
  const first = scored[0], second = scored[1]
  const spread = first.rel - (second?.rel ?? -9)
  const allStrong = z.every(r => r.z > 1.0)
  let label = first.name
  if (allStrong && first.rel < 0.3) label = COMPLETE[group]
  else if (second && spread < 0.25) label = `${second.adj} ${first.name}`
  const fit = Math.max(5, Math.min(100, Math.round(55 + first.rel * 30)))
  const gk = group === 'GK'
  const tags = TAGS.map(([n, f]) => [n, f(attrs, { skill: extra.skill, height: extra.height, gk })] as [string, number]).filter(([, v]) => v >= 0).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n]) => n)
  return { id: first.id, name: first.name, label, fit, group, scores: scored.map(({ id, name, score }) => ({ id, name, score })), tags }
}

export const archetypeBlurb = (id: string) => ARCHETYPES.find(a => a.id === id)?.blurb ?? ''
