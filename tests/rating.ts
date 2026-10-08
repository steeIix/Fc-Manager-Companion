import assert from 'node:assert/strict'
import { rateTeam, ratingStars, fitAt } from '../src/teamrating'
const P = (id: number, pos: string, ovr: number, positions: string[] = [pos]) => ({ id, pos, ovr, positions, shortName: `P${id}`, name: `P${id}` }) as any
// A full 4-3-3 of 85s with an 85 bench rates exactly 85.
const shape = ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'CDM', 'CM', 'LW', 'ST', 'RW']
const squad = [...shape, ...shape.slice(0, 7)].map((pos, i) => P(i + 1, pos, 85))
const r = rateTeam(squad)
assert.equal(r.score, 85); assert.equal(r.formation, '4-3-3'); assert.equal(r.stars, 4.5)
// Main > secondary > neighbouring > elsewhere; keepers never play outfield.
assert.equal(fitAt(P(1, 'CAM', 80, ['CAM', 'CM']), 'CM').eff, 79)
assert.equal(fitAt(P(1, 'LM', 80), 'LW').eff, 76)
assert.equal(fitAt(P(1, 'ST', 80), 'CB').eff, 68)
assert(fitAt(P(1, 'GK', 90), 'ST').eff < 60)
// Short squads fill empty slots with 50 and are punished for it.
assert(rateTeam(squad.slice(0, 9)).score < 80)
// Two 90s lift a side above one made of the same average without stars.
const flat = rateTeam(shape.map((pos, i) => P(i + 1, pos, 82)))
const peaks = rateTeam(shape.map((pos, i) => P(i + 1, pos, i === 9 ? 92 : i === 8 ? 91 : i === 0 ? 72 : i === 1 ? 73 : 82)))
assert(peaks.score > flat.score)
assert.equal(ratingStars(85.5), 5); assert.equal(ratingStars(81.4), 4)
console.log('rating ok', r.score, flat.score, peaks.score)
