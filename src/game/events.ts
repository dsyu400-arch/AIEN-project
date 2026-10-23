import { EVENT_BUFFER_LIMIT } from './constants.ts'
import type { ActorRef, CombatEvent } from './types.ts'
import type { StatusChange } from './status.ts'

type StripId<T> = T extends unknown ? Omit<T, 'id'> : never

export type CombatEventDraft = StripId<CombatEvent>

export interface EventLogState {
  eventSeq: number
  events: CombatEvent[]
  log: string[]
}

export function formatEventLog(event: CombatEvent): string | null {
  switch (event.type) {
    case 'cardPlayed':
      return `打出${event.name}`
    case 'damageEffect':
      return `${event.name}造成 ${event.amount} 点伤害，共 ${event.times} 次`
    case 'blockGained':
      return event.logged ? `${event.name}获得 ${event.amount} 点护甲` : null
    case 'energyGained':
      return `${event.name}获得 ${event.amount} 点能量`
    case 'selfDamage':
      return `${event.name}对自己造成 ${event.amount} 点伤害`
    case 'poisonTick':
      return `中毒失去 ${event.amount} 点生命`
    case 'intentResolved':
      return `${event.name}：${event.label}`
    case 'healed':
      return `回复 ${event.amount} 点生命`
    case 'defeated':
      return event.target.side === 'player' ? '你倒下了' : null
    case 'victory':
      return '你登上了塔顶'
    case 'damageDealt':
    case 'statusApplied':
    case 'statusTicked':
    case 'statusExpired':
      return null
    default: {
      const unreachable: never = event
      return unreachable
    }
  }
}

export function statusChangeDrafts(changes: readonly StatusChange[], target: ActorRef): CombatEventDraft[] {
  return changes.map((change) =>
    change.kind === 'expired'
      ? { type: 'statusExpired', target, status: change.status }
      : { type: 'statusTicked', target, status: change.status, amount: change.amount },
  )
}

export function appendEvents<T extends EventLogState>(state: T, drafts: readonly CombatEventDraft[]): T {
  if (drafts.length === 0) return state
  const events = state.events.slice()
  const lines: string[] = []
  let eventSeq = state.eventSeq
  for (const draft of drafts) {
    const event = { ...draft, id: eventSeq } as CombatEvent
    eventSeq += 1
    events.push(event)
    const line = formatEventLog(event)
    if (line) lines.push(line)
  }
  const trimmed = events.length > EVENT_BUFFER_LIMIT ? events.slice(events.length - EVENT_BUFFER_LIMIT) : events
  return {
    ...state,
    eventSeq,
    events: trimmed,
    log: lines.length === 0 ? state.log : [...state.log, ...lines],
  }
}
