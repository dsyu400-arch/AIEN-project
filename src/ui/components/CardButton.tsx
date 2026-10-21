import { getCard } from '../../game/index.ts'
import type { CardInstance } from '../../game/index.ts'
import { CardFace } from './CardFace.tsx'

export function CardButton({
  card,
  energy,
  onPlay,
}: {
  card: CardInstance
  energy: number
  onPlay: (instanceId: string, origin: DOMRect) => void
}) {
  const definition = getCard(card.definitionId)
  const affordable = definition.cost <= energy
  return (
    <button
      type="button"
      className={`card card-${definition.cardType}`}
      data-instance-id={card.instanceId}
      data-definition-id={card.definitionId}
      data-cost={definition.cost}
      disabled={!affordable}
      title={affordable ? definition.description : '能量不足'}
      onClick={(event) => onPlay(card.instanceId, event.currentTarget.getBoundingClientRect())}
    >
      <CardFace definition={definition} />
    </button>
  )
}
