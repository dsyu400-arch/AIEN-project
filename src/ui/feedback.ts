import type { RunState } from '../game/index.ts'

export interface CombatSnapshot {
  turn: number
  playerHp: number
  playerBlock: number
  playerEnergy: number
  enemyHp: number
  enemyBlock: number
}

export type FloatKind = 'hurt' | 'block' | 'heal' | 'energy'
export type FloatTarget = 'player' | 'enemy'

export interface CombatFloat {
  target: FloatTarget
  kind: FloatKind
  text: string
}

export interface CombatCue {
  enemyFlash: boolean
  enemyShake: boolean
  enemyActing: boolean
  playerFlash: boolean
  playerBlockPulse: boolean
  enemyBlockPulse: boolean
  energyPulse: boolean
}

export function snapshotOf(state: RunState): CombatSnapshot | null {
  if (state.phase !== 'playerTurn' || state.enemy === null) return null
  return {
    turn: state.turn,
    playerHp: state.player.hp,
    playerBlock: state.player.block,
    playerEnergy: state.player.energy,
    enemyHp: state.enemy.hp,
    enemyBlock: state.enemy.block,
  }
}

export function emptyCue(): CombatCue {
  return {
    enemyFlash: false,
    enemyShake: false,
    enemyActing: false,
    playerFlash: false,
    playerBlockPulse: false,
    enemyBlockPulse: false,
    energyPulse: false,
  }
}

export function diffCombat(prev: CombatSnapshot, next: CombatSnapshot): { floats: CombatFloat[]; cue: CombatCue } {
  const floats: CombatFloat[] = []
  const cue = emptyCue()
  const enemyHpLoss = prev.enemyHp - next.enemyHp
  const playerHpLoss = prev.playerHp - next.playerHp
  const playerHpGain = next.playerHp - prev.playerHp
  const playerBlockGain = next.playerBlock - prev.playerBlock
  const enemyBlockGain = next.enemyBlock - prev.enemyBlock
  const energyGain = next.playerEnergy - prev.playerEnergy

  if (enemyHpLoss > 0) {
    floats.push({ target: 'enemy', kind: 'hurt', text: `-${enemyHpLoss}` })
    cue.enemyShake = true
    cue.enemyFlash = true
  }
  if (next.enemyBlock < prev.enemyBlock) {
    cue.enemyFlash = true
    cue.enemyBlockPulse = true
  }
  if (enemyBlockGain > 0) {
    floats.push({ target: 'enemy', kind: 'block', text: `+${enemyBlockGain}` })
    cue.enemyBlockPulse = true
  }
  if (playerHpLoss > 0) {
    floats.push({ target: 'player', kind: 'hurt', text: `-${playerHpLoss}` })
    cue.playerFlash = true
  }
  if (playerHpGain > 0) {
    floats.push({ target: 'player', kind: 'heal', text: `+${playerHpGain}` })
  }
  if (playerBlockGain > 0) {
    floats.push({ target: 'player', kind: 'block', text: `+${playerBlockGain}` })
    cue.playerBlockPulse = true
  } else if (next.playerBlock !== prev.playerBlock) {
    cue.playerBlockPulse = true
  }
  if (energyGain > 0) {
    floats.push({ target: 'player', kind: 'energy', text: `+${energyGain}` })
    cue.energyPulse = true
  }
  if (next.turn !== prev.turn) cue.enemyActing = true
  return { floats, cue }
}
