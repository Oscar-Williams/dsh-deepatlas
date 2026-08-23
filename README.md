# DeepAtlas for DeepSeek Harness（dsh-插件导航）

[![CI](https://github.com/Oscar-Williams/dsh-deepatlas/actions/workflows/ci.yml/badge.svg)](https://github.com/Oscar-Williams/dsh-deepatlas/actions/workflows/ci.yml)
[![DSH](https://img.shields.io/badge/DSH-0.1.1--rc.1%20%7C%20rc.2-blue)](./docs/compatibility.md)
[![Status](https://img.shields.io/badge/status-public%20preview-blueviolet)](./CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

DeepAtlas 是 DeepSeek Harness（DSH）的任务感知插件导航。它维护一份包含 3000+ 条目的本地生态索引，根据当前任务检索候选插件，在安装前展示风险信号，并通过显式授权、commit 锁定和回滚状态机约束安装流程。

> DeepAtlas 与 DSH 都处于预览阶段。DSH 当前仍可能发生兼容性破坏；安装第三方插件等同于在 DSH 进程中运行第三方代码。DeepAtlas 的审计结果是风险提示，不是安全证明。

[English](./README.en.md) · [架构](./docs/architecture.md) · [安全模型](./docs/security.md) · [兼容契约](./docs/compatibility.md) · [更新记录](./CHANGELOG.md)

## 核心能力

- **本地生态索引**：聚合 GitHub `dsh-plugin` topic、awesome 清单和实时仓库元数据，记录活跃度、许可证、归档、fork 与可安装实体类型。
- **能力检索**：使用 28 类中英 capability、多字段检索和质量分生成候选；宿主模型可把任务归一为受 enum 约束的 capability 数组，但不参与审计或安装决策。
- **风险信号审计**：检查来源、生命周期脚本、依赖形态、native 依赖和源码风险模式；缓存与仓库 commit、内容及审计规则版本绑定。
- **安装安全边界**：要求用户明确同意、非红色审计、兼容性通过，并强制“被审计的 commit = 被安装的 commit”。
- **事务状态机**：记录从 RESOLVED 到 ACTIVE 的安装阶段；失败进入回滚链路，只有 ACTIVE 才能表述为安装成功。
- **安静顾问**：`deepatlas_advise` 根据任务能力和已安装插件判断缺口；已有能力足够或证据不足时保持安静。

## 安装

前提：Node.js `^22.19.0 || >=24.0.0`，并且已经能够运行 DSH：

```bash
npx @deepseek-ai/dsh web
```

安装当前公开版本：

```bash
dsh plugin --profile <profile> add github:Oscar-Williams/dsh-deepatlas#v0.2.0
```

安装后重启对应的 DSH profile。六个工具将注册为：

`deepatlas_scan` · `deepatlas_status` · `deepatlas_find` · `deepatlas_audit` · `deepatlas_install` · `deepatlas_advise`

首次使用时，让 Agent “扫描插件索引”。扫描访问 GitHub；可选的 `DEEPATLAS_GITHUB_TOKEN` 只用于提高 API 限额。索引、审计缓存和安装记录保存在本地 `dataDir`。

`dryRun` 默认是 `true`：此时安装工具只生成命令和状态记录，不调用 DSH CLI。需要真实安装时，必须由用户主动修改配置，并继续满足审计、授权与 commit 锁定条件。

## 典型流程

```text
生态来源 ──→ 本地索引 ──→ deepatlas_find ──→ 候选与证据
                                                │
用户选择 ──→ deepatlas_audit ──→ 风险信号 ──→ 用户明确同意
                                                │
                                                └──→ deepatlas_install
                                                     commit 锁定 / 组合 / 启动验证 / 回滚

当前任务 ──→ capability 归一 ──→ deepatlas_advise
                                      ├── 能力已具备：silent
                                      └── 存在可信缺口：建议 1–3 个候选
```

## 工具

| 工具 | 作用 | 关键边界 |
|---|---|---|
| `deepatlas_scan` | 扫描并重建本地索引 | 只写入 `dataDir` |
| `deepatlas_status` | 查看索引数量、时间和 TTL | 不触发扫描或安装 |
| `deepatlas_find` | 按任务和 capability 检索候选 | 返回候选，不判定“安全” |
| `deepatlas_audit` | 审计指定仓库与 commit | 输出风险信号和 `auditedRef` |
| `deepatlas_install` | 执行安装计划 | 同意、审计、commit、兼容性缺一不可 |
| `deepatlas_advise` | 识别能力缺口 | 默认安静，证据不足不打扰 |

## 配置

| 配置 | 默认值 | 说明 |
|---|---|---|
| `dataDir` | `~/.dsh/deepatlas` | 索引、缓存和记录目录 |
| `installProfile` | `web` | 检查与安装使用的 DSH profile |
| `indexTtlHours` | `24` | 索引过期阈值 |
| `minStars` | `0` | 推荐候选的最低 star 数 |
| `githubTokenEnv` | `DEEPATLAS_GITHUB_TOKEN` | 可选 GitHub Token 环境变量名 |
| `dryRun` | `true` | 默认只生成安装计划，不执行安装 |

## 评测状态

不同 Gate 回答不同问题，不能把它们合并为一个“泛化分数”。

| Gate / 数据集 | 当前结果 | 能证明什么 |
|---|---:|---|
| RetrievalDev（冻结 dev-30） | Recall@20 96.7%；Top3-SA 93.3%；mustNot@3 0 | 已知开发意图上的确定性检索回归 |
| Independent holdout-15 | Top3-SA 26.7% | 纯静态口语任务泛化仍然不足 |
| NormalizedIntentRetrieval（120 改写） | 静态 50.8% → 注入标准 capability 后 85.0% | capability 通道有效；**不等同于宿主模型能正确理解意图** |
| AdvisorSafety fixture | 推荐 5/5；静默 5/5；误报 0 | 小型确定性回归，不代表真实会话分布 |

下一阶段的 HostIntentGate 将单独评估“自然语言 → DSH 宿主模型 → capability 数组”，不会继续把预先提供的标准 capability 记作完整泛化能力。

## 开发与验证

推荐在 WSL2/Linux 中使用 Node.js 22.19 或 24：

```bash
npm ci
npm test                # 当前：16 个测试文件，78 个测试
npm run typecheck
npm run typecheck:tests
npm run build           # 生成并提交 lib/
```

本仓库的 CI 还包括 Node 22/24、Windows、分发完整性、tarball 安装与启动验证，以及按 commit 安装的 nightly E2E。由于 `lib/` 属于 GitHub 安装包的一部分，修改 `src/` 后必须重新构建并确认产物无漂移。

## 安全边界

1. 未经用户明确同意，不安装插件、不修改 profile。
2. 安装必须锁定 commit；审计 commit 与安装 commit 不一致时拒绝执行。
3. 红色风险拒绝自动安装；黄色和绿色都不构成安全保证。
4. 仓库 README、描述和 topic 均是不可信输入，不能作为工具指令执行。
5. 默认不上传索引、任务或安装记录。
6. `dryRun=true` 时不会调用真实安装命令。

详见 [安全模型](./docs/security.md)。

## 已知限制与路线

- DSH 仍处于 Developer Preview；DeepAtlas 当前验证范围是 DSH `0.1.1-rc.1` 和 `0.1.1-rc.2`。
- HostIntentGate 尚未建立，现有 85.0% 指标依赖标准 capability 输入。
- `capsEv` 只覆盖当前索引的一部分，0.6/0.9 置信度尚未作为完整的来源权重使用。
- 审计是静态风险信号集合，不是沙箱、签名验证或恶意行为证明。
- 默认 `dryRun=true`；真实安装需要显式启用。
- 尚未发布到 npm，当前通过 commit/tag 锁定的 GitHub 源安装。

近期顺序：`v0.2.1 发布完整性 → HostIntentGate → Evidence v2 → 上游 DSH 兼容 canary`。在 DSH API 稳定前，DeepAtlas 保持 0.x，并针对每个 DSH RC 更新兼容矩阵。

## 命名

| 场景 | 名称 |
|---|---|
| 产品 | DeepAtlas |
| 完整名称 | DeepAtlas for DeepSeek Harness |
| GitHub 仓库 | `dsh-deepatlas` |
| DSH 插件名 | `dsh-deepatlas` |
| 中文说明 | dsh-插件导航 |

## 致谢

- [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)
- [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
- [Oh-My-DSH](https://github.com/like-study1/Oh-My-DSH)
- [awesome-deepseek-harness](https://github.com/Dominic789654/awesome-deepseek-harness)

## License

[MIT](./LICENSE) © 2026 DeepAtlas contributors
