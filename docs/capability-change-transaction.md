# Capability Change Transaction 设计

## 目标

Capability Change Transaction（CCT）把一次插件能力变更表达为可重放、可审阅、可撤销的本地事务。它回答四个连续问题：当前任务缺少什么能力，候选 artifact 的确切身份是什么，候选在当前 DSH 组合中实际改变了什么，以及这些变化是否完成了用户目标。

DSH Core 可提供启动、组合、recoverable bundle 与 doctor 等宿主事实；插件目录可提供候选和发布元数据。DeepAtlas 聚合这些事实，并将任务目标、运行时差异、策略结论和恢复对象绑定在同一份 receipt 中。

## 事务链路

```text
GoalContract
    │
    ▼
BeforeFingerprint ──→ ExactCandidate ──→ ResolvedEnvironmentPreflight
                                                │
                                                ▼
                                        ShadowExecution
                                                │
                           ┌────────────────────┴────────────────────┐
                           ▼                                         ▼
                    ResolvedGraphDelta                       RuntimeDelta
                           └────────────────────┬────────────────────┘
                                                ▼
                                        AcceptanceProbes
                                                │
                                                ▼
                                         PolicyVerdict
                                      pass / review / block
                                                │
                              explicit approval │
                                                ▼
                          LiveApply ──→ AfterFingerprint ──→ Receipt
                              │
                              └── failure or regression ──→ RollbackArtifact
```

## 核心对象

### `GoalContract`

- 用户目标与裁剪后的任务上下文；
- 必需 capability、可选 capability 与 `mustNot`；
- 允许的权限、网络、文件、命令和凭据预算；
- acceptance probes、成功阈值与超时；
- 目标 profile 与用户授权范围。

Host model 可协助归一自然语言，工具层负责 enum、预算、策略和最终状态机。模型输出保留来源和置信度，policy verdict 只消费结构化事实。

### `CapabilityChangeCandidate`

候选身份与来源解耦：

| 来源 | 精确身份 |
|---|---|
| GitHub | `owner/repo` + 40 位 commit SHA + artifact hash |
| npm | package + exact version + `dist.integrity` |
| SkillHub | install-plan ID + pinned artifact identity + plan hash |
| 本地 | 规范绝对路径边界内的内容哈希与 manifest hash |

每个适配器输出相同的 capability、依赖、入口、权限与安装计划结构，后续 Gate 无需感知候选市场。

### Fingerprint 与 Delta

Fingerprint 至少记录 DSH artifact、Node、包管理器、profile manifest/lockfile/patch、resolved graph、已注册 runtime surface 和 DeepAtlas 策略版本。时间戳、临时端口、随机 ID 与绝对临时路径等 volatile 字段在比较前规范化。

`RuntimeDelta` 分别列出新增、移除和改变的 tools、services、routes、permissions、prompts、resources 与 lifecycle 行为。结构声明与实际注册分开保存，以便识别“声明存在、运行时缺失”和“运行时新增、声明未覆盖”两类偏差。

### `ResolvedEnvironment`

Resolved Environment 记录候选进入当前 profile 后的真实依赖闭包和模块解析结果。它以包管理器输出、lockfile、文件系统 realpath 与 Node resolution probe 为事实来源，覆盖：

- candidate artifact、安装来源、完整性与实际落盘位置；
- pnpm/npm lock resolution、依赖边、peer 约束与每个包的真实版本；
- profile、本机 DSH 与包管理器 store 之间的模块 shadowing；
- manifest `main`/`exports`、bundle entry 与声明入口的逐项 resolve 结果；
- 缺失发布文件、混合 DSH RC、重复宿主包、native ABI、端口和 loader ID 冲突；
- 完整 loader tree boot 以及 tool/service/route registration smoke。

Preflight 的通过条件同时包含真实 resolved graph、模块解析探针、完整 loader 启动和运行时注册冒烟。`dump-config` 继续作为组合事实之一，并与这些运行事实分别记录。

### Dependency Drift

Dependency Drift 比较四组事实：publisher 声明范围、候选开发基线、包管理器实际解析结果和当前 DSH tested baseline。检测项包括：

- resolved 版本超出声明范围；
- 同一 DSH 能力链出现 mixed RC 或重复宿主包；
- profile `node_modules` 覆盖内置/应用依赖；
- pnpm symlink anchor 导致 dependency closure 缺层；
- export map、入口声明与发布 artifact 文件集合不一致；
- dist-tag 指向与 exact artifact 选择之间的漂移。

所有安装与 replay 使用 exact version、commit 或 integrity。dist-tag 仅用于 canary 发现，并在 receipt 中解析为确切 artifact。

### Capability Reality

Capability Reality 将同一项能力拆为四层证据：

1. **Declared**：CAP/Capmark、manifest、README 或 DSH capability declaration；
2. **Inferred**：imports、inject、入口代码与静态规则推导出的权限和服务需求；
3. **Realized**：shadow boot 后实际注册的 tools、services、routes、permissions 与进程能力；
4. **Required**：`GoalContract` 为当前任务允许和需要的能力预算。

外部 capability 格式作为可追踪输入，由 DeepAtlas resolver 保留 authority、artifact identity 与推断方法。最终 verdict 比较 declared、inferred、realized 和 required，分别报告未声明行为、未实现声明、额外权限与任务所需覆盖。

### Acceptance probes

探针按证据强度分层：

1. 确定性环境探针：依赖闭包、模块解析、loader boot、工具、服务、路由、权限和 schema 可见性；
2. 固定 fixture 行为探针：用可重放输入验证输出与副作用边界；
3. 任务级探针：围绕 `GoalContract` 验证目标结果；
4. 模型辅助解释：用于自然语言结果归一，保留原始输入输出、模型身份与置信度。

高风险安装必须含确定性或固定 fixture 证据。模型辅助结果可以触发 `review`，无法单独提升为自动 `pass`。

## 事务状态

```text
CREATED → FINGERPRINTED → RESOLVED → ENV_PROBED → SHADOWED
        → PROBED → VERDICTED → APPROVED → APPLIED → VERIFIED → SEALED

任一阶段失败 → FAILED → ROLLING_BACK → ROLLED_BACK | ROLLBACK_FAILED
策略阻断     → BLOCKED
等待用户确认 → REVIEW_REQUIRED
```

现场 profile 仅在 `pass` 或用户明确接受 `review` 后进入 `APPLIED`。安装后 fingerprint 与目标探针进入同一事务；验证失败时恢复对象和恢复结果写回 receipt。

## Receipt

Receipt 使用版本化 JSON Schema、规范字段顺序和内容寻址 ID，包含：

- GoalContract 摘要及其哈希；
- before/after fingerprint；
- exact candidate 与下载完整性；
- resolved environment、dependency drift、capability reality、shadow parity 与 runtime delta；
- acceptance probe 原始事实与聚合结果；
- policy 版本、verdict、授权记录和安装状态；
- rollback artifact、恢复验证和关联 receipt；
- DSH、Node、操作系统与 DeepAtlas 版本。

凭据值、Session 正文和未经裁剪的任务上下文不进入 receipt。敏感字段仅保存存在性、作用域、策略结果或经明示允许的哈希。

## 与 DSH 的协同边界

- DSH safe boot / recoverable bundle：提供启动容错与结构化 fault，DeepAtlas 将 fault 纳入 shadow 和现场事务事实。
- DSH doctor / pre-boot checker：提供宿主级结构诊断，DeepAtlas 将结果绑定 exact candidate、GoalContract 与 receipt。
- DSH capability declaration：作为 publisher/host evidence 输入，仍需 runtime delta 与 acceptance probes 验证。
- Capmark/CAP 等第三方 capability 格式：作为 declared/inferred evidence 输入，与运行时注册和任务预算联合解析。
- DSH Developer Preview：所有宿主接口经 feature detection 和适配器访问；tested/next/manual canary 记录确切 artifact 与行为差异。

## 发布与质量指标

目录规模仅表示发现覆盖。能力保障使用以下指标：

- Verified Installability Rate；
- Pinned Publisher Coverage；
- Structural Preflight Pass Rate；
- Module Resolution Probe Pass Rate 与 Dependency Drift Detection Recall；
- Shadow Boot Pass Rate 与 Shadow/Live Parity；
- Runtime Registration Accuracy；
- Capability Reality Precision；
- Goal Acceptance Pass Rate；
- Rollback Success 与 Receipt Replay Success；
- 安装后漂移率和误归因率。

v0.2.5 稳定版要求完整事务在 Windows 与 WSL 上通过成功、阻断、超时、缺失发布文件、dependency closure 缺层、mixed RC、模块 shadowing、export mismatch、启动失败、注册偏差、探针失败和恢复失败的冻结场景。单个社区案例用于提炼可重放 failure class；长期 Gate 围绕 artifact identity、resolution、boot、registration、goal 和 rollback 六个稳定边界组织。

Resolved Environment 的输入输出、探针阶段、失败分类与冻结矩阵见 [Resolved Environment Preflight 工程规格](./resolved-environment-preflight.md)。
