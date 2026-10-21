import { getCard } from '../../game/index.ts'
import type { CardInstance } from '../../game/index.ts'

export function CardButton({
  card,
  energy,
  onPlay,
}: {
  card: CardInstance
  energy: number
  onPlay: (instanceId: string) => void
}) {
  const definition = getCard(card.definitionId)
  const affordable = definition.cost <= energy
  return (
    <button
      type="button"
      className="card"
      data-instance-id={card.instanceId}
      data-definition-id={card.definitionId}
      data-cost={definition.cost}
      disabled={!affordable}
      title={affordable ? definition.description : '能量不足'}
      onClick={() => onPlay(card.instanceId)}
    >
      <span className="card-cost">{definition.cost}</span>
      <span className="card-kind">{definition.cardType === 'attack' ? '攻击' : '技能'}</span>
      <span className="card-name">{definition.name}</span>
      <span className="card-text">{definition.description}</span>
    </button>
  )
}
