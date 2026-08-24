# Resolved Environment Preflight 工程规格

## 范围

Resolved Environment Preflight（REP）是 Capability Change Transaction 的环境事实层。输入为 exact candidate、当前 profile fingerprint 和隔离目录，输出为可规范化的依赖解析、模块解析、启动与注册事实。它不直接修改现场 profile。

该规格面向 v0.2.5 `rc.2` 的完整实现。v0.2.4 继续负责 Capability Diagnosis、HostIntentGate 与 `GoalContract` 输入质量，两条路线通过版本化接口衔接。

## 输入合同

```ts
interface ResolvedEnvironmentRequest {
  transactionId: string
  candidate: CapabilityChangeCandidate
  profile: ProfileFingerprint
  dsh: ExactDshArtifact
  node: ExactNodeRuntime
  packageManager: ExactPackageManager
  policy: PreflightPolicy
  signal?: AbortSignal
}
```

`candidate` 必须具备 commit、exact version + integrity、install-plan hash 或本地内容哈希之一。输入中的 tag、branch 和 dist-tag 在进入探针前解析为 exact artifact，并保留原始选择来源。

## 探针阶段

### 1. 隔离与快照

- 创建独立临时 `DSH_HOME`、profile 副本、package-manager store 视图和端口；
- 裁剪凭据，只复制 schema 与存在性信息；
- 记录现场 manifest、lockfile、patch、resolved config 和注册面 fingerprint；
- 所有临时路径写入 cleanup journal。

### 2. 安装解析

- 在隔离 profile 中执行与现场一致的安装计划；
- 保存 package-manager lockfile、list/why 输出与 peer diagnostics；
- 对每个节点记录 package name、version、integrity、logical path、realpath 和 dependency edges；
- 计算 declared range、resolved version、tested baseline 与重复宿主包差异。

### 3. 模块解析

- 对 manifest `main`、`exports`、bundle entry、patch 引用和声明入口逐项执行 Node resolve；
- 检查目标文件存在性、大小、格式、package boundary 和真实路径；
- 识别 profile shadowing、pnpm symlink anchor、缺失发布文件与 export mismatch；
- 对 native addon 记录 ABI、平台和架构匹配结果。

### 4. Loader 启动

- 先执行 `dump-config` 并保存 resolved graph；
- 使用独立端口启动完整 loader tree，等待明确的 ready/fault/timeout 终态；
- 收集 structured fault、stderr、退出码、启动时长和资源摘要；
- DSH 提供 recoverable bundle 或 doctor 时通过 feature detection 采集宿主事实。

### 5. 注册冒烟

- 枚举 tools、services、routes、permissions、prompts 和 resources；
- 对工具 schema 与基础调用执行确定性 smoke；
- 记录 restart、dispose 与可用 lifecycle probe；
- 生成 before/after registration delta 和声明/运行差异。

## 输出合同

```ts
interface ResolvedEnvironmentReport {
  schemaVersion: 1
  requestDigest: string
  artifact: ExactArtifactReceipt
  dependencyGraph: ResolvedDependencyGraph
  drift: DependencyDriftFinding[]
  moduleProbes: ModuleResolutionProbe[]
  boot: LoaderBootResult
  registration: RuntimeRegistrationSnapshot
  capabilityReality: CapabilityRealityDelta
  cleanup: CleanupResult
  verdict: 'pass' | 'review' | 'block'
}
```

报告字段采用固定顺序和规范路径。时间、临时目录、端口、PID 与随机 ID 进入 metadata，并在内容寻址 digest 前规范化。

## 失败分类

| 类别 | 示例 | 默认结论 |
|---|---|---|
| artifact | integrity 不符、声明入口未发布 | block |
| resolution | peer 越界、closure 缺层、mixed RC | review/block（按影响） |
| shadowing | profile 覆盖宿主核心包 | block |
| module | exports/入口无法解析、native ABI 不符 | block |
| boot | loader fault、退出、超时、端口冲突 | block |
| registration | 声明能力未注册、出现额外高风险权限 | review/block |
| cleanup | 临时环境无法完整清理 | review，并保留恢复指引 |

## 冻结验证矩阵

至少包含以下可重放 fixture：

1. 正常 exact artifact，完整闭包、启动和工具调用通过；
2. manifest 指向未打包 `lib`/`src` 文件；
3. pnpm 二层依赖只存在于真实 store path；
4. 宽 peer range 解析出 mixed DSH RC；
5. profile `node_modules` shadow 宿主 `dsh-tools`；
6. package `exports` 与实际文件集合不一致；
7. native addon ABI/平台不匹配；
8. loader ID、route、service 或端口冲突；
9. boot 成功且 tool registration 缺失；
10. declared capability 与 imports/inject 推断不一致；
11. runtime 注册超出 `GoalContract` 权限预算；
12. timeout、取消、cleanup 和 rollback 各阶段故障注入。

Windows 与 WSL 使用同一逻辑 fixture，并分别冻结路径、symlink/junction、shell launcher 和端口行为。DSH `tested`、`next`、`manual` 三通道记录 exact artifact，社区讨论只用于发现新的 failure class。

## 发布 Gate

- 所有 block fixture 必须在现场变更前终止；
- pass fixture 的 report 在 volatile normalization 后 byte-stable；
- dependency graph、module probe、boot 和 registration 任一缺失都会使报告进入 incomplete；
- cancellation 完成 cleanup journal，旧 profile 与旧索引保持原样；
- shadow/live parity、false pass、false block 和平均耗时分别报告；
- receipt 能够定位 exact artifact、DSH/Node/package-manager 和全部 probe 版本。

REP 与 Goal Acceptance 共同构成 CCT 稳定版 Gate：REP 证明候选在当前环境中形成了什么，Goal Acceptance 证明这些变化完成了什么。
