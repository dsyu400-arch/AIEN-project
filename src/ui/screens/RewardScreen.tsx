import { useEffect, useState } from 'react'
import { getCard } from '../../game/index.ts'
import type { GameAction, RunState } from '../../game/index.ts'
import { CardFace } from '../components/CardFace.tsx'
import { FLOAT_MS } from '../useCombatPresentation.ts'

export function RewardScreen({
  state,
  onAction,
}: {
  state: RunState
  onAction: (action: GameAction) => void
}) {
  const heal = [...state.log].reverse().find((line) => line.includes('回复'))
  const healAmount = Number(heal?.match(/回复 (\d+) 点生命/)?.[1] ?? 0)
  const [showHeal, setShowHeal] = useState(healAmount > 0)

  useEffect(() => {
    if (!showHeal) return
    const timer = window.setTimeout(() => setShowHeal(false), FLOAT_MS)
    return () => window.clearTimeout(timer)
  }, [showHeal])

  return (
    <main className="play-shell reward-screen" data-testid="reward">
      <header className="reward-heading">
        <p className="eyebrow">第 {state.battleIndex + 1} 场胜利</p>
        <h1>选择一张牌</h1>
      </header>
      <div className="reward-life">
        <p>
          生命 {state.player.hp} / {state.player.maxHp}
          {heal ? `，${heal}` : ''}
        </p>
        {showHeal ? (
          <span className="float-number float-heal" aria-hidden="true">
            +{healAmount}
          </span>
        ) : null}
      </div>
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
