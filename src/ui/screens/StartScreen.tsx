import '../styles/title.css'

export function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <main className="title-screen" data-testid="menu">
      <p className="eyebrow">单人卡牌构筑</p>
      <h1>遗烬之塔</h1>
      <p className="lede">
        火熄之后，塔仍在。用残存的余烬重组牌组，登上三层试炼。
      </p>
      <ul className="rules">
        <li>生命 50</li>
        <li>每回合能量 3</li>
        <li>每回合抽牌 5</li>
        <li>连续三场战斗</li>
      </ul>
      <button type="button" className="ember-button" onClick={onStart}>
        开始游戏
      </button>
    </main>
  )
}
