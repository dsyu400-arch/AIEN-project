# 《遗烬之塔》开发交接

交接日期：2026-10-21。仓库就是当前的 `aien-project`，不要新建项目目录，不要修改或删除 `.git`，不要推送 GitHub，除非用户明确要求。

阶段 0、1、2 已完成，游戏可以从封面打完整场。下一步只做阶段 3。

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
  components/PileButton.tsx
  styles/title.css
  styles/play.css
  App.test.tsx                   # 文件顶部声明 happy-dom
index.html                       # lang=zh-CN，标题遗烬之塔
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

封面保留炭黑背景、余烬橙和楷体标题，并有「开始游戏」。

战斗界面显示第几场、双方生命、护甲、能量、回合、敌人意图、最近 6 条战斗记录、手牌，以及抽牌堆、弃牌堆、消耗堆。牌堆可以点开查看。「结束回合」在战斗标题右侧。

奖励界面展示回复后的生命和三张牌。胜负界面提供「重新开始」。

视觉只是可玩的暗色布局，不是阶段 3 的完成态。没有出牌位移动画、伤害数字或原创插图。`public/favicon.svg` 仍是 Vite 图标。

## 测试

本次交接前执行 `npm.cmd test`：Vitest 5.0.5，8 个文件，48 项全部通过。

规则测试在 `src/game`，环境是 `node`：`smoke.test.ts`、`rng.test.ts`、`cards.test.ts`、`enemies.test.ts`、`combat.test.ts`、`run.test.ts`、`adventure.test.ts`。

界面测试是 `src/ui/App.test.tsx`，文件第一行指定 `happy-dom`。它覆盖从封面开始、出牌、结束回合、查看牌堆，以及种子 1 的三场战斗、领奖、通关和重新开始。

阶段 2 结束时，`npm.cmd run lint` 和 `npm.cmd run build` 已通过。交接这次只重跑了测试，没有重跑 lint 和 build。

`README.md` 仍写着测试只覆盖 `src/game`。实际 `vite.config.ts` 也包含 `src/ui/**/*.test.tsx`。

## 尚未完成

阶段 3：在现有暗色风格上做原创暗黑奇幻视觉和战斗反馈。包括统一的卡牌层次、悬停反馈、伤害与治疗数字、出牌位移，以及足够的文字对比度。不要换成另一套主题，也不要使用《杀戮尖塔》的图像、布局或卡牌名称。做完后现有 48 项测试仍须通过，并在浏览器里再走通一局。

阶段 4：再安装 Playwright。用例放在 `e2e/`，至少覆盖开始游戏、出牌、结束回合、领取奖励、重新开始。选择器用按钮名、标题和卡牌名。使用固定种子。

第一版明确不做：地图、遗物、药水、商店、事件、多敌人、虚弱或易伤、存档、音效。

## 已知情况

- 手牌有 5 张时，较矮的窗口里最后一张会换到下一行，需要向下滚动才能看全。结束回合按钮已放在上方。
- 战斗记录只显示最近 6 条。
- 重新开始沿用当前种子。要换一局，需要刷新页面。
- 没有失败原因提示。非法点击会被引擎忽略。
- 开发服务器端口取决于 5173 是否被占用。
