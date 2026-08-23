# DeepAtlas for DeepSeek Harness

[![CI](https://github.com/Oscar-Williams/dsh-deepatlas/actions/workflows/ci.yml/badge.svg)](https://github.com/Oscar-Williams/dsh-deepatlas/actions/workflows/ci.yml)
[![DSH](https://img.shields.io/badge/DSH-0.1.1--rc.1%20%7C%20rc.2-blue)](./docs/compatibility.md)
[![Status](https://img.shields.io/badge/status-public%20preview-blueviolet)](./CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

DeepAtlas 是 DeepSeek Harness（DSH）的任务感知插件导航。它在本地维护一份 3,000+ 条目的生态索引：你描述当前任务，DeepAtlas 给出能力匹配的候选、质量依据和重叠提示；选定插件后，它继续完成 commit 级审计、兼容性检查和受控安装。

第三方插件会与 DSH 共享进程权限。DeepAtlas 提供可复核的风险信号和安装轨迹，最终选择始终由用户确认。

[English](./README.en.md) · [架构](./docs/architecture.md) · [安全模型](./docs/security.md) · [兼容契约](./docs/compatibility.md) · [更新记录](./CHANGELOG.md)

## 亮点

- **完整生态发现**：聚合 GitHub `dsh-plugin` topic 与多个社区清单；GitHub Search 结果按时间分片，越过单次查询 1,000 条上限。
- **任务能力检索**：28 类中英 capability、多字段证据与质量信号共同生成候选，适合自然语言任务和标准 capability 输入。
- **安静的能力顾问**：当前 profile 已具备相关能力时保持安静，发现明确缺口时给出 1–3 个建议。
- **装前风险审计**：检查生命周期脚本、依赖形态、native 依赖、manifest 声明入口与 bundle patch 的源码风险模式，以及 Node 兼容性；结果绑定完整 commit SHA。
- **受控安装与恢复**：安装授权只读取同一仓库、同一 commit 的本地审计缓存；执行前创建 profile 快照，异常时进入回滚流程。
- **本地优先**：索引、审计缓存与安装记录留在 DSH home 或用户指定目录，GitHub Token 仅用于提高 API 限额。

## 快速开始

### 1. 准备环境

DeepAtlas 当前验证范围：

- Node.js `^22.19.0 || >=24.0.0`
- DeepSeek Harness `0.1.1-rc.1` / `0.1.1-rc.2`
- `pnpm` 可从终端调用（DSH 的插件管理命令会转发给 pnpm）

```bash
node --version
pnpm --version
dsh --version
```

首次使用 DSH 时，可先启动默认 Web profile：

```bash
npx -y @deepseek-ai/dsh@0.1.1-rc.2 web
```

### 2. 安装到 profile

以下示例安装到 `web` profile，并锁定公开版本：

```bash
dsh plugin --profile web add github:Oscar-Williams/dsh-deepatlas#v0.2.1
```

使用 `headless` 或其他 profile 时，将两处 `web` 替换为对应名称。

### 3. 核对组合树

```bash
dsh --profile web --dump-config
```

输出中应出现 `dsh-deepatlas` / `deepatlas` 配置层。随后重启对应 profile：

```bash
dsh web
```

### 4. 建立首份索引

在 DSH 中发送：

> 调用 `deepatlas_status` 查看索引状态；若索引尚未建立，请执行一次完整扫描。

首次完整扫描会读取数千个生态条目。所需时间受 GitHub API 配额和网络状况影响，繁忙或匿名访问环境下可能接近 50 分钟。扫描支持取消；已有索引后可使用增量模式完成日常刷新。

完成后可以直接描述任务，例如：

- “我想给 DSH 增加跨会话记忆，帮我比较合适的插件。”
- “找一个 Telegram 消息接入插件，先列候选和风险信号。”
- “检查这个插件的指定 commit；展示审计结果后再询问我是否安装。”

## 工作流程

```text
GitHub topic / 社区清单
          │
          ▼
    本地生态索引 ───────→ deepatlas_status
          │
任务描述 + capability
          │
          ├────────────→ deepatlas_find ──→ 候选、证据、重叠提示
          │
          └────────────→ deepatlas_advise ─→ 已覆盖时静默 / 有缺口时建议
                                              │
用户选定完整 commit SHA ─→ deepatlas_audit ──┤
                                              ▼
                                      用户查看结果并确认
                                              │
                                              ▼
                                      deepatlas_install
                              快照 → 安装 → 组合验证 → 恢复链路
```

宿主模型负责理解任务并提供规范 capability；索引、排序、审计和安装闸门由确定性代码执行。

## 六个工具

| 工具 | 用途 | 主要输出 |
|---|---|---|
| `deepatlas_scan` | 完整扫描或增量刷新生态索引 | 条目数、数据源健康度、索引位置 |
| `deepatlas_status` | 查看索引时间、TTL、来源与 Top 10 | 当前状态、认证模式、元数据覆盖率 |
| `deepatlas_find` | 按任务与 capability 检索候选 | 匹配证据、质量分、重叠提示 |
| `deepatlas_advise` | 对照已安装插件识别能力缺口 | 静默结论或 1–3 个建议 |
| `deepatlas_audit` | 审计仓库的完整 40 位 commit SHA | 风险等级、证据、兼容结论、`auditedRef` |
| `deepatlas_install` | 使用审计缓存生成或执行安装计划 | 状态轨迹、命令、执行/组合/激活状态 |

推荐使用顺序：`status → scan → find → audit → 明确确认 → install`。

## 配置

| 配置项 | 默认值 | 说明 |
|---|---:|---|
| `dataDir` | 空 | 留空时写入当前 `DSH_HOME/deepatlas`；未设置 `DSH_HOME` 时使用 `~/.dsh/deepatlas` |
| `installProfile` | `web` | 查重、安装和组合验证使用的 profile |
| `indexTtlHours` | `24` | 超过该时长后状态会提示刷新 |
| `minStars` | `0` | 候选的最低 star 门槛 |
| `githubTokenEnv` | `DEEPATLAS_GITHUB_TOKEN` | GitHub Token 所在的环境变量名 |
| `dryRun` | `true` | 生成完整安装计划与命令，保留 profile 现状 |

需要启用真实安装时，在 `$DSH_HOME/profiles/<profile>/cordis.patch.yml` 中覆盖 `deepatlas` 行。DSH 的行级 patch 会替换整份 `config`，因此请保留全部字段：

```yaml
- id: deepatlas
  config:
    dataDir: ''
    installProfile: web
    indexTtlHours: 24
    minStars: 0
    githubTokenEnv: DEEPATLAS_GITHUB_TOKEN
    dryRun: false
```

运行 `dsh --profile web --dump-config` 可核对最终生效值。`DEEPATLAS_HOME` 适合显式指定跨 profile 共用的数据目录；`dataDir` 具有最高优先级。

## 安装安全边界

DeepAtlas 将以下条件固化在工具层：

1. 审计与安装都使用规范 `owner/repo` 和完整 40 位 commit SHA。
2. 安装从 `target + commit + audit-v3` 内容寻址缓存读取风险等级与兼容要求，并按当前运行时重新计算兼容结论。
3. 红色风险、兼容失败、缺少审计记录和缺少用户确认都会阻断安装计划。
4. 真实执行前检查当前组合树并创建 profile 快照。
5. 安装命令成功后再次读取组合树；失败路径进入恢复状态，并记录完整 trace。
6. `dryRun=true` 进入 `PLANNED`，同时返回可检查的锁定命令。

绿色与黄色结论代表当前规则下观察到的风险信号。仓库内容、依赖和运行行为仍值得结合来源信誉与人工审查综合判断。

## 评测状态

| Gate / 数据集 | 当前结果 | 覆盖范围 |
|---|---:|---|
| RetrievalDev（冻结 dev-30） | Recall@20 96.7%；Top3-SA 93.3%；mustNot@3 0 | 已知开发意图的确定性回归 |
| Independent holdout-15 | Top3-SA 26.7% | 纯静态检索对口语任务的基线 |
| NormalizedIntentRetrieval（120 改写） | 静态 50.8% → 标准 capability 85.0% | capability 通道的检索收益 |
| AdvisorSafety fixture | 推荐 5/5；静默 5/5；误报 0 | 安静顾问的确定性回归 |

HostIntentGate 将独立度量“自然语言 → DSH 宿主模型 → capability 数组”的真实链路；Evidence v2 将进一步校准能力证据来源、置信度和覆盖率。两项工作采用冻结数据、可重放记录和独立 Gate，完成后再进入发布线。

## 兼容性与当前范围

- DeepAtlas 处于 public preview，DSH 处于 Developer Preview。
- 当前发布线覆盖 DSH `0.1.1-rc.1` / `0.1.1-rc.2` 与 Node 22.19 / 24。
- 安装分发使用 GitHub tag 或完整 commit SHA，仓库随包携带已构建 `lib/`。
- 审计覆盖静态风险信号；运行时隔离、签名校验和恶意行为检测由更上层的安全体系承担。
- `dryRun=true` 提供安全默认体验，真实安装由用户按 profile 显式启用。

DSH 每个新 RC 会先进入 compatibility canary：依赖契约、Windows/Linux 分发、配置组合、工具调用与真实启动全部通过后，再更新兼容矩阵。

## 更新与卸载

更新到新的锁定版本：

```bash
dsh plugin --profile web remove dsh-deepatlas
dsh plugin --profile web add github:Oscar-Williams/dsh-deepatlas#v0.2.1
```

卸载：

```bash
dsh plugin --profile web remove dsh-deepatlas
```

本地索引与审计记录保存在 `dataDir`；卸载插件不会自动清理这些本地数据。

## 开发与验证

```bash
npm ci
npm test
npm run typecheck
npm run typecheck:tests
npm run build
```

当前回归基线为 **22 个测试文件、108 项测试**。CI 覆盖 Node 22/24、Windows、分发完整性、tarball 安装与启动验证，以及按 commit 安装的 nightly E2E。`lib/` 属于 GitHub 安装载荷，源码变更必须同步构建产物。

## 路线图

- **v0.2.1**：发布完整性、完整生态分片扫描、DSH rc.2 lossless JSON、审计授权收口、Windows CLI 与安装恢复链路。
- **v0.3.x**：完整 HostIntentGate、Evidence v2、真实会话误报监测与可解释性报告。
- **v0.4.x**：DSH RC canary 自动化、审计规则扩展、增量索引维护与长期兼容策略。
- **1.0 准入**：DSH 稳定 API、可重复的跨版本验证、明确的数据迁移政策与安全响应流程。

## 项目名称

| 场景 | 名称 |
|---|---|
| 产品 | DeepAtlas |
| 完整名称 | DeepAtlas for DeepSeek Harness |
| GitHub 仓库 / DSH 包 | `dsh-deepatlas` |
| 中文说明 | DSH 插件导航 |

## 致谢

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
- [Oh-My-DSH](https://github.com/like-study1/Oh-My-DSH)
- [awesome-deepseek-harness](https://github.com/Dominic789654/awesome-deepseek-harness)

## License

[MIT](./LICENSE) © 2026 DeepAtlas contributors
