import type { World } from './model'

let worker: Worker | null = null, seq = 0
/** Build a World from a save in a Web Worker; resolves null if workers are unavailable (caller falls back). */
export function buildInWorker(buf: ArrayBuffer, overrides: Record<string, string>, onStage: (s: string) => void): Promise<World> | null {
  try { worker ??= new Worker(new URL('./loader.worker.ts', import.meta.url), { type: 'module' }) } catch { return null }
  const w = worker, id = ++seq
  return new Promise((resolve, reject) => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.id !== id) return
      if (e.data.stage) { onStage(e.data.stage); return }
      w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr)
      if (e.data.error) reject(new Error(e.data.error)); else resolve(e.data.world as World)
    }
    const onErr = (e: ErrorEvent) => { w.removeEventListener('message', onMsg); w.removeEventListener('error', onErr); worker = null; reject(new Error(e.message || 'The save reader stopped unexpectedly.')) }
    w.addEventListener('message', onMsg); w.addEventListener('error', onErr)
    w.postMessage({ id, buf: buf.slice(0), overrides })
  })
}
