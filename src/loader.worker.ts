/// <reference lib="webworker" />
// Decodes a save and builds the world off the main thread, so the page stays responsive while a
// 15 MB career file is read. The result is structured-cloned back (shared references survive).
import { parseSave, type Meta } from './parser'
import { buildWorld, type Names, type ValueModel } from './model'

let assets: Promise<{ meta: Meta; names: Names; nations: Record<string, string>; vm: ValueModel }> | null = null
const loadAssets = () => assets ??= Promise.all(['meta', 'names', 'nations', 'valuemodel'].map(n => fetch(`/data/${n}.json`).then(r => { if (!r.ok) throw new Error(`Could not load ${n}.json`); return r.json() })))
  .then(([meta, names, nations, vm]) => ({ meta, names, nations, vm }))

self.onmessage = async (e: MessageEvent<{ id: number; buf: ArrayBuffer; overrides: Record<string, string> }>) => {
  const { id, buf, overrides } = e.data
  try {
    const a = await loadAssets()
    postMessage({ id, stage: 'Decoding databases…' })
    const tables = parseSave(buf, a.meta)
    if (!tables.players?.length) throw new Error('No player table was found in this save.')
    postMessage({ id, stage: 'Building players and clubs…' })
    const world = buildWorld(tables, a.names, a.nations, a.vm, overrides)
    postMessage({ id, stage: 'Opening…' })
    postMessage({ id, world })
  } catch (err) {
    assets = null
    postMessage({ id, error: err instanceof Error ? err.message : String(err) })
  }
}
