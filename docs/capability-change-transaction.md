# Capability Change Transaction 设计

## 目标

Capability Change Transaction（CCT）把一次插件能力变更表达为可重放、可审阅、可撤销的本地事务。它回答四个连续问题：当前任务缺少什么能力，候选 artifact 的确切身份是什么，候选在当前 DSH 组合中实际改变了什么，以及这些变化是否完成了用户目标。

DSH Core 可提供启动、组合、recoverable bundle 与 doctor 等宿主事实；插件目录可提供候选和发布元数据。DeepAtlas 聚合这些事实，并将任务目标、运行时差异、策略结论和恢复对象绑定在同一份 receipt 中。

## 事务链路

```text
GoalContract
    │
    ▼
BeforeFingerprint ──→ ExactCandidate ──→ StructuralPreflight
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

### Acceptance probes

探针按证据强度分层：

1. 确定性注册探针：工具、服务、路由、权限和 schema 可见性；
2. 固定 fixture 行为探针：用可重放输入验证输出与副作用边界；
3. 任务级探针：围绕 `GoalContract` 验证目标结果；
4. 模型辅助解释：用于自然语言结果归一，保留原始输入输出、模型身份与置信度。

高风险安装必须含确定性或固定 fixture 证据。模型辅助结果可以触发 `review`，无法单独提升为自动 `pass`。

## 事务状态

```text
CREATED → FINGERPRINTED → RESOLVED → PREFLIGHTED → SHADOWED
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
- 结构预检、shadow parity、resolved graph/runtime delta；
- acceptance probe 原始事实与聚合结果；
- policy 版本、verdict、授权记录和安装状态；
- rollback artifact、恢复验证和关联 receipt；
- DSH、Node、操作系统与 DeepAtlas 版本。

凭据值、Session 正文和未经裁剪的任务上下文不进入 receipt。敏感字段仅保存存在性、作用域、策略结果或经明示允许的哈希。

## 与 DSH 的协同边界

- DSH safe boot / recoverable bundle：提供启动容错与结构化 fault，DeepAtlas 将 fault 纳入 shadow 和现场事务事实。
- DSH doctor / pre-boot checker：提供宿主级结构诊断，DeepAtlas 将结果绑定 exact candidate、GoalContract 与 receipt。
- DSH capability declaration：作为 publisher/host evidence 输入，仍需 runtime delta 与 acceptance probes 验证。
- DSH Developer Preview：所有宿主接口经 feature detection 和适配器访问；tested/next/manual canary 记录确切 artifact 与行为差异。

## 发布与质量指标

目录规模仅表示发现覆盖。能力保障使用以下指标：

- Verified Installability Rate；
- Pinned Publisher Coverage；
- Structural Preflight Pass Rate；
- Shadow Boot Pass Rate 与 Shadow/Live Parity；
- Runtime Registration Accuracy；
- Goal Acceptance Pass Rate；
- Rollback Success 与 Receipt Replay Success；
- 安装后漂移率和误归因率。

v0.2.5 稳定版要求完整事务在 Windows 与 WSL 上通过成功、阻断、超时、启动失败、探针失败和恢复失败的冻结场景。RC 可分段交付工程能力，稳定标签只在纵向链路和恢复证据同时闭合后发布。
