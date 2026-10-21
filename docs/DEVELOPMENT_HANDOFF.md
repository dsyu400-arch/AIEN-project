# 《遗烬之塔》开发交接

交接日期：2026-10-21。仓库就是当前的 `aien-project`，不要新建项目目录，不要修改或删除 `.git`，不要推送 GitHub，除非用户明确要求。

阶段 0、1、2、3 已完成，游戏可以从封面打完整场。下一步只做阶段 4，而且要等用户明确要求后再开始。

## 运行

系统是 Windows PowerShell。`npm.ps1` 会被执行策略拦住，命令要用 `npm.cmd`。

```bash
npm.cmd run dev
npm.cmd test
npm.cmd run test:watch
npm.cmd run lint
npm.cmd run build
```

`npm.cmd run dev` 启动 Vite。5173 被占用时会改用下一个端口，最近一次是 http://localhost:5174/ 。`npm.cmd run build` 会先执行 `tsc -b`，再做生产构建。

技术栈：React 19.3、TypeScript 6、Vite 8.3。规则测试用 Vitest 5.0.5。界面测试用 `@testing-library/react` 和 `happy-dom`。没有 Zustand、路由、动画库或 UI 组件库。Playwright 还没安装。

`tsconfig.app.json` 打开了 `verbatimModuleSyntax` 和 `erasableSyntaxOnly`。类型用 `import type`，不要用 `enum`。仓库内的 TypeScript 导入带 `.ts` / `.tsx` 后缀。

## 已完成范围

阶段 0：清掉 Vite 模板，标题为「遗烬之塔」，`lang="zh-CN"`，建立 `src/game` 与 `src/ui`，接入 Vitest。

阶段 1：`src/game` 里的纯函数战斗引擎，以及规则测试。

阶段 2：封面、战斗、三选一、胜负都已接到引擎。React 只保存状态并派发动作，不重复实现规则。

`src/App.tsx` 用 `useReducer`。reducer 只调用 `applyAction(state, action).state`。未传入 `seed` 时用 `Date.now()`。测试渲染 `<App seed={1} />`。

界面动作与引擎一一对应：

- 开始游戏：`startRun`
- 点击手牌：`playCard`
- 结束回合：`endTurn`
- 奖励三选一：`chooseReward`
- 重新开始：`restart`

`phase` 为 `menu`、`playerTurn`、`reward`、`victory`、`defeat`。非法动作返回原状态引用，随机数不前进。能量不足的手牌按钮是禁用的。

## 目录

```text
src/main.tsx
src/App.tsx                      # 按 phase 切换画面
src/index.css                    # 全局暗色变量
src/game/
  types.ts                       # Phase、RunState、GameAction、Effect
  constants.ts                   # 50 生命、3 能量、抽 5、手牌 10、回复 8
  rng.ts                         # mulberry32 与洗牌，禁止 Math.random
  cards.ts                       # 12 张牌与初始牌组
  enemies.ts                     # 三场敌人与 currentIntent
  combat.ts                      # 出牌、抽弃牌、护甲、敌人行动
  run.ts                         # createRun、applyAction、回复、奖励、胜负
  index.ts                       # 规则层公共入口
  *.test.ts                      # 规则测试，node 环境
  test-utils.ts
src/ui/
  screens/StartScreen.tsx
  screens/BattleScreen.tsx
  screens/RewardScreen.tsx
  screens/ResultScreen.tsx
  components/CardButton.tsx
  components/CardFace.tsx
  components/EnemyEmblem.tsx
  components/PileButton.tsx
  feedback.ts                 # 按真实状态差生成飘字
  useCombatPresentation.ts    # 出牌残影与战斗反馈
  battle-layout.test.tsx
  feedback.test.tsx
  styles/title.css
  styles/play.css
  App.test.tsx                   # 文件顶部声明 happy-dom
index.html                       # lang=zh-CN，标题遗烬之塔
public/favicon.svg               # 原创余烬高塔图标
vite.config.ts                   # 测试包含 game 与 ui
```

规则层不能引用 React。界面从 `src/game/index.ts` 读取数据和派发动作。

## 核心规则

数值在 `src/game/constants.ts`：最大生命 50，每回合能量 3，每回合抽 5，手牌上限 10，普通战胜利回复 8。未用完的能量不保留，下回合直接设为 3。

初始牌组 10 张：余烬斩 ×4、灰盾 ×4、烬矛突刺 ×1、回焰 ×1。主牌组跨战斗保留。每场开始时复制并洗入抽牌堆。消耗只在本场有效。

玩家回合开始：清除玩家护甲，能量设为 3，抽 5 张。出牌顺序：支付能量，从手牌取出，按效果结算，消耗牌进消耗堆否则进弃牌堆，最后判定胜负。抽牌发生在这张牌进入弃牌堆之前。

结束回合：手牌全部弃置，清除敌人护甲，执行当前意图，玩家死亡则失败。否则切换下一条意图，再开始玩家回合。本回合获得的护甲能挡住这次敌人攻击。敌人本回合获得的护甲会留到玩家的下一回合。

伤害先扣护甲，多段攻击逐段结算。生命不低于 0，回复不超过最大生命。焚心一击的自伤直接扣生命，不消耗护甲。一张牌若让双方同时倒下，判失败，不回复。

抽牌堆空了就洗入弃牌堆。两边都空则少抽。手牌达到 10 张时，继续抽到的牌直接进入弃牌堆。

第一关和第二关胜利时，在进入奖励的同一次状态转换里回复 8 点生命，只此一次。选牌不会再次回复。Boss 胜利不回复，直接通关。战斗之间保留回复后的生命和主牌组，清空护甲、能量和三个牌堆。

奖励从 12 张定义里抽 3 张不同的牌，允许拿主牌组里已有的牌。同一个种子、同一串操作，洗牌和奖励必须一致。

`restart` 用原来的种子调用 `createRun`，回到菜单并清零进度。它不会换成新种子。刷新页面会重新执行 `Date.now()`，因此是另一局，而且没有存档。

## 十二张牌

- 余烬斩：1 费，6 点伤害。
- 裂塔重击：2 费，13 点伤害。
- 灰烬连斩：1 费，4 点伤害两次。
- 焚心一击：1 费，9 点伤害，然后对自己造成 2 点伤害。
- 烬矛突刺：0 费，3 点伤害。
- 灰盾：1 费，5 点护甲。
- 塔壁：2 费，11 点护甲。
- 烬甲：1 费，4 点护甲，抽 1 张。
- 拾烬：1 费，抽 2 张。
- 余火洞察：0 费，抽 1 张。
- 回焰：0 费，获得 1 点能量，然后消耗。
- 聚焰：1 费，获得 2 点能量。

不要改这些费用和效果，除非用户明确要求。

## 三场敌人

- 第 1 场，灰卫，36 生命。循环：攻击 8、获得 6 点护甲、攻击 11。
- 第 2 场，烬狼，48 生命。循环：攻击 7×2、攻击 12、获得 10 点护甲。
- 第 3 场 Boss，塔主·残焰，70 生命。循环：攻击 10、攻击 6 并获得 12 点护甲、攻击 18。

意图文案就用数据里的 `label`。每场只有一名敌人。

## 当前界面

阶段 3 已完成，分三步落地，都没有改 `src/game` 的规则、费用和敌人数值。

阶段 3A：战斗页收进视口。手牌与奖励共用 `CardFace`。攻击牌和技能牌用不同边框、费用章和纹样。五张手牌在桌面端同一行；六到十张允许重叠，鼠标和键盘仍能选中。

阶段 3B：点击后立即派发 `playCard` 和 `endTurn`，动画不推迟结算。攻击残影飞向敌人，防御和能量牌只做短距离反馈。飘字来自真实生命、护甲和能量变化：受伤为红色负数，护甲为灰金正数，治疗为绿色正数，能量为余烬橙。护甲完全吸收时不显示虚假扣血。多段攻击合成一个总生命变化。敌人徽记会闪烁，掉血时轻微震动，Boss 稍强。页面切换时清掉定时器和临时元素。`prefers-reduced-motion` 会关掉这些动画。

阶段 3C：三个敌人换成原创几何场景，视觉彼此不同。灰卫是残破铁盾和灰烬铠甲，胸口有一小点余烬。烬狼是贴地的暗红兽形，带爪、獠牙和火焰。塔主·残焰是燃烧王冠、熔岩披风和两侧塔柱，外框更亮。敌人面板占满战斗区右侧，生命、护甲和意图放在立绘下方的实底条里，不被背景挡住。左侧留下塔楼和岩石纹样。攻击轨迹、受击闪光和震动仍在。`public/favicon.svg` 已换成炭黑底的余烬高塔，不再是 Vite 图标。

卡牌说明用浅色 14px 正文。奖励页把标题和三张牌分成上下两层，窄屏改为纵向排列。按钮有悬停、聚焦、按下和禁用状态。

## 测试

阶段 3C 结束时执行 `npm.cmd test`：Vitest 5.0.5，10 个文件，56 项全部通过。同一次也通过了 `npm.cmd run lint` 和 `npm.cmd run build`。

规则测试在 `src/game`，环境是 `node`：`smoke.test.ts`、`rng.test.ts`、`cards.test.ts`、`enemies.test.ts`、`combat.test.ts`、`run.test.ts`、`adventure.test.ts`。

界面测试在 `src/ui`，文件第一行指定 `happy-dom`：`App.test.tsx`、`battle-layout.test.tsx`、`feedback.test.tsx`。它们覆盖从封面开始、出牌、结束回合、查看牌堆、种子 1 的三场战斗、领奖、通关和重新开始，以及手牌行数、奖励卡面、真实伤害飘字、残影清理和 StrictMode 不重复飘字。

`README.md` 仍写着测试只覆盖 `src/game`。实际 `vite.config.ts` 也包含 `src/ui/**/*.test.tsx`。

## 尚未完成

阶段 4：再安装 Playwright。用例放在 `e2e/`，至少覆盖开始游戏、出牌、结束回合、领取奖励、重新开始。选择器用按钮名、标题和卡牌名。使用固定种子。不要在用户要求之前安装或开始。

第一版明确不做：地图、遗物、药水、商店、事件、多敌人、虚弱或易伤、存档、音效。

## 已知情况

- 1280×720、1366×768、1920×1080 和 768×1024 上，五张手牌在同一行，页面不滚动，结束回合留在视口内。390×844 上手牌可以横向滚动，敌人立绘不会挡住结束回合。
- 致命一击会立刻离开战斗页，最后一下飘字不留在下一屏。
- 能量飘字是净变化。费用 1、效果加 2 的牌显示 `+1`。
- 多段攻击显示一次总生命变化，不拆成逐段数字。
- 战斗记录只显示最近 6 条。
- 重新开始沿用当前种子。要换一局，需要刷新页面。
- 没有失败原因提示。非法点击会被引擎忽略。
- 开发服务器端口取决于 5173 是否被占用。
