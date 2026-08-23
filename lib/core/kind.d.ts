/**
 * 插件实体分类(P3.8/⑦.0-d,采纳评审第八轮)
 *
 * 结构性解决"官方 harness/awesome 清单混入推荐":由 kind+installable
 * 判定,而非 benchmark 点名特判(防泄漏)。scanner 与 benchmark 共用。
 */
export type PluginKind = 'plugin' | 'framework' | 'collection' | 'application' | 'documentation' | 'unknown';
export declare function classifyKind(input: {
    id: string;
    name: string;
    description?: string;
    fork?: boolean;
}): PluginKind;
/** 可安装性:框架/清单/文档不可装;归档与死链在外层过滤 */
export declare function isInstallable(kind: PluginKind): boolean;
