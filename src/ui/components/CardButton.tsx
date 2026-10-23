import { attackPreviewLabel, getCard } from '../../game/index.ts'
import type { CardInstance, Combatant, Player } from '../../game/index.ts'
import { CardFace } from './CardFace.tsx'

export function CardButton({
  card,
  energy,
  attacker,
  defender,
  onPlay,
}: {
  card: CardInstance
  energy: number
  attacker: Player
  defender: Combatant
  onPlay: (instanceId: string, origin: DOMRect) => void
}) {
  const definition = getCard(card.definitionId)
  const affordable = definition.cost <= energy
  const hitLabel = attackPreviewLabel(definition, attacker, defender)
  return (
    <button
      type="button"
      className={`card card-${definition.cardType}`}
      data-instance-id={card.instanceId}
      data-definition-id={card.definitionId}
      data-cost={definition.cost}
      data-hit={hitLabel ?? ''}
      disabled={!affordable}
      title={affordable ? [definition.description, hitLabel].filter(Boolean).join(' ') : '能量不足'}
      onClick={(event) => onPlay(card.instanceId, event.currentTarget.getBoundingClientRect())}
    >
      <CardFace definition={definition} hitLabel={hitLabel} />
    </button>
  )
}
