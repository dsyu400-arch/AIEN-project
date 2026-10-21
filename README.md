# 遗烬之塔

原创单人 Roguelike 卡牌构筑网页游戏。技术栈为 React、TypeScript 与 Vite，界面语言为简体中文。

第一版目标：50 点生命、每回合 3 点能量、每回合抽取 5 张牌，使用 12 张原创卡牌进行三场连续战斗。前两场胜利后回复 8 点生命（不超过 50）并三选一获得新牌，第三场为 Boss。

## 命令

```bash
npm run dev
npm test
npm run test:watch
npm run build
```

`npm run dev` 启动本地预览。`npm test` 运行一次 `src/game` 中的 Vitest 规则测试。`npm run test:watch` 在规则改动后自动重跑测试。`npm run build` 会先做类型检查，再构建生产包。
