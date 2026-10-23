import { useState } from 'react'
import { describeStatus } from '../../game/index.ts'
import type { StatusInstance } from '../../game/index.ts'

export function StatusList({ label, statuses }: { label: string; statuses: readonly StatusInstance[] }) {
  if (statuses.length === 0) return null
  return (
    <ul className="status-list" aria-label={label}>
      {statuses.map((status) => (
        <StatusChip key={status.id} status={status} />
      ))}
    </ul>
  )
}

function StatusChip({ status }: { status: StatusInstance }) {
  const view = describeStatus(status)
  const [open, setOpen] = useState(false)
  return (
    <li className={`status-chip status-${view.polarity}`}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span className="status-name">{view.name}</span>
        <span className="status-amount">{view.amountLabel}</span>
      </button>
      {open ? <p className="status-detail">{view.detail}</p> : null}
    </li>
  )
}
