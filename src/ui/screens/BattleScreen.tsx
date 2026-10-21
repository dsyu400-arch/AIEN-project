import { BATTLE_COUNT, currentIntent } from '../../game/index.ts'
import type { GameAction, RunState } from '../../game/index.ts'
import { CardButton } from '../components/CardButton.tsx'
import { CardFace } from '../components/CardFace.tsx'
import { EnemyEmblem } from '../components/EnemyEmblem.tsx'
import { PileButton } from '../components/PileButton.tsx'
import { useCombatPresentation } from '../useCombatPresentation.ts'
import type { CombatFloat } from '../feedback.ts'

export function BattleScreen({
  state,
  onAction,
}: {
  state: RunState
  onAction: (action: GameAction) => void
}) {
  const presentation = useCombatPresentation(state, onAction)
  const enemy = state.enemy
  if (!enemy) return null
  const intent = currentIntent(enemy)
  const recent = state.log.slice(-6)
  const { player } = state
  const { cue, floats, ghosts } = presentation
  const enemyFloats = floats.filter((float) => float.target === 'enemy')
  const playerFloats = floats.filter((float) => float.target === 'player')

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
          <article className={classNames('fighter fighter-player', cue.playerFlash && 'is-hit', cue.energyPulse && 'is-energized')}>
            <FloatLayer floats={playerFloats} />
            <h2>你</h2>
            <p>生命 {player.hp} / {player.maxHp}</p>
            <LifeMeter hp={player.hp} maxHp={player.maxHp} tone="player" />
            <p className={classNames('armor-line', cue.playerBlockPulse && 'is-pulsing')} data-ready={player.block > 0 ? 'true' : 'false'}>
              护甲 {player.block}
            </p>
            <p>能量 {player.energy} / {player.maxEnergy}</p>
            <EnergyPips energy={player.energy} maxEnergy={player.maxEnergy} energized={cue.energyPulse} />
            <p className="turn-line">回合 {state.turn}</p>
          </article>
          <article
            className={classNames(
              'fighter fighter-enemy',
              enemy.boss && 'fighter-boss',
              cue.enemyFlash && 'is-hit',
              cue.enemyShake && 'is-shaken',
              cue.enemyActing && 'is-acting',
            )}
          >
            <FloatLayer floats={enemyFloats} />
            <div className={classNames('enemy-figure', ghosts.some((ghost) => ghost.attack) && 'has-trail')}>
              <EnemyEmblem id={enemy.id} boss={enemy.boss} />
              <span className="attack-trail" />
            </div>
            <div className="enemy-readout">
              <h2>{enemy.name}</h2>
              <p>生命 {enemy.hp} / {enemy.maxHp}</p>
              <LifeMeter hp={enemy.hp} maxHp={enemy.maxHp} tone="enemy" />
              <p className={classNames('armor-line', cue.enemyBlockPulse && 'is-pulsing')} data-ready={enemy.block > 0 ? 'true' : 'false'}>
                护甲 {enemy.block}
              </p>
              <p className={`intent intent-${intent.kind}`}>意图 {intent.label}</p>
            </div>
          </article>
          <div className="battle-log" aria-live="polite">
            {recent.length === 0 ? <p>等待出牌</p> : recent.map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}
          </div>
          <div className={classNames('battle-field', ghosts.some((ghost) => ghost.attack) && 'has-trail')} aria-hidden="true">
            <FieldMark />
            <span className="attack-trail" />
            <span className="ember-mote mote-a" />
            <span className="ember-mote mote-b" />
            <span className="ember-mote mote-c" />
            <span className="ember-mote mote-d" />
            <span className="ember-mote mote-e" />
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
                  onPlay={presentation.playCard}
                />
              ))}
            </div>
          </div>
        </footer>
      </div>
      {ghosts.map((ghost) => (
        <div
          key={ghost.id}
          className={ghost.attack ? 'card-ghost card-ghost-attack' : 'card-ghost card-ghost-skill'}
          style={ghost.style}
          aria-hidden="true"
          onAnimationEnd={() => presentation.dismissGhost(ghost.id)}
        >
          <CardFace definition={ghost.definition} />
        </div>
      ))}
    </section>
  )
}

function classNames(...names: Array<string | false>): string {
  return names.filter(Boolean).join(' ')
}

function FloatLayer({ floats }: { floats: Array<CombatFloat & { id: string; shift: number }> }) {
  if (floats.length === 0) return null
  return (
    <div className="float-layer" aria-hidden="true">
      {floats.map((float) => (
        <span key={float.id} className={`float-number float-${float.kind}`} style={{ ['--shift' as string]: `${float.shift}px` }}>
          {float.text}
        </span>
      ))}
    </div>
  )
}

function FieldMark() {
  return (
    <svg className="field-mark" viewBox="0 0 360 160" preserveAspectRatio="xMidYMax meet" focusable="false">
      <path d="M168 118V42h12v28h10V24h14v46h10v48" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M186 24l8-14 8 14" fill="currentColor" />
      <path d="M20 132l28-24 22 14 26-20 24 18 30-16 34 16 28-12 36 10 40-8v28H20z" fill="currentColor" opacity="0.35" />
      <path d="M48 132h36l12 20H58zM250 124h48l16 28h-52z" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M24 148h312" stroke="currentColor" strokeWidth="1" />
    </svg>
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

function EnergyPips({ energy, maxEnergy, energized }: { energy: number; maxEnergy: number; energized: boolean }) {
  const slots = Math.max(energy, maxEnergy, 1)
  return (
    <div className={energized ? 'energy-pips is-energized' : 'energy-pips'} aria-hidden="true">
      {Array.from({ length: slots }, (_, index) => (
        <span key={index} className={index < energy ? 'pip pip-on' : 'pip'} />
      ))}
    </div>
  )
}
