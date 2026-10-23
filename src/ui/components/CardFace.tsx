import type { CardDefinition } from '../../game/index.ts'

export function CardFace({ definition, hitLabel = null }: { definition: CardDefinition; hitLabel?: string | null }) {
  const attack = definition.cardType === 'attack'
  return (
    <span className={`card-face ${attack ? 'card-face-attack' : 'card-face-skill'}`}>
      <span className="card-pattern" aria-hidden="true" />
      <span className="card-top">
        <span className="card-cost">
          <span>{definition.cost}</span>
        </span>
        <span className="card-kind">{attack ? '攻击' : '技能'}</span>
        <span className="card-crest" aria-hidden="true">
          {attack ? <SlashCrest /> : <AshCrest />}
        </span>
      </span>
      <span className="card-name">{definition.name}</span>
      <span className="card-rule" aria-hidden="true" />
      <span className="card-text">{definition.description}</span>
      {hitLabel ? <span className="card-hit">{hitLabel}</span> : null}
    </span>
  )
}

function SlashCrest() {
  return (
    <svg viewBox="0 0 32 32" focusable="false">
      <path
        d="M6 24 16 6l4 8 6-4-4 16-8-2 6-6z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M8 22 20 10" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function AshCrest() {
  return (
    <svg viewBox="0 0 32 32" focusable="false">
      <path
        d="M16 3 27 9.5V22L16 29 5 22V9.5Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M16 9v13M11 16h10" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}
