import { getCard } from '../../game/index.ts'
import type { GameAction, RunState } from '../../game/index.ts'
import { CardFace } from '../components/CardFace.tsx'

export function RewardScreen({
  state,
  onAction,
}: {
  state: RunState
  onAction: (action: GameAction) => void
}) {
  const heal = [...state.log].reverse().find((line) => line.includes('回复'))

  return (
    <main className="play-shell reward-screen" data-testid="reward">
      <p className="eyebrow">第 {state.battleIndex + 1} 场胜利</p>
      <h1>选择一张牌</h1>
      <p>
        生命 {state.player.hp} / {state.player.maxHp}
        {heal ? `，${heal}` : ''}
      </p>
      <div className="reward-choices">
        {state.rewardOptions.map((id) => {
          const definition = getCard(id)
          return (
            <button
              key={id}
              type="button"
              className={`card card-${definition.cardType}`}
              data-reward="true"
              data-definition-id={id}
              aria-label={`选择${definition.name}`}
              onClick={() => onAction({ type: 'chooseReward', definitionId: id })}
            >
              <CardFace definition={definition} />
            </button>
          )
        })}
      </div>
    </main>
  )
}
