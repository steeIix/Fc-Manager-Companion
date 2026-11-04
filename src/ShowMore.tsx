import { useEffect, useState } from 'react'
/** Render long lists in chunks: big tables are the main rendering cost, and most people read the top. */
export function useShowMore<T>(rows: T[], step = 75) {
  const [n, setN] = useState(step)
  useEffect(() => setN(step), [rows, step])
  const more = rows.length > n
    ? <div className="show-more"><button className="btn" onClick={() => setN(x => x + step * 2)}>Show {Math.min(step * 2, rows.length - n)} more</button><span className="dim">{n} of {rows.length.toLocaleString()} shown</span></div>
    : null
  return { visible: rows.slice(0, n), more }
}
