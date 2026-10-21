import type { RunState } from '../../game/index.ts'
import '../styles/title.css'

export function ResultScreen({ state, onRestart }: { state: RunState; onRestart: () => void }) {
  const victory = state.phase === 'victory'
  return (
    <main className="title-screen" data-testid="result" data-phase={state.phase}>
      <p className="eyebrow">{victory ? '通关' : '失败'}</p>
      <h1>{victory ? '你登上了塔顶' : '你倒下了'}</h1>
      <p className="lede">
        {victory
          ? `三场试炼结束，剩余生命 ${state.player.hp}。`
          : `止步于第 ${state.battleIndex + 1} 场，剩余生命 ${state.player.hp}。`}
      </p>
      <button type="button" className="ember-button" onClick={onRestart}>
        重新开始
      </button>
    </main>
  )
}
