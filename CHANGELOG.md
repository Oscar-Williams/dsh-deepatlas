# Changelog

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
