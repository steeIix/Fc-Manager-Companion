// User-supplied names for players the bundled name pool can't resolve. Stored per browser.
const KEY = 'fc26-name-overrides'
export type NameOverrides = Record<string, string>
export function loadOverrides(): NameOverrides { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } }
export function setOverride(id: number, name: string) {
  const o = loadOverrides(); if (name.trim()) o[String(id)] = name.trim(); else delete o[String(id)]
  localStorage.setItem(KEY, JSON.stringify(o))
}
