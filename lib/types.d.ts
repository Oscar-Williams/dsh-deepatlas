/**
 * DeepAtlas 共享类型定义
 *
 * DeepAtlas(dsh-插件导航)是 DeepSeek Harness (DSH) 的插件生态导航:
 * 扫描 dsh-plugin 生态 → 建立本地索引 → 按任务推荐 → 安全审计 → 授权安装。
 */
/** DSH 插件类型(与生态三分法一致:bundle / Cordis / Skill) */
export type PluginType = 'bundle' | 'cordis' | 'skill' | 'unknown';
/** 索引条目:单个社区插件的全部静态元数据 */
export interface PluginMeta {
    /** 规范化标识,如 "owner/repo" */
    id: string;
    /** 仓库名,如 "dsh-web-ui" */
    name: string;
    /** 仓库地址 */
    repoUrl: string;
    /** 一句话描述(来自仓库自述,视为不可信输入,仅展示) */
    description: string;
    /** 插件类型 */
    type: PluginType;
    /** 实体分类(⑦.0-d):plugin/framework/collection/application/documentation/unknown */
    kind?: 'plugin' | 'framework' | 'collection' | 'application' | 'documentation' | 'unknown';
    /** 展示名(保留原始大小写;内部 join 一律用全小写 id,⑦.0-c) */
    displayName?: string;
    /** 能力证据记录(v3-B,扫描期固化;查询期不再从文本猜) */
    capsEv?: {
        id: string;
        confidence: number;
        ev: {
            source: string;
            text: string;
        }[];
    }[];
    /** 类型判定证据:heuristic=名称/描述关键词;contents=仓库文件清单精判 */
    typeSource?: 'heuristic' | 'contents';
    /** GitHub star 数 */
    stars: number;
    /** 最近一次推送时间(ISO 8601) */
    lastPushedAt: string;
    /** 开源协议(spdx id 或 "none") */
    license: string;
    /** 仓库 topics */
    topics: string[];
    /** 是否已归档(回填自 GitHub) */
    archived?: boolean;
    /** 是否为 fork(回填自 GitHub) */
    fork?: boolean;
    /** 默认分支(回填自 GitHub) */
    defaultBranch?: string;
    /** 元数据最近一次回填时间(<7 天不重抓) */
    metadataFetchedAt?: string;
    /** 死链(404/删除/改名),推荐与 Top10 过滤 */
    deadLink?: boolean;
    /** 是否命中 awesome-dsh-plugin 白名单 */
    whitelisted: boolean;
    /** 提供的 skills / commands / 工具清单(扫描时可得的粗粒度摘要) */
    provides: string[];
    /** 质量分(0-100,由 ranker 计算) */
    quality?: QualityScore;
    /** 数据来源(如 "github-topic" / "awesome-list") */
    source: string;
    /** 该条目的抓取时间(ISO 8601) */
    fetchedAt: string;
}
/** 质量分:静态部分 85 + 预留匹配度 15 */
export interface QualityScore {
    /** 总分 0-100 */
    total: number;
    /** 活跃度(权重 0.35):最近提交距今越近越高 */
    activity: number;
    /** 社区认可(权重 0.25):star 数对数缩放 */
    community: number;
    /** 可信度(权重 0.25):白名单、协议、命名规范 */
    trust: number;
    /** 匹配度(权重 0.15,仅推荐阶段计算,静态索引中为 0) */
    match: number;
}
/** 本地生态索引(持久化为 JSON) */
export interface AtlasIndex {
    /** 索引结构版本,破坏性变更时递增 */
    schemaVersion: number;
    /** 全量重建 / 增量刷新时间 */
    builtAt: string;
    /** 各数据源最近一次抓取状态 */
    sources: SourceHealth[];
    /** 去重后的插件条目 */
    plugins: PluginMeta[];
}
/** 数据源健康记录 */
export interface SourceHealth {
    sourceId: string;
    ok: boolean;
    itemCount: number;
    fetchedAt: string;
    /** 本次抓取模式:全量或增量(基于上次 builtAt) */
    mode?: 'full' | 'incremental';
    error?: string;
}
/** 审计风险等级 */
export type AuditLevel = 'green' | 'yellow' | 'red';
/** 单条审计发现 */
export interface AuditFinding {
    /** 规则标识,如 "lifecycle-scripts" */
    rule: string;
    /** 风险等级 */
    level: Exclude<AuditLevel, 'green'>;
    /** 证据描述(文件/字段/值) */
    evidence: string;
    /** 面向用户的中文说明 */
    explanation: string;
}
/** 审计报告 */
export interface AuditReport {
    /** 目标插件 */
    target: string;
    /** 综合风险等级:任一 red 即 red;否则任一 yellow 即 yellow;否则 green */
    level: AuditLevel;
    findings: AuditFinding[];
    /** 审计依据的内容快照说明(哪些文件/字段被检查过) */
    scope: string[];
    /** 是否锁定了具体 commit */
    commitPinned: boolean;
    auditedAt: string;
}
/** 推荐卡片:交给 DSH 模型渲染与用户确认的最小单元 */
export interface Recommendation {
    plugin: PluginMeta;
    /** 匹配理由(由推荐器/模型生成) */
    reason: string;
    /** 与功能重叠插件的对比(结构化) */
    overlap?: {
        id: string;
        name: string;
        stars: number;
        quality: number;
        note: string;
    };
    /** 兼容展示:重叠提示文本(向后兼容) */
    overlapNote?: string;
    /** 安装命令预览(commit 锁定) */
    installCommandPreview: string;
    /** 审计摘要(若已执行) */
    auditSummary?: Pick<AuditReport, 'level' | 'findings'>;
}
/** 反馈记录:推荐 → 接受/拒绝 → 安装结果 → 事后卸载 */
export interface FeedbackRecord {
    /** 插件 id */
    pluginId: string;
    /** 用户对推荐的处理 */
    decision: 'accepted' | 'rejected' | 'ignored';
    /** 安装结果(仅 accepted 后存在) */
    installResult?: 'success' | 'failed';
    /** 事后是否被卸载 */
    uninstalledLater?: boolean;
    /** 触发推荐时的任务摘要(脱敏,仅存本地) */
    taskSnippet?: string;
    recordedAt: string;
}
