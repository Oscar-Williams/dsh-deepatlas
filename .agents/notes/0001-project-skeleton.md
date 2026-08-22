# 0001 · 项目骨架落成(2026-08-22)

## 背景
DeepAtlas(dsh-插件导航)P0 骨架。命名体系来自需求方图示:
仓库 dsh-deepatlas / 产品 DeepAtlas / 中文 dsh-插件导航。
GitHub 仓库 topics 必须包含 dsh 与 deepseek。

## 关键决策
1. 采用 Cordis 函数插件形态(命名导出 name/inject/Config/apply + defineTool),
   而非 Skill 形态——需要本地脚本(扫描/审计)与工具参数校验,函数插件更规范;
2. 语义排序交给 DSH 模型,DeepAtlas 只做确定性部分(索引/预筛/审计/闸门);
3. dryRun 默认 true,P3 才接真实安装;
4. 审计与安装闸门分离,闸门独立复核,不信任上游传参。

## 遗留(下一步)
- 按 docs/verification-checklist.md 对照真实 dsh 环境核实 API 形态
- pnpm install + vitest 全绿
- GitHub 建仓(topics: dsh, deepseek, dsh-plugin, deepseek-harness, plugin-navigation)
