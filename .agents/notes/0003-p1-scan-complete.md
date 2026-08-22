# 0003 · P1 扫描完备化(2026-08-22)

## 本轮完成
- 1.2 github-topic 全量分页(页空/达 total 收尾,MAX_PAGES=100 上限)、
  增量模式(pushed:>since)、403/429 指数退避重试、onProgress 回调;
- 1.3 类型精判 enrich.ts:读仓库根文件清单(SKILL.md/skills/ → skill;
  package.json 含 dsh 字段 → cordis),默认对 star 头部 30 个仓库精判,
  其余保留启发式并以 typeSource 区分证据;350ms 节流;
- 1.4 CLI:scan 实时进度 + 全量/增量模式;status 新增 Top10 质量分预览;
- 1.5 GitHub Actions CI(npm ci → 双 typecheck → test → build,node22/ubuntu);
- scanner:增量与旧索引合并(mergeMeta 空值回落策略);
  全量模式全部失败时抛错不落盘空索引(anyOk 语义);
- 测试 21→28 用例(新增扫描器全量/增量/降级/Top10 七个场景)。

## 测试抓出的 bug(再次验证 TDD 价值)
1. mergeMeta 中 `topics: incoming.topics.length || existing.topics`
   把数组长度当值用(TS2322 暴露);
2. anyOk 初始化逻辑写反:全量应起步 false,增量起步 true。

## 官方形态核实进展(任务 1.1)
- 微信/小红书社区已确认:官方三系统安装路径 = Node.js ≥22 LTS
  (Windows 为 .msi 一等公民)→ npx @deepseek-ai/dsh web → 127.0.0.1:3080;
- dsh CLI 本地实测(npx)仍在下载中,完成后回填 docs/verification-checklist.md
  与 docs/cli-capture/;dsh.bundle 精确结构以实测为准。
