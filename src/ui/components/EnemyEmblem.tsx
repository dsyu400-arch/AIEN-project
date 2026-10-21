export function EnemyEmblem({ id, boss }: { id: string; boss: boolean }) {
  return (
    <div className={`emblem emblem-${id}${boss ? ' emblem-boss' : ''}`} aria-hidden="true">
      {id === 'emberWolf' ? <WolfMark /> : id === 'towerLord' ? <TowerMark /> : <GuardMark />}
    </div>
  )
}

function GuardMark() {
  return (
    <svg viewBox="0 0 64 64" focusable="false">
      <path
        d="M32 4 56 16v16c0 16-24 28-24 28S8 48 8 32V16Z"
        fill="currentColor"
        fillOpacity="0.14"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M26 24h12v22H26z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M22 24h20" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function WolfMark() {
  return (
    <svg viewBox="0 0 64 64" focusable="false">
      <path
        d="M6 28 20 8l12 18L44 8l14 20-12 14L32 60 18 42Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M24 30h4M36 30h4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
    </svg>
  )
}

function TowerMark() {
  return (
    <svg viewBox="0 0 64 64" focusable="false">
      <path d="M32 6 42 22H22Z" fill="currentColor" />
      <path
        d="M14 58V36h7V24h7v12h8V24h7v12h7v22Z"
        fill="currentColor"
        fillOpacity="0.14"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  )
}
