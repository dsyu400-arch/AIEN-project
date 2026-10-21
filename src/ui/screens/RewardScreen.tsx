import { getCard } from '../../game/index.ts'
import type { GameAction, RunState } from '../../game/index.ts'

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
      <div className="hand">
        {state.rewardOptions.map((id) => {
          const definition = getCard(id)
          return (
            <button
              key={id}
              type="button"
              className="card"
              data-reward="true"
              data-definition-id={id}
              aria-label={`选择${definition.name}`}
              onClick={() => onAction({ type: 'chooseReward', definitionId: id })}
            >
              <span className="card-cost">{definition.cost}</span>
              <span className="card-kind">{definition.cardType === 'attack' ? '攻击' : '技能'}</span>
              <span className="card-name">{definition.name}</span>
              <span className="card-text">{definition.description}</span>
            </button>
          )
        })}
      </div>
    </main>
  )
}
