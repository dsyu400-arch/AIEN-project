import { BATTLE_COUNT, currentIntent } from '../../game/index.ts'
import type { GameAction, RunState } from '../../game/index.ts'
import { CardButton } from '../components/CardButton.tsx'
import { PileButton } from '../components/PileButton.tsx'

export function BattleScreen({
  state,
  onAction,
}: {
  state: RunState
  onAction: (action: GameAction) => void
}) {
  const enemy = state.enemy
  if (!enemy) return null
  const intent = currentIntent(enemy)
  const recent = state.log.slice(-6)

  return (
    <section
      className="play-shell"
      data-testid="battle"
      data-energy={state.player.energy}
      data-hp={state.player.hp}
      data-block={state.player.block}
      data-threat={intent.damage * intent.times}
      data-turn={state.turn}
    >
      <header className="battle-top">
        <div className="battle-heading">
          <p className="eyebrow">
            第 {state.battleIndex + 1} / {BATTLE_COUNT} 场
            {enemy.boss ? ' · Boss' : ''}
          </p>
          <button type="button" className="ember-button" onClick={() => onAction({ type: 'endTurn' })}>
            结束回合
          </button>
        </div>
        <div className="fighters">
          <article className="fighter">
            <h2>{enemy.name}</h2>
            <p>生命 {enemy.hp} / {enemy.maxHp}</p>
            <p>护甲 {enemy.block}</p>
            <div className="meter" aria-hidden="true">
              <span style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }} />
            </div>
            <p className="intent">意图 {intent.label}</p>
          </article>
          <article className="fighter">
            <h2>你</h2>
            <p>生命 {state.player.hp} / {state.player.maxHp}</p>
            <p>护甲 {state.player.block}</p>
            <p>能量 {state.player.energy} / {state.player.maxEnergy}</p>
            <p>回合 {state.turn}</p>
          </article>
        </div>
      </header>

      <div className="battle-log" aria-live="polite">
        {recent.length === 0 ? <p>等待出牌</p> : recent.map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}
      </div>

      <footer className="battle-bottom">
        <div className="piles">
          <PileButton label="抽牌堆" cards={state.drawPile} />
          <PileButton label="弃牌堆" cards={state.discardPile} />
          <PileButton label="消耗" cards={state.exhaustPile} />
        </div>
        <div className="hand">
          {state.hand.map((card) => (
            <CardButton
              key={card.instanceId}
              card={card}
              energy={state.player.energy}
              onPlay={(instanceId) => onAction({ type: 'playCard', instanceId })}
            />
          ))}
        </div>
      </footer>
    </section>
  )
}
