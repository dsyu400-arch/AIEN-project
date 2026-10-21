export function EnemyEmblem({ id, boss }: { id: string; boss: boolean }) {
  return (
    <div className={`emblem emblem-${id}${boss ? ' emblem-boss' : ''}`} aria-hidden="true">
      {id === 'emberWolf' ? <EmberWolf /> : id === 'towerLord' ? <TowerLord /> : <AshGuard />}
    </div>
  )
}

function AshGuard() {
  return (
    <svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice" focusable="false">
      <path d="M18 46h22v86H18zM52 62h14v70H52zM330 54h16v78h-16zM358 38h20v94h-20z" fill="#2c2823" />
      <path d="M24 62h8v12h-8zM364 70h8v14h-8z" fill="#e07a3d" opacity="0.55" />
      <path d="M0 124h400v26H0z" fill="#14110e" />
      <path d="M0 118l28-16 22 12 26-14 18 10h26l20-12 24 14 30-16 28 12 36-10 28 8 40-12 28 8 46-8v28H0z" fill="#3a342c" />
      <path
        d="M132 28l62-14 12 16v78l-38 24-36-20V40z"
        fill="#6d675c"
        stroke="#d9d0c3"
        strokeWidth="2"
      />
      <path d="M156 46l26 70M146 78h48" fill="none" stroke="#241e18" strokeWidth="2.2" />
      <path d="M188 22l18 8-8 12-16-4z" fill="#4a453c" />
      <path d="M214 36h34l10 16h-52z" fill="#5a554c" stroke="#c9beb0" strokeWidth="1.6" />
      <path d="M224 46h18" stroke="#e07a3d" strokeWidth="2.4" />
      <path d="M206 56h56l10 20v52h-58V78z" fill="#4a453c" stroke="#b7ad9f" strokeWidth="1.6" />
      <path d="M198 58l-16 8 8 16 18-8z" fill="#7d766b" />
      <path d="M214 128h16v16h-16zM242 128h14v16h-14z" fill="#2a261f" />
      <circle className="ember-core" cx="236" cy="92" r="5" fill="#e07a3d" />
      <circle cx="236" cy="92" r="12" fill="#e07a3d" opacity="0.24" />
      <circle className="ember-core" cx="96" cy="132" r="2.4" fill="#e0c17a" />
    </svg>
  )
}

function EmberWolf() {
  return (
    <svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice" focusable="false">
      <path d="M0 126h400v24H0z" fill="#120c0b" />
      <path d="M0 120l26-14 24 12 30-16 22 12 34-14 28 10 36-12 30 12 40-8 28 8 42-10 30 8 30-6v22H0z" fill="#2a1614" />
      <path
        className="ember-core"
        d="M168 78c8-30 22-36 18-62 14 26 28 14 30-12 10 30 26 16 22 44-10 6-20 2-28 12-8-16-18-6-24 8-8-10-14-4-18 10z"
        fill="#d15a45"
      />
      <path d="M188 64c8-16 18-8 16-24 8 14 16 6 16-6 6 16 12 10 8 22" fill="#ffb089" opacity="0.75" />
      <path
        d="M78 112c10-34 40-48 72-36 12-16 32-18 52-6l28 12-16 16 18 12-26 6c-16 12-40 14-64 6-22-6-42-4-64-10z"
        fill="#2c1614"
        stroke="#d15a45"
        strokeWidth="1.8"
      />
      <path d="M214 78l-6-26 16 14zM232 80l14-30 8 24z" fill="#4a201c" />
      <path d="M230 74l8-18 6 14z" fill="#d15a45" />
      <path d="M236 92h18l-4 7z" fill="#140c0a" />
      <path d="M242 98l4 8 4-8M254 100l3 7 4-7" fill="#f6ead7" />
      <circle cx="244" cy="90" r="2.3" fill="#ffb089" />
      <path d="M92 108c-18-4-26 10-14 16 8-6 12-4 14-16z" fill="#d15a45" />
      <path d="M118 116l-14 18M136 120l-10 16M152 122l-4 14" fill="none" stroke="#f3e6d4" strokeWidth="2.2" />
      <circle className="ember-core" cx="176" cy="108" r="3" fill="#e07a3d" />
    </svg>
  )
}

function TowerLord() {
  return (
    <svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice" focusable="false">
      <path d="M28 18h22v112H28zM350 18h22v112h-22z" fill="#3a241c" />
      <path d="M36 34h8v12h-8zM358 46h8v16h-8zM36 72h8v12h-8zM358 86h8v14h-8z" fill="#e07a3d" opacity="0.75" />
      <path d="M0 128h400v22H0z" fill="#140e0c" />
      <ellipse cx="200" cy="128" rx="70" ry="7" fill="#e07a3d" opacity="0.4" />
      <path d="M200 34 262 128H138Z" fill="#241410" stroke="#e07a3d" strokeWidth="1.5" />
      <path d="M200 52 184 82l14 8-8 28M200 70l16 24-8 18" fill="none" stroke="#e07a3d" strokeWidth="2.4" />
      <path d="M200 78l10 16" fill="none" stroke="#e0c17a" strokeWidth="1.6" />
      <path d="M158 70 200 54l42 16-10 12-32-8-32 8z" fill="#5a3424" />
      <path d="M182 46h36v16h-36z" fill="#1a100e" />
      <path d="M190 52h8M206 52h8" stroke="#e07a3d" strokeWidth="2" />
      <path d="M170 50l10-22 12 16 8-20 8 20 12-16 10 22z" fill="#e0c17a" />
      <circle className="ember-core" cx="180" cy="30" r="3" fill="#e07a3d" />
      <circle className="ember-core" cx="200" cy="22" r="4" fill="#ffb089" />
      <circle className="ember-core" cx="220" cy="30" r="3" fill="#e07a3d" />
    </svg>
  )
}
