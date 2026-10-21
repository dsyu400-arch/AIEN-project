import { BATTLE_COUNT, currentIntent } from '../../game/index.ts'
import type { GameAction, RunState } from '../../game/index.ts'
import { CardButton } from '../components/CardButton.tsx'
import { EnemyEmblem } from '../components/EnemyEmblem.tsx'
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
  const { player } = state

  return (
    <section
      className="play-shell battle-screen"
      data-testid="battle"
      data-energy={player.energy}
      data-hp={player.hp}
      data-block={player.block}
      data-threat={intent.damage * intent.times}
      data-turn={state.turn}
    >
      <div className="battle-column">
        <header className="battle-heading">
          <p className="eyebrow">
            第 {state.battleIndex + 1} / {BATTLE_COUNT} 场
            {enemy.boss ? ' · Boss' : ''}
          </p>
          <button type="button" className="ember-button" onClick={() => onAction({ type: 'endTurn' })}>
            结束回合
          </button>
        </header>

        <div className="battle-stage">
          <div className="fighters">
            <article className="fighter fighter-player">
              <h2>你</h2>
              <p>生命 {player.hp} / {player.maxHp}</p>
              <LifeMeter hp={player.hp} maxHp={player.maxHp} tone="player" />
              <p className="armor-line" data-ready={player.block > 0 ? 'true' : 'false'}>
                护甲 {player.block}
              </p>
              <p>能量 {player.energy} / {player.maxEnergy}</p>
              <EnergyPips energy={player.energy} maxEnergy={player.maxEnergy} />
              <p className="turn-line">回合 {state.turn}</p>
            </article>
            <article className={`fighter fighter-enemy${enemy.boss ? ' fighter-boss' : ''}`}>
              <EnemyEmblem id={enemy.id} boss={enemy.boss} />
              <h2>{enemy.name}</h2>
              <p>生命 {enemy.hp} / {enemy.maxHp}</p>
              <LifeMeter hp={enemy.hp} maxHp={enemy.maxHp} tone="enemy" />
              <p className="armor-line" data-ready={enemy.block > 0 ? 'true' : 'false'}>
                护甲 {enemy.block}
              </p>
              <p className={`intent intent-${intent.kind}`}>意图 {intent.label}</p>
            </article>
          </div>
          <div className="battle-log" aria-live="polite">
            {recent.length === 0 ? <p>等待出牌</p> : recent.map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}
          </div>
        </div>

        <footer className="battle-bottom">
          <div className="piles">
            <PileButton label="抽牌堆" cards={state.drawPile} />
            <PileButton label="弃牌堆" cards={state.discardPile} />
            <PileButton label="消耗" cards={state.exhaustPile} />
          </div>
          <div className="hand-scroller">
            <div className="hand" data-count={state.hand.length}>
              {state.hand.map((card) => (
                <CardButton
                  key={card.instanceId}
                  card={card}
                  energy={player.energy}
                  onPlay={(instanceId) => onAction({ type: 'playCard', instanceId })}
                />
              ))}
            </div>
          </div>
        </footer>
      </div>
    </section>
  )
}

function LifeMeter({ hp, maxHp, tone }: { hp: number; maxHp: number; tone: 'player' | 'enemy' }) {
  const ratio = maxHp === 0 ? 0 : Math.max(0, Math.min(1, hp / maxHp))
  const low = ratio > 0 && ratio <= 0.3
  return (
    <div className={`meter meter-${tone}${low ? ' meter-low' : ''}`} aria-hidden="true">
      <span style={{ width: `${ratio * 100}%` }} />
    </div>
  )
}

function EnergyPips({ energy, maxEnergy }: { energy: number; maxEnergy: number }) {
  const slots = Math.max(energy, maxEnergy, 1)
  return (
    <div className="energy-pips" aria-hidden="true">
      {Array.from({ length: slots }, (_, index) => (
        <span key={index} className={index < energy ? 'pip pip-on' : 'pip'} />
      ))}
    </div>
  )
}
