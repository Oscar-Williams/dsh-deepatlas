# 0002 · 首轮真实验证(2026-08-22)

## 环境
Windows 侧无独立 Node.js;WSL2(Ubuntu-26.04 + Miniconda)创建 conda 环境
`dsh-deepatlas`(nodejs=22, v22.23.2),在 /mnt/f 项目目录上混合开发。

## 实测发现并修复的问题
1. NodeNext 模块解析要求相对导入显式 `.js` 后缀——全量补齐(src + tests);
2. auditor 的 opaque-dependencies 正则漏掉 `git+https://` 形态,
   对应测试用例先行暴露(红),修复后转绿——TDD 有效性验证;
3. sources/types.ts 未使用导入(TS6133);
4. auditor.ts 内联动态 import 类型改为顶部导入(同样受 TS2835 约束)。

## 验证结论
- vitest:4 文件 21 用例全绿(~2s,跨 /mnt/f 性能可接受);
- tsc --noEmit(src)与 tsconfig.test.json(tests)均通过;
- tsc 构建 lib/ 产物完整(index/cli/core/tools + d.ts)。

## WSL2 混合模式结论
小依赖树(typescript/vitest/@types/node)下跨文件系统性能无感;
P1 若引入重依赖或 watch 模式,再评估迁移 WSL 原生文件系统。
