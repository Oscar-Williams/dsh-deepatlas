# DeepAtlas 架构

DeepAtlas 以 DSH bundle 形式挂载六个工具，将能力诊断、生态发现、证据采集、审计和安装拆成相互约束的确定性模块。宿主模型负责理解自然语言，所有改变 profile 的动作由工具层闸门控制。长期架构以本地 Capability Assurance 为中心，逐步覆盖变更前验证、变更后验收与漂移追踪。

## 交互触发与运行边界

插件挂载时向 DSH 注册六个工具。每个 DSH 步骤会将当前可见工具的名称、说明和参数 schema 提供给宿主模型；模型生成相应 tool call 后，DeepAtlas 进入具体工具的 `execute()`。当前 v0.2.x 的任务理解发生在会话内，调用表现由模型、提示词和可见工具集合共同决定。

| 能力 | 触发条件 | 运行边界 |
|---|---|---|
| 扫描 | `deepatlas_scan` 收到 `confirm=true` | 在当前 DSH 进程中执行长时网络调用，完成后返回来源状态并原子更新索引 |
| 检索 | 宿主模型调用 `deepatlas_find` | 读取既有本地索引；索引缺失或过期时返回扫描提示 |
| 顾问 | 宿主模型调用 `deepatlas_advise` | 对照当前 profile；`silent` 表示本次调用后的静默结论 |
| 审计 | 用户给出目标仓库和 commit | 在锁定 commit 上采集静态风险与兼容证据 |
| 安装 | 匹配审计缓存且用户明确授权 | 经过快照、安装、组合验证和恢复状态机 |

HostIntentGate 将测量普通自然语言请求促使宿主模型选择 DeepAtlas、生成规范 capability 并完成检索的端到端表现。该 Gate 与检索器的确定性回归分别报告，便于定位任务理解和候选检索两层问题。

## 模块图

```text
src/
├── index.ts                 DSH 插件入口与六工具注册
├── config.ts                Schemastery 配置与安全默认值
├── cli.ts                   独立 scan / status / backfill CLI
├── types.ts                 索引、风险、推荐与数据源类型
├── core/
│   ├── scanner.ts           数据源编排、合并、富化、能力证据与落盘
│   ├── github-artifacts.ts  固定 commit 的仓库 artifact 读取与哈希
│   ├── publisher-evidence.ts 发布者 manifest、README 与入口覆盖
│   ├── evidence-report.ts   结构、来源完整性与发布 Gate
│   ├── sources/
│   │   ├── github-topic.ts  时间分片 GitHub Search、分页、限流与取消
│   │   ├── awesome-list.ts  社区清单发现
│   │   └── enrich.ts        旧类型富化兼容模块（由固定提交证据链取代）
│   ├── capabilities.ts      28 类 capability 与字段级证据
│   ├── retrieval.ts         多字段候选检索
│   ├── ranker.ts            质量与任务匹配评分
│   ├── audit-v1.ts          静态审计规则模型（报告结构版本）
│   ├── audit-cache.ts       audit-v3 内容寻址授权缓存
│   ├── compat.ts            Node/native/build 兼容检查
│   ├── installplan.ts       安装与恢复状态机
│   ├── rollback.ts          profile 快照、恢复与清理
│   ├── dsh-cli.ts           当前 launcher 复用与跨平台 fallback
│   └── index-store.ts       原子索引持久化与 TTL
└── tools/
    ├── scan.ts              deepatlas_scan / deepatlas_status
    ├── find.ts              deepatlas_find
    ├── advise.ts            deepatlas_advise
    ├── audit.ts             deepatlas_audit
    ├── install.ts           deepatlas_install
    └── common.ts            DSH lossless JSON 输出边界
```

## 生态索引

完整扫描以 `topic:dsh-plugin` 为主发现入口。GitHub Search 每个查询最多开放 1,000 条结果，因此数据源从 GitHub 仓库时代起点到当前时间递归切分稳定的 `created` 区间，直到每个分片都可完整分页。增量扫描沿用该创建时间分片，并附加 `pushed:>上次构建时间` 过滤条件。

扫描器按规范仓库 ID 去重，将 awesome 清单作为补充来源。GitHub Search 记录归类为平台发现证据，社区清单归类为社区证据；高质量候选会先解析完整 commit，再在同一 SHA 下读取 manifest、README 和声明入口。每个 artifact 记录仓库路径与 SHA-256，publisher coverage 独立报告 complete、partial、failed 与 not-applicable。索引写入前生成 capability evidence 和质量分，每个来源同时记录抓取模式、条目数、上游报告总数、截断状态和错误信息。

数据完整性规则：

- `AbortSignal` 贯穿工具、扫描器、fetch、退避与富化流程。
- 主发现源异常时，完整扫描在旧索引上保守合并社区来源。
- 临时文件带 PID 与 UUID，完成写入后原子替换正式索引。
- v1 索引可确定性迁移为 `legacy-partial` 供检索回退；稳定发布 Gate 要求原生 v2 索引、完整数据源和固定提交的 publisher cohort。

## 任务理解与检索

```text
自然语言任务
   ├── 静态 capability 抽取
   └── DSH 宿主模型提供受 enum 约束的 capability
                    │
                    ▼
          capability 并集 + 字段级证据
                    │
                    ▼
        候选预筛 → 任务分 → 质量分 → Top N
```

模型输出只进入规范 capability 通道。候选资格、实体 kind、权重、质量信号与安装预览都由本地代码计算。`deepatlas_advise` 读取当前 profile 的组合树，将已装插件 ID 与索引中的 `capsEv` 精确关联，在能力已覆盖时返回 silent。

## 审计授权

`deepatlas_audit` 接收规范 `owner/repo` 与完整 40 位 commit SHA。它在该 commit 上获取 manifest 与静态源码信号，生成风险报告和运行时兼容结论。

成功结果以以下键写入缓存：

```text
sha256(owner/repo#commit | audit-v3)
```

`deepatlas_install` 的公共参数只有 `target`、`commit` 与 `userConsent`。安装器使用同一 `target + commit` 读取缓存，直接采用缓存中的风险等级和兼容结论。manifest 获取失败、缓存缺失、红色风险、兼容冲突与缺少用户确认都会阻断状态机。

## 安装状态机

```text
RESOLVED
   │ 审计缓存 / 兼容性 / 用户确认
   ▼
APPROVED ── dryRun ──→ PLANNED
   │
   │ 快照 + dsh plugin add
   ▼
INSTALLED
   │ dump-config 组合验证
   ▼
COMPOSED ── 外部启动验证 ──→ BOOT_VERIFIED ──→ ACTIVE
   │
   └── 执行或验证失败 → FAILED → ROLLING_BACK
                                      ├──→ ROLLED_BACK
                                      └──→ ROLLBACK_FAILED
```

同一 profile 已存在目标行时进入 `REJECTED_DUPLICATE`。真实执行只通过当前 DSH launcher 或经过参数约束的系统 fallback 完成。工具返回 `dryRun`、`executed`、`composed` 与 `active`，让调用方按事实呈现当前阶段。

## DSH 生命周期边界

Web profile 运行中的插件无法在同一端口内重启宿主，因此工具内完成到 `COMPOSED`。用户重启对应 profile 后，外部分发 E2E 负责验证启动与工具注册。公开版本的 CI 同时覆盖 Windows、Node 22/24、tarball 安装、GitHub commit 安装和启动冒烟。

## Capability Assurance 演进阶段

- **v0.2.3 / Evidence v2**：来源可追踪、置信度可校准、字段冲突可解释；publisher artifact 固定 commit，并完成迁移、覆盖率与精度 Gate。
- **v0.2.4 / Capability Diagnosis + HostIntentGate**：测量真实 DSH 意图链路，区分已有能力、配置问题、兼容问题与新增能力缺口；在稳定生命周期接口上加入受控任务觉察。
- **v0.2.5 / Capability Change Gate**：让 GitHub、SkillHub、npm 和本地包共用变更证据、策略、授权与验证接口。
- **v0.2.6–v0.2.8 / Preflight、Shadow Runtime、Integrity Capsule**：从静态组合推进到隔离启动验证，再把完整验证事实封装为内容寻址胶囊。
- **v0.2.9 及后续 v0.2.x / Active Assurance**：任务阶段感知、安装后验收、漂移与因果追踪，并随 DSH 发布持续维护兼容 canary、迁移与安全响应。

详细发布 Gate 与协同规则见 [v0.2.x 路线图](./v0.2.x-roadmap.md)。
