import { useState } from 'react'
import { getCard } from '../../game/index.ts'
import type { CardInstance } from '../../game/index.ts'

export function PileButton({ label, cards }: { label: string; cards: readonly CardInstance[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="pile-button" onClick={() => setOpen(true)}>
        {label} {cards.length}
      </button>
      {open ? (
        <div className="pile-layer" role="dialog" aria-label={label}>
          <div className="pile-panel">
            <h2>{label}</h2>
            {cards.length === 0 ? (
              <p>没有卡牌</p>
            ) : (
              <ul className="pile-list">
                {cards.map((card) => (
                  <li key={card.instanceId}>{getCard(card.definitionId).name}</li>
                ))}
              </ul>
            )}
            <button type="button" className="ember-button" onClick={() => setOpen(false)}>
              关闭
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
