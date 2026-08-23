/** 已知框架仓库(随生态演进维护;判定依据是"它就是宿主本体/其 fork",非 star) */
const FRAMEWORK_IDS = new Set(['deepseek-ai/deepseek-harness']);
export function classifyKind(input) {
    const id = input.id.toLowerCase();
    const text = `${input.name} ${input.description ?? ''}`.toLowerCase();
    if (FRAMEWORK_IDS.has(id))
        return 'framework';
    // harness 的 fork(整仓复刻宿主)同视为框架分发物
    if (input.fork && /harness/.test(id))
        return 'framework';
    if (/^awesome-|awesome[- ]|插件清单|curated|collection of/.test(text) && /awesome|list|清单/.test(text))
        return 'collection';
    if (/docs?|文档|tutorial|指南|guide/.test(text) && !/plugin|插件/.test(text))
        return 'documentation';
    if (/desktop app|桌面版|standalone|独立应用/.test(text))
        return 'application';
    return 'plugin';
}
/** 可安装性:框架/清单/文档不可装;归档与死链在外层过滤 */
export function isInstallable(kind) {
    return kind === 'plugin' || kind === 'application' || kind === 'unknown';
}
//# sourceMappingURL=kind.js.map