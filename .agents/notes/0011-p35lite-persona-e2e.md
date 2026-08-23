# 0011 · P3.5-lite 主场景 E2E 与发布级缺陷修复(2026-08-23)

## 外部评审(第五轮)评估结论
P3.5/P3.8/RC 重排**原则上全部采纳**;按用户口径收窄执行:
- P3.5 不铺四环境矩阵,先验证主人格"已有 DSH 用户安装 DeepAtlas";
- InstallEnvironment 先落最小件(workspace 吸收探针),完整探针增量补;
- P3.8(推荐基准)与 RC 检查单入 Roadmap,排在 P4/发布前;
- 采纳原则:产品代码绝不改用户全局 git/npm 配置(进程级注入);
  源码扫描只称 risk signals;审计缓存内容寻址;star 仅为 tie-breaker;
  反馈区分 explicit/implicit 并记录 exposure;本地偏好与全局分分离;
  P4 主动推荐=能力缺口检测(安静顾问)。

## 主人格 E2E(用户真实 profile,含其手填 API Key)
remove 旧挂载 → snapshotProfile(4 文件)→ GitHub 安装 96f7c39(47.5s)
→ dump-config COMPOSED → web --port 3082 启动 t=5s HTTP 200
→ discardSnapshot。纯 GitHub 路径,零 staging/零手工依赖。

## 抓到的发布级致命缺陷(clean-room 思维当场兑现)
`github:` 安装 = 纯 git clone 无构建,而 lib/ 原被 .gitignore 排除
→ 任何陌生用户按 README 安装即 "Cannot find module lib/index.js" 崩溃。
此前 staging/link: 验证路径自带产物,掩盖了缺陷。
修复:lib/ 产物入库(.map 除外),发版流程 = build → 提交 → tag。
教训一:验证路径与分发路径必须同构;教训二:第一次提交(f24b6a4)
信息先行于事实(.gitignore 编辑冲突未生效即提交),二条(96f7c39)
才真正落实——提交前须核验 `git ls-files lib/`。

## 新模块(测试 54→60)
- probe.ts:workspace 吸收探针(pnpm-workspace.yaml/workspaces 祖先检测,
  防 "Already up to date" 假象);注意其对象是 staging/源码目录,
  profile 目录本身即 workspace,不适用;
- rollback.ts:profile 快照/恢复/丢弃(文件级;依赖目录由 dsh reconcile 清理)。

## 环境备注
- 首个工作区 F:\Agent_Related\Deepseek-Harness_test 已创建,待用户在
  web UI 选择;
- 用户 3080 实例运行的是旧组合(无 DeepAtlas),重启后加载新组合;
  3082 冒烟进程已停。
