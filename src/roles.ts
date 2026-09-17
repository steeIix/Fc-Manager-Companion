// FC 26 player roles as stored in the save's players table (role1..role5).
//
// The ID space is position-scoped, in the order EA lists the roles for each position, with FC 26's
// four new roles appended at 45-49. A value of ID + 100 means the player holds that role at ++
// ("world class in that role"); a plain ID means +. Verified against the players EA/press name as
// ++ examples: Alisson and Maignan hold 145 (Ball-Playing Keeper++), Rice 149 (Box Crasher++),
// Tomori and Pavard 48 (Wide Back+), Lewis-Skelly 47 (Inverted Wingback+).

export interface RoleDef { id: number; name: string; pos: string; short: string }
const R = (id: number, name: string, pos: string, short: string): RoleDef => ({ id, name, pos, short })

export const ROLES: RoleDef[] = [
  R(1, 'Goalkeeper', 'GK', 'GK'), R(2, 'Sweeper Keeper', 'GK', 'SK'), R(45, 'Ball-Playing Keeper', 'GK', 'BPK'),
  R(3, 'Fullback', 'RB', 'FB'), R(4, 'Falseback', 'RB', 'FLB'), R(5, 'Wingback', 'RB', 'WB'), R(6, 'Attacking Wingback', 'RB', 'AWB'), R(46, 'Inverted Wingback', 'RB', 'IWB'),
  R(7, 'Fullback', 'LB', 'FB'), R(8, 'Falseback', 'LB', 'FLB'), R(9, 'Wingback', 'LB', 'WB'), R(10, 'Attacking Wingback', 'LB', 'AWB'), R(47, 'Inverted Wingback', 'LB', 'IWB'),
  R(11, 'Defender', 'CB', 'DEF'), R(12, 'Stopper', 'CB', 'STP'), R(13, 'Ball-Playing Defender', 'CB', 'BPD'), R(48, 'Wide Back', 'CB', 'WCB'),
  R(14, 'Holding', 'CDM', 'HLD'), R(15, 'Centre-Half', 'CDM', 'CH'), R(16, 'Deep-Lying Playmaker', 'CDM', 'DLP'), R(17, 'Wide Half', 'CDM', 'WH'), R(49, 'Box Crasher', 'CDM', 'BXC'),
  R(18, 'Box-to-Box', 'CM', 'B2B'), R(19, 'Holding', 'CM', 'HLD'), R(20, 'Deep-Lying Playmaker', 'CM', 'DLP'), R(21, 'Playmaker', 'CM', 'PM'), R(22, 'Half-Winger', 'CM', 'HW'),
  R(23, 'Winger', 'RM', 'WNG'), R(24, 'Wide Midfielder', 'RM', 'WM'), R(25, 'Inside Forward', 'RM', 'IF'), R(26, 'Wide Playmaker', 'RM', 'WPM'),
  R(27, 'Winger', 'LM', 'WNG'), R(28, 'Wide Midfielder', 'LM', 'WM'), R(29, 'Inside Forward', 'LM', 'IF'), R(30, 'Wide Playmaker', 'LM', 'WPM'),
  R(31, 'Playmaker', 'CAM', 'PM'), R(32, 'Shadow Striker', 'CAM', 'SS'), R(33, 'Half-Winger', 'CAM', 'HW'), R(34, 'Classic Ten', 'CAM', '10'),
  R(35, 'Winger', 'RW', 'WNG'), R(36, 'Inside Forward', 'RW', 'IF'), R(37, 'Wide Playmaker', 'RW', 'WPM'),
  R(38, 'Winger', 'LW', 'WNG'), R(39, 'Inside Forward', 'LW', 'IF'), R(40, 'Wide Playmaker', 'LW', 'WPM'),
  R(41, 'Advanced Forward', 'ST', 'AF'), R(42, 'Poacher', 'ST', 'PCH'), R(43, 'False Nine', 'ST', 'F9'), R(44, 'Target Forward', 'ST', 'TF'),
]
const BY_ID = new Map(ROLES.map(r => [r.id, r]))

export interface PlayerRole { id: number; name: string; pos: string; positions: string[]; short: string; level: '+' | '++' }

/**
 * Decode role1..role5. Values over 100 are the same role held at ++.
 * The same role can appear for two positions (Winger at LM and at RW); those are merged into one
 * entry listing both positions, keeping the better familiarity.
 */
export function decodeRoles(raw: number[]): PlayerRole[] {
  const byName = new Map<string, PlayerRole>()
  for (const v of raw) {
    if (!v) continue
    const id = v > 100 ? v - 100 : v
    const def = BY_ID.get(id)
    if (!def) continue
    const level: '+' | '++' = v > 100 ? '++' : '+'
    const cur = byName.get(def.name)
    if (!cur) byName.set(def.name, { ...def, positions: [def.pos], level })
    else {
      if (!cur.positions.includes(def.pos)) cur.positions.push(def.pos)
      if (level === '++') cur.level = '++'
    }
  }
  // A ++ role is the player's speciality, so list those first.
  return Array.from(byName.values()).sort((a, b) => (b.level === '++' ? 1 : 0) - (a.level === '++' ? 1 : 0))
}

/** Unique role names for filtering (Winger at LM and RW is one choice). */
export const ROLE_NAMES = Array.from(new Set(ROLES.map(r => r.name))).sort()
