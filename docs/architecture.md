# DeepAtlas 架构

DeepAtlas 以 DSH bundle 形式挂载六个工具，将生态发现、检索、审计和安装拆成相互约束的确定性模块。宿主模型负责理解自然语言，所有改变 profile 的动作仍由工具层闸门控制。

## 模块图

```text
src/
├── index.ts                 DSH 插件入口与六工具注册
├── config.ts                Schemastery 配置与安全默认值
├── cli.ts                   独立 scan / status / backfill CLI
├── types.ts                 索引、风险、推荐与数据源类型
├── core/
│   ├── scanner.ts           数据源编排、合并、富化、能力证据与落盘
│   ├── sources/
│   │   ├── github-topic.ts  时间分片 GitHub Search、分页、限流与取消
│   │   ├── awesome-list.ts  社区清单发现
│   │   └── enrich.ts        仓库内容与类型富化
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

扫描器按规范仓库 ID 去重，将 awesome 清单作为补充来源，再对高质量候选读取仓库内容完成类型富化。索引写入前生成 capability evidence 和质量分。每个来源记录抓取模式、条目数、上游报告总数、截断状态和错误信息。

数据完整性规则：

- `AbortSignal` 贯穿工具、扫描器、fetch、退避与富化流程。
- 主发现源异常时，完整扫描在旧索引上保守合并社区来源。
- 临时文件带 PID 与 UUID，完成写入后原子替换正式索引。
- schema 版本变化会触发重建，避免新代码读取旧结构。

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

## 下一阶段

- **HostIntentGate**：冻结自然语言改写集，通过真实 DSH 会话捕获模型提交的 capability 参数，输出逐意图准确率、稳定率、混淆矩阵、覆盖率与误报。
- **Evidence v2**：将 capability 证据扩展为来源可追踪、置信度可校准、字段冲突可解释的索引结构，并提供迁移与回归 Gate。
- **DSH canary**：每个新 RC 自动执行依赖解析、配置组合、六工具 smoke、Windows/Linux 安装与回滚验证。
