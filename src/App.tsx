import { useReducer } from 'react'
import { applyAction, createRun } from './game/index.ts'
import type { GameAction, RunState } from './game/index.ts'
import { BattleScreen } from './ui/screens/BattleScreen.tsx'
import { ResultScreen } from './ui/screens/ResultScreen.tsx'
import { RewardScreen } from './ui/screens/RewardScreen.tsx'
import { StartScreen } from './ui/screens/StartScreen.tsx'
import './ui/styles/play.css'

function reduce(state: RunState, action: GameAction): RunState {
  return applyAction(state, action).state
}

function createInitialState(seed: number | undefined): RunState {
  return createRun(seed ?? Date.now())
}

export default function App({ seed }: { seed?: number }) {
  const [state, dispatch] = useReducer(reduce, seed, createInitialState)

  return (
    <div className="run-root" data-testid="run" data-phase={state.phase}>
      {state.phase === 'menu' ? <StartScreen onStart={() => dispatch({ type: 'startRun' })} /> : null}
      {state.phase === 'playerTurn' ? <BattleScreen state={state} onAction={dispatch} /> : null}
      {state.phase === 'reward' ? <RewardScreen state={state} onAction={dispatch} /> : null}
      {state.phase === 'victory' || state.phase === 'defeat' ? (
        <ResultScreen state={state} onRestart={() => dispatch({ type: 'restart' })} />
      ) : null}
    </div>
  )
}
