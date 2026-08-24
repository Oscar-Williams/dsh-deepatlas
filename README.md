# DeepAtlas for DeepSeek Harness

[![CI](https://github.com/Oscar-Williams/dsh-deepatlas/actions/workflows/ci.yml/badge.svg)](https://github.com/Oscar-Williams/dsh-deepatlas/actions/workflows/ci.yml)
[![DSH](https://img.shields.io/badge/DSH-0.1.1--rc.1%20%7C%20rc.2-blue)](./docs/compatibility.md)
[![Status](https://img.shields.io/badge/status-public%20preview-blueviolet)](./CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

DeepAtlas 帮助 DeepSeek Harness（DSH）用户判断一次插件能力变更是否值得执行，并为查找、核验和安装过程留下可复核记录。需要跨会话记忆、消息接入、浏览器自动化等能力时，你可以直接描述目标；DSH 宿主模型会按需调用 DeepAtlas，核对当前 profile 的能力覆盖，再给出候选、匹配依据和风险信号。

选定候选后，DeepAtlas 会在完整 commit 上执行风险审计与兼容性检查，并在用户明确确认后进入锁定版本安装和恢复流程。当前版本采用会话内按需调用；首次使用插件发现功能前，需要由用户确认一次完整扫描。索引、审计记录和安装状态均保存在本地。

[English](./README.en.md) · [架构](./docs/architecture.md) · [安全模型](./docs/security.md) · [兼容契约](./docs/compatibility.md) · [更新记录](./CHANGELOG.md)

## DeepAtlas 如何参与任务

DeepAtlas 通过六个工具参与当前 DSH 会话。你提出找插件、比较候选或检查能力缺口等需求后，宿主模型会依据可见工具说明选择 `deepatlas_find` 或 `deepatlas_advise`。在请求中写明“用 DeepAtlas 查找插件”可以获得更稳定的触发效果。持续任务觉察与受控主动建议列入 v0.2.4。

| 阶段 | 触发方式 | 执行行为 |
|---|---|---|
| 生态扫描 | 用户确认调用 `deepatlas_scan` | 在当前 DSH 进程中读取 GitHub 与社区来源，建立或刷新本地索引 |
| 任务检索 | 用户提出插件发现需求，宿主模型选择 DeepAtlas 工具 | 解析本次任务与规范 capability，检索已有本地索引 |
| 能力顾问 | 宿主模型调用 `deepatlas_advise` | 对照当前 profile；能力已覆盖时返回静默结论，有明确缺口时给出建议 |
| 审计与安装 | 用户选择仓库和完整 commit，并分别确认 | 执行静态审计、兼容检查、快照、锁定安装与恢复流程 |

自然语言工具选择由当前 DSH 模型完成，表现会随模型、提示词和可见工具集合变化。首次索引和后续刷新由确认后的扫描工具完成；日常检索直接读取本地索引。

## 亮点

- **能力覆盖检查**：对照当前 profile 与任务需求，能力已覆盖时保持安静，发现明确缺口时给出 1–3 个建议。
- **任务能力检索**：28 类中英 capability、多字段证据与质量信号共同生成候选，并同时呈现匹配依据和能力重叠。
- **可复核的能力证据**：GitHub Search 与社区清单用于生态发现；候选的 manifest、README 和声明入口在同一完整 commit 下读取，并记录仓库路径、内容哈希和覆盖状态。
- **装前风险审计**：检查生命周期脚本、依赖形态、native 依赖、manifest 声明入口与 bundle patch 的源码风险模式，以及 Node 兼容性；结果绑定完整 commit SHA。
- **受控安装与恢复**：安装授权只读取同一仓库、同一 commit 的本地审计缓存；执行前创建 profile 快照，异常时进入回滚流程。
- **证据化生态发现**：从 GitHub 与社区清单收集候选，再核对插件结构和固定 commit 下的发布文件，区分可安装候选与待核验线索。
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
dsh plugin --profile web add https://codeload.github.com/Oscar-Williams/dsh-deepatlas/tar.gz/refs/tags/v0.2.3
```

该地址通过 HTTPS 获取锁定版本，在 Windows、WSL 与常见受限网络中保持一致。使用 `headless` 或其他 profile 时，将两处 `web` 替换为对应名称。

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

本地索引是 DeepAtlas 用于检索的插件候选目录。用户确认并启动完整扫描后，DeepAtlas 会读取 GitHub 与社区来源、合并重复仓库、采集候选证据并写入本地。扫描完成时会返回候选数量、来源健康度和索引位置；维护者验证结果集中列在[评测状态](#评测状态)。

网络稳定且已配置 GitHub Token 时，完整扫描通常可在数分钟内完成。2026-08-23 的匿名验证耗时 15 分 46 秒，主要时间用于等待 GitHub Search API 配额。实际耗时会随配额、网络状态和生态规模变化。扫描运行于当前 DSH 进程，期间需保持进程与网络连接。

保持扫描顺畅：

- 确保 `api.github.com`、`github.com` 与 `codeload.github.com` 可稳定访问。
- 在启动 DSH 的环境中设置 `DEEPATLAS_GITHUB_TOKEN`，再用 `deepatlas_status` 确认 `githubAuth` 为 `authenticated`；配额规则见 [GitHub REST API 文档](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)。
- 扫描期间保持网络出口稳定；完成首份索引后，日常刷新使用 `incremental=true`。
- 扫描支持取消；完整结果通过临时文件原子替换，已有索引会在数据源异常时继续保留。
- 维护者可运行 `npm run scan` 查看分片页数和实时读取进度。

完成后可以直接描述任务，例如：

- “我想给 DSH 增加跨会话记忆，帮我比较合适的插件。”
- “找一个 Telegram 消息接入插件，先列候选和风险信号。”
- “检查这个插件的指定 commit；展示审计结果后再询问我是否安装。”

## 工作流程

```text
GitHub / 社区来源
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

| 工具 | 触发与用途 | 主要输出 |
|---|---|---|
| `deepatlas_scan` | 用户确认后完整扫描或增量刷新生态索引 | 条目数、数据源健康度、索引位置 |
| `deepatlas_status` | 按需查看索引时间、TTL、来源与 Top 10 | 当前状态、认证模式、元数据覆盖率 |
| `deepatlas_find` | 宿主模型按本次需求调用，按任务与 capability 检索候选 | 匹配证据、质量分、重叠提示 |
| `deepatlas_advise` | 宿主模型按需调用，对照已安装插件识别能力缺口 | 静默结论或 1–3 个建议 |
| `deepatlas_audit` | 用户选定仓库与完整 40 位 commit SHA 后审计 | 风险等级、证据、兼容结论、`auditedRef` |
| `deepatlas_install` | 用户明确授权后使用审计缓存生成或执行安装计划 | 状态轨迹、命令、执行/组合/激活状态 |

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
| EvidenceGold v1 | accepted precision 100%；recall 100%；must-not 假接受 0 | publisher provenance、边界词与冲突回归 |
| EvidenceFullScan（2026-08-24） | schema v2；structural/release Gate PASS | 两源同轮全量扫描与固定 publisher cohort；[脱敏凭据](./benchmark/evidence-full-scan-receipt.json) |

HostIntentGate 将独立度量“自然语言 → DSH 宿主模型 → capability 数组”的真实链路。当前 85.0% 结果验证规范 capability 已进入参数后的检索收益；EvidenceGold 则校准能力证据来源、accepted claim 与误接受边界。两类评测采用冻结数据、可重放记录和独立 Gate。表中规模类结果属于带日期的发布快照，生态现状以用户本机最新扫描为准。

## 兼容性与当前范围

- DeepAtlas 处于 public preview，DSH 处于 Developer Preview。
- 当前发布线覆盖 DSH `0.1.1-rc.1` / `0.1.1-rc.2` 与 Node 22.19 / 24。
- 安装分发使用 GitHub tag 或完整 commit SHA，仓库随包携带已构建 `lib/`。
- 当前发布的审计覆盖静态风险信号；Resolved Environment、隔离启动和任务验收将由后续 Capability Change Transaction 承接。
- `dryRun=true` 提供安全默认体验，真实安装由用户按 profile 显式启用。

DSH 每个新 RC 会先进入 compatibility canary：依赖契约、Windows/Linux 分发、配置组合、工具调用与真实启动全部通过后，再更新兼容矩阵。

## 更新与卸载

更新到新的锁定版本：

```bash
dsh plugin --profile web remove dsh-deepatlas
dsh plugin --profile web add https://codeload.github.com/Oscar-Williams/dsh-deepatlas/tar.gz/refs/tags/v0.2.3
```

卸载：

```bash
dsh plugin --profile web remove dsh-deepatlas
```

本地索引与审计记录保存在 `dataDir`；卸载插件后，这些数据会保留，便于再次安装时复用。

## 开发与验证

```bash
npm ci
npm test
npm run typecheck
npm run typecheck:tests
npm run build
```

v0.2.3 稳定版基线为 **26 个测试文件、131 项测试**。CI 覆盖 Node 22/24、Windows、Evidence 发布与精度 Gate、分发完整性、tarball 安装与启动验证，以及按 commit 安装的 nightly E2E。`lib/` 属于 GitHub 安装载荷，源码变更必须同步构建产物。

## 路线图

- **v0.2.2**：HTTPS 锁定版本安装、发布完整性、完整生态分片扫描、DSH rc.2 lossless JSON、审计授权收口、Windows CLI 与安装恢复链路。
- **v0.2.3（含 rc.x）**：完成 Evidence v2 的 provenance、冲突解析、迁移、覆盖率报告与回归 Gate。
- **v0.2.4（含 rc.x）**：完成 Capability Diagnosis、HostIntentGate、真实 DSH 会话重放和受控任务觉察。
- **v0.2.5（含多个 rc.x）**：交付完整 Capability Change Transaction，串联目标契约、精确候选、真实依赖解析、模块解析探针、完整 loader 启动、runtime delta、目标验收、策略结论、恢复对象和内容寻址 receipt。
- **v0.2.6**：强化依赖漂移与 capability reality 检查、多来源适配、故障注入和 receipt replay，并复用 DSH 可用的 safe-boot、doctor 和 capability declaration 接口。
- **v0.2.7 及后续 v0.2.x**：扩展主动保障、安装后验收、漂移与因果追踪、团队策略、可移植证明和 Verified Installability 指标。

完整里程碑、验收条件与 DSH 协同策略见 [v0.2.x 路线图](./docs/v0.2.x-roadmap.md)，事务模型见 [Capability Change Transaction 设计](./docs/capability-change-transaction.md)，环境事实层见 [Resolved Environment Preflight 工程规格](./docs/resolved-environment-preflight.md)。

## 项目名称

| 场景 | 名称 |
|---|---|
| 产品 | DeepAtlas |
| 完整名称 | DeepAtlas for DeepSeek Harness |
| GitHub 仓库 / DSH 包 | `dsh-deepatlas` |
| 中文说明 | DSH 本地能力保障与插件导航 |

## 致谢

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
- [Oh-My-DSH](https://github.com/like-study1/Oh-My-DSH)
- [awesome-deepseek-harness](https://github.com/Dominic789654/awesome-deepseek-harness)

## License

[MIT](./LICENSE) © 2026 DeepAtlas contributors
