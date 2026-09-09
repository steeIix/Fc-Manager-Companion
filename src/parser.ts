// Decodes the EA "fifa_ng_db" (T3DB) databases embedded in an FC 26 career save (FBCHUNKS container).
export type Row = Record<string, number | string>
export type Meta = { tables: Record<string, string>; fields: Record<string, Record<string, [string, number]>> }

const DB_SIG = [0x44, 0x42, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00]

function findSig(d: Uint8Array, from: number): number {
  outer: for (let i = from; i <= d.length - 8; i++) {
    if (d[i] !== 0x44 || d[i + 1] !== 0x42) continue
    for (let k = 2; k < 8; k++) if (d[i + k] !== DB_SIG[k]) continue outer
    return i
  }
  return -1
}

function readBits(d: Uint8Array, pos: number, bitOff: number, depth: number): number {
  let byte = pos + (bitOff >> 3), sb = bitOff & 7, v = 0, got = 0
  while (got < depth) {
    const b = d[byte], take = Math.min(8 - sb, depth - got)
    v += ((b >> sb) & ((1 << take) - 1)) * 2 ** got
    got += take; sb = 0; byte++
  }
  return v
}

const td = new TextDecoder('utf-8')

export function parseSave(buf: ArrayBuffer, meta: Meta): Record<string, Row[]> {
  const d = new Uint8Array(buf)
  const dv = new DataView(buf)
  const out: Record<string, Row[]> = {}
  let off = 0
  while (true) {
    const i = findSig(d, off)
    if (i < 0) break
    const size = dv.getUint32(i + 8, true)
    const base = i
    off = i + size
    const tc = dv.getUint32(base + 16, true)
    let p = base + 24
    const ents: [string, number][] = []
    for (let t = 0; t < tc; t++) { ents.push([td.decode(d.subarray(p, p + 4)), dv.getUint32(p + 4, true)]); p += 8 }
    p += 4
    const start = p
    for (const [short, o] of ents) {
      const name = meta.tables[short]
      if (!name) continue
      let q = start + o + 4
      const rs = dv.getUint32(q, true); q += 14
      const vr = dv.getUint16(q, true); q += 6
      const fc = d[q]; q += 12
      const fm = meta.fields[name] || {}
      const fl: { t: number; bo: number; n: string; bd: number; rl: number }[] = []
      for (let f = 0; f < fc; f++) {
        const t = dv.getUint32(q, true), bo = dv.getUint32(q + 4, true)
        const fs = td.decode(d.subarray(q + 8, q + 12)), bd = dv.getUint32(q + 12, true)
        q += 16
        const m = fm[fs]
        fl.push({ t, bo, n: m ? m[0] : fs, bd, rl: m ? m[1] : 0 })
      }
      const rows: Row[] = []
      for (let r = 0; r < vr; r++) {
        const rp = q + r * rs
        const rec: Row = {}
        for (const f of fl) {
          if (f.t === 0) {
            const b = rp + (f.bo >> 3), max = b + (f.bd >> 3)
            let e = b; while (e < max && d[e] !== 0) e++
            rec[f.n] = td.decode(d.subarray(b, e))
          } else if (f.t === 4) rec[f.n] = dv.getFloat32(rp + (f.bo >> 3), true)
          else rec[f.n] = readBits(d, rp, f.bo, f.bd) + f.rl
        }
        rows.push(rec)
      }
      out[name] = rows
    }
  }
  return out
}

export function isCareerSave(buf: ArrayBuffer): boolean {
  const d = new Uint8Array(buf, 0, Math.min(8, buf.byteLength))
  return td.decode(d) === 'FBCHUNKS' && findSig(new Uint8Array(buf), 0) >= 0
}
