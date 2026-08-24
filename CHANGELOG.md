# Changelog

## Unreleased（v0.2.3-rc.x）

### Evidence v2 与产品说明

- 建立 provenance-backed capability evidence：事实 atom、派生 claim、冲突与 supersede 校验、v1 确定性迁移、公开 v2 JSON Schema，以及结构/发布双 Gate。
- GitHub Search 降为平台发现证据；高质量候选在同一完整 commit 下读取 publisher manifest、README 与声明入口，记录路径、内容哈希和独立 coverage 状态。
- 装前审计与索引共享固定 commit 的 artifact 读取、入口解析、路径约束、大小与二进制边界；发布 Gate 拒绝来源失败、截断、缺失 publisher 固定证据和 stale claims。
- 新增冻结 Evidence gold：accepted precision、recall 与 must-not 假接受进入无网络 CI Gate。
- WSL2 Ubuntu 26.04 同轮全量扫描生成 12,076 条原生 v2 索引与 20,194 个 atoms；结构/发布 Gate 均通过，脱敏凭据记录索引哈希、来源健康度和 publisher coverage。
- 中英文 README 明确会话驱动的工具选择、经确认的生态扫描、基于本地索引的日常检索，以及审计与安装的独立授权步骤。
- 产品路线统一为持续的 v0.2.x 发布序列；v0.2.3、v0.2.4、v0.2.5 为近期里程碑，后续按实际范围延续 v0.2.6 及更高版本。
- 根据 DSH recoverable startup、隔离升级实践与动态组装器的生态进展，v0.2.5 收束为完整 Capability Change Transaction；目录规模转为覆盖背景，后续质量指标聚焦可安装性、运行时差异、目标验收与恢复重放。
- 中英文 README 将用户目标、调用边界和受控变更前置，扫描规模集中到带日期的评测凭据；Resolved Environment Preflight 规格补充真实依赖解析、模块探针、完整 loader boot、注册冒烟、依赖漂移与 capability reality 验收矩阵。
- 当前开发回归基线为 26 个测试文件、131 项测试；v0.2.2 稳定版继续保持 22 个测试文件、108 项测试。

## v0.2.2（2026-08-23）

### 安装体验

- README 中英文安装与更新命令统一改用 GitHub Codeload HTTPS 锁定版本地址，覆盖 Windows、WSL 与限制 GitHub SSH 连接的网络环境。
- 全新 WSL DSH_HOME 已完成公开标签安装、`dump-config` 组合验证与 Web HTTP 200 启动验证。
- WSL 开发工具统一到 `dsh-deepatlas` Conda 环境；贡献指南同步 Node、pnpm、DSH 与 108 项测试基线。
- 首次扫描说明同步完整性验证规模、进度反馈、GitHub Token 与网络连通条件，并给出增量刷新建议。
- `v0.2.1` 标签保持不可变；`v0.2.2` 汇入同一批运行时稳定性改进并作为当前推荐版本。

## v0.2.1（2026-08-23）

### 运行时稳定性

- DSH `0.1.1-rc.2` 工具输出统一转换为 lossless JSON，修复可选字段中的 `undefined` 导致工具结果被宿主拒绝。
- `deepatlas_advise` 的 dump runner 改为构建期闭包注入，使用当前 `installProfile`，并在本地安装环境中复用实际 DSH launcher。
- Windows CLI fallback 使用受控 `cmd.exe /d /s /c dsh.cmd` 调用；profile、仓库 slug 与完整 SHA 均在执行前校验。
- 扫描、网络请求、退避等待与子进程贯穿 DSH `AbortSignal`；取消后停止请求并保留最后一份有效索引。
- `DSH_HOME` 进入默认数据目录解析，索引与审计缓存采用唯一临时文件原子替换。

### 生态扫描

- 新增官方 awesome 清单入口；GitHub topic 发现按创建/推送时间递归分片，完整跨越 Search API 的单查询 1,000 条上限。
- 数据源健康记录增加 `reportedTotal` 与 `truncated`；完整扫描的主发现源失败时，在旧索引上保守合并降级数据。
- 增量扫描按稳定的 `created` 时间分片并附加 `pushed` 刷新条件，进度输出报告已读取条目与分片页数。

### 审计与安装

- 审计协议升级为 `audit-v3`：manifest、真实入口或 bundle patch 获取失败均按 fail-closed 处理，旧缓存自动失效。
- 安装公开参数收口为 `target + 完整 commit + userConsent`；风险等级与兼容结论只从同一 `target + commit` 的内容寻址缓存读取。
- dry-run 使用独立 `PLANNED` 状态，返回 `executed/composed/active` 事实字段。
- 真实安装增加 profile 快照、装前查重、安装退出码检查、装后组合验证和恢复流程；恢复失败使用独立 `ROLLBACK_FAILED` 状态。

### 发布与文档

- 纳入 `v0.2.0` tag 之后的测试修复与 nightly YAML 修复；既有公开 tag 保持不可变。
- `deepatlas_find` 与 `deepatlas_advise` 共用 capability 单一事实源，补齐 `messaging-telegram` 与 `web-search`。
- 中英文 README 采用一致的 Quick Start、完整配置、安全边界、更新卸载与路线图，并同步完整扫描规模、进度与网络/API 配额条件。
- `package.json`、`package-lock.json`、Node engines 与 tag 版本统一；回归基线更新为 22 个测试文件、108 项测试。

## v0.2.0(2026-08-23)

### Retrieval v3:TaskIntent 混合归一 + 能力证据
- `deepatlas_find`/`deepatlas_advise` 新增 `capabilities` 参数(28 规范 ID):
  模型理解口语任务后传入,检索层静态抽取 ∪ 模型归一——模型只理解意图,
  搜索/审计/排序/安装仍由确定性代码掌控(零外部服务);
- 能力证据固化入索引(capsEv:字段来源+命中别名+置信度,1767/3016);
  advise 已装能力改为 ID→索引精确 join(v0.1.1 遗留项闭环);
- **Gate 结果**:RetrievalDev PASS(回归一致);NormalizedIntentRetrieval
  PASS——Paraphrase Suite 120 查询对照:静态 SA 50.8%→注入标准 capability 后
  **85.0%**,稳定率 6.7%→**56.7%**,mustNot@3=0。该结果证明 capability
  通道有效,不代表宿主模型意图识别已经通过;AdvisorSafety fixture **PASS**
  (静默 5/5,推荐 5/5,零误报)。

## v0.1.1(2026-08-23)

可靠性补丁(评审第九轮三处 P0,均经源码核实):

- **engines.node 修正**:`>=18` → `^22.19.0 || >=24.0.0`(发布元数据与
  兼容契约/docs/compatibility.md 对齐;Node 18/20 用户此前不会被拦住);
- **advise 修复 profile 硬编码**:dump-config 读取器改为闭包绑定
  `config.installProfile`,消除"检测 web / 安装 headless"的不一致;
- **已装能力推断保守化**:移除对 dump 全文跑 alias 的兜底(配置文本
  含某词 ≠ 具备该能力);精确路径(Installed IDs →
  PluginRecord.capabilities)排入 Retrieval v3-B;
- README 双语润色:开头去口号腔,安装步骤对齐真实流程(pinned tag)。

## v0.1.0(2026-08-23)

首个公开预览版。工程链路全绿,推荐质量如实标注。

### 核心
- 生态索引:3016 插件,2927 条真实 GitHub 元数据(star/pushedAt/license/archived/fork),死链标记
- 检索 v2:28 类中英 capability taxonomy + 多字段加权(capability×5/name×4/desc×3/topics×2),拉丁别名词边界
- Eligibility:死链/归档/kind(framework/collection/docs 不可装)结构性过滤,mustNot@3=0
- AuditReport v1 + 内容寻址缓存;源码风险信号(非安全判定)
- InstallPlan 状态机(RESOLVED→ACTIVE;FAILED→ROLLED_BACK),TOCTOU 不变量,#2889 装前查重
- P4.1 能力缺口安静顾问 deepatlas_advise(按 capabilities 判缺口)
- 分发双闸门 CI(distribution-integrity / distribution-e2e tarball 语义)
- 双平台真实 E2E(WSL2 + Windows 原生),故障注入回滚,密钥三重扫描全净

### 基准(如实)
- dev-30:Recall@20 96.7% / Top3-SA 93.3% / Top3-Strong 83.3% / gate PASS
- holdout-15(只跑一次):Top3-SA 26.7% —— 口语化改写暴露 taxonomy 覆盖不足

### 已知限制(v0.1.1 计划)
1. taxonomy 别名扩容与查询归一化(口语任务召回);
2. 扩容后需新建第二套 holdout 再验证;
3. npm audit 子命令联动(v1.1);
4. nightly github:#SHA 全真分发 E2E;
5. 官方 DSH 0.2 破坏性变更监控(cli-capture 体系在位)。

### 安装
```bash
dsh plugin --profile <profile> add github:Oscar-Williams/dsh-deepatlas#v0.1.0
```
