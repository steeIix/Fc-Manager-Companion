import type { TableHTMLAttributes } from 'react'
/** Scroll the container, preserving one shared column layout for head and body. */
export function Table(props: TableHTMLAttributes<HTMLTableElement>) {
  return <div className="table-container" tabIndex={0} role="region" aria-label="Scrollable data table"><table {...props} /></div>
}
