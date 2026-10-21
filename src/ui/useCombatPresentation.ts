import { useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { getCard } from '../game/index.ts'
import type { CardDefinition, GameAction, RunState } from '../game/index.ts'
import { diffCombat, emptyCue, snapshotOf } from './feedback.ts'
import type { CombatCue, CombatFloat } from './feedback.ts'

export const GHOST_MS = 320
export const FLOAT_MS = 680

export interface GhostOrigin {
  left: number
  top: number
  width: number
  height: number
}

interface GhostView {
  id: string
  attack: boolean
  definition: CardDefinition
  style: CSSProperties
}

interface FloatView extends CombatFloat {
  id: string
  shift: number
}

interface CueView extends CombatCue {
  id: number
}

const presentedStates = new WeakSet<RunState>()

export function useCombatPresentation(state: RunState, onAction: (action: GameAction) => void) {
  const [ghosts, setGhosts] = useState<GhostView[]>([])
  const [floats, setFloats] = useState<FloatView[]>([])
  const [cue, setCue] = useState<CueView>({ id: 0, ...emptyCue() })
  const previous = useRef(snapshotOf(state))
  const serial = useRef(0)
  const timers = useRef<number[]>([])

  useLayoutEffect(() => {
    return () => {
      for (const timer of timers.current) window.clearTimeout(timer)
      timers.current = []
    }
  }, [])

  useLayoutEffect(() => {
    if (presentedStates.has(state)) return
    presentedStates.add(state)
    const next = snapshotOf(state)
    const prev = previous.current
    previous.current = next
    if (!prev || !next) return
    const change = diffCombat(prev, next)
    if (change.floats.length === 0 && !hasCue(change.cue)) return
    const cueId = serial.current + 1
    serial.current = cueId
    const stamped = change.floats.map((float, index) => ({
      ...float,
      id: `float-${cueId}-${index}`,
      shift: index * 18,
    }))
    if (stamped.length > 0) setFloats((current) => [...current, ...stamped])
    setCue({ id: cueId, ...change.cue })
    const floatIds = stamped.map((float) => float.id)
    const timer = window.setTimeout(() => {
      setFloats((current) => current.filter((float) => !floatIds.includes(float.id)))
      setCue((current) => (current.id === cueId ? { id: cueId, ...emptyCue() } : current))
    }, FLOAT_MS)
    timers.current.push(timer)
  }, [state])

  function playCard(instanceId: string, origin: GhostOrigin) {
    const card = state.hand.find((item) => item.instanceId === instanceId)
    onAction({ type: 'playCard', instanceId })
    if (!card) return
    const definition = getCard(card.definitionId)
    if (definition.cost > state.player.energy) return
    const attack = definition.cardType === 'attack'
    const id = `ghost-${serial.current}`
    serial.current += 1
    const motion = attack ? attackVector(origin) : { x: 0, y: 0 }
    const view: GhostView = { id, attack, definition, style: withMotion(origin, motion) }
    setGhosts((current) => [...current, view])
    const timer = window.setTimeout(() => dismissGhost(id), GHOST_MS)
    timers.current.push(timer)
  }

  function dismissGhost(id: string) {
    setGhosts((current) => current.filter((ghost) => ghost.id !== id))
  }

  return { ghosts, floats, cue, playCard, dismissGhost }
}

function hasCue(cue: CombatCue): boolean {
  return Object.values(cue).some(Boolean)
}

function attackVector(origin: GhostOrigin): { x: number; y: number } {
  const emblem = document.querySelector('.emblem')?.getBoundingClientRect()
  if (!emblem || emblem.width === 0 || emblem.height === 0) return { x: 160, y: -180 }
  const fromX = origin.left + origin.width / 2
  const fromY = origin.top + origin.height / 2
  return {
    x: emblem.left + emblem.width / 2 - fromX,
    y: emblem.top + emblem.height / 2 - fromY,
  }
}

function withMotion(origin: GhostOrigin, motion: { x: number; y: number }): CSSProperties {
  return {
    left: `${origin.left}px`,
    top: `${origin.top}px`,
    width: `${Math.max(origin.width, 1)}px`,
    height: `${Math.max(origin.height, 1)}px`,
    ['--ghost-x' as string]: `${motion.x}px`,
    ['--ghost-y' as string]: `${motion.y}px`,
  }
}
