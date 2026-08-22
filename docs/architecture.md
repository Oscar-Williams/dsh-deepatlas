# DeepAtlas 架构设计

> 本文档描述 P0 骨架的模块划分与数据流,P1–P4 演进在各模块 TODO 中标注。

## 模块总览

```
src/
├── index.ts              插件入口(name/inject/Config/apply,注册 5 个工具)
├── config.ts             schemastery 配置定义(安全默认值:dryRun=true)
├── cli.ts                独立 CLI(scan/status),不依赖 DSH 运行时
├── types.ts              共享类型(PluginMeta/QualityScore/AuditReport/...)
├── core/
│   ├── scanner.ts        M1 编排:多源抓取 → 去重合并 → 白名单标记 → 评分 → 落盘
│   ├── ranker.ts         M2 纯函数评分:活跃0.35+社区0.25+可信0.25(+匹配0.15预留)
│   ├── index-store.ts    本地索引 JSON 读写(原子替换、schemaVersion、TTL)
│   ├── auditor.ts        M4 规则引擎:package.json 快照 → 分级报告
│   ├── installer.ts      M5 安装闸门:同意+非red+锁commit → 命令生成/执行
│   └── sources/
│       ├── types.ts      EcosystemSource 统一接口
│       ├── github-topic.ts   GitHub search API 分页抓取(速率限制感知)
│       └── awesome-list.ts   awesome 清单解析(兜底与白名单)
└── tools/                DSH 工具层(defineTool 定义,参数校验,中文输出)
    ├── scan.ts           deepatlas_scan / deepatlas_status
    ├── find.ts           deepatlas_find(关键词预筛,语义排序交给模型)
    ├── audit.ts          deepatlas_audit(抓 raw package.json)
    └── install.ts        deepatlas_install(闸门 + dryRun)
```

## 关键设计决策

### 1. 检索与语义排序分离
`deepatlas_find` 只做确定性关键词预筛(中英混合分词:英文按词、中文 2-gram),
返回候选元数据;语义匹配、重叠对比、推荐理由由 DSH 自身模型完成。
**不引入外部 ML 服务**——生态变化快,模型判断随 DSH 升级自动升级。

### 2. 质量分为纯函数
`ranker.ts` 全部纯函数(时间基准可注入),测试覆盖单调性;
评分权重集中在模块头注释,校准只改一处。

### 3. 审计与安装强隔离
`installer.planInstall()` 不信任调用方:即使工具层传错,
闸门仍独立校验 userConsent / audit.level / commit 三条件。
红色风险的拒绝理由必须包含触发的规则名(可解释性)。

### 4. 索引原子写与版本化
`IndexStore.save` 走 tmp+rename 原子替换;`schemaVersion` 不符视为需重建,
避免旧结构索引被新代码误读。

## 数据流(安装闭环)

```
用户:"帮我接入微信并监控用量"
  → 模型调 deepatlas_find(need)
  → 预筛候选(含 quality 分解、重叠提示、安装预览)
  → 模型语义排序,渲染推荐卡片,征询用户
  → 用户选定 → deepatlas_audit(target)
  → 报告(绿/黄/红 + 证据)展示给用户 → 用户显式同意
  → deepatlas_install(target, commit, auditLevel, userConsent)
  → 闸门放行 → [P3 真实执行] dsh plugin --profile X add github:owner/repo#commit
  → 提示重启 → 反馈记录(P4)
```

## P1–P4 演进要点

- **P1**:github-topic 全量分页(约 80 页/7800 仓库)与 `since` 增量;
  provides 字段真实抽取(读仓库文件清单判定 bundle/cordis/skill);
- **P2**:find 返回重叠对比的结构化数据;质量分权重配置化;
- **P3**:installer 真实执行(execFile + 输出捕获);auditor 扩展源码树扫描
  (child_process 引用、fs 写范围、env 读取)与 npm audit;
- **P4**:反馈日志(feedback.json)→ 同类降权;UserPromptSubmit 事件驱动的主动推荐。
