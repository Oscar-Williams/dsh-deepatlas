const BUILD_SCRIPTS = ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish'];
/** 已知 native addon(与 compat.ts 同步维护) */
const KNOWN_NATIVE = ['koffi', 'node-pty', 'protobufjs', 'sharp', 'better-sqlite3', 'node-gyp-build'];
export function buildPluginRecord(id, manifest, meta) {
    const evidence = [];
    if (manifest)
        evidence.push('package.json');
    const deps = {
        ...(manifest?.dependencies ?? {}),
        ...(manifest?.optionalDependencies ?? {}),
    };
    const scripts = (manifest?.scripts ?? {});
    const buildScripts = BUILD_SCRIPTS.filter((k) => typeof scripts[k] === 'string' && scripts[k].trim() !== '');
    const record = {
        id,
        name: manifest?.name ?? meta?.name ?? id.split('/')[1] ?? id,
        version: manifest?.version ?? '0.0.0',
        description: manifest?.description ?? meta?.description ?? '',
        type: meta?.type ?? 'unknown',
        declaresBundle: Boolean(manifest && typeof manifest.dsh === 'object' && manifest.dsh !== null && 'bundle' in manifest.dsh),
        license: manifest?.license ?? meta?.license ?? 'unknown',
        enginesNode: typeof manifest?.engines === 'object' && manifest?.engines !== null
            ? String(manifest.engines.node ?? '') || undefined
            : undefined,
        nativeDependencies: Object.keys(deps).filter((d) => KNOWN_NATIVE.includes(d)),
        buildScripts,
        dependencyCount: Object.keys(deps).length,
        evidence,
    };
    if (record.declaresBundle)
        evidence.push('dsh.bundle 声明确认');
    return record;
}
/** 转为兼容性检查输入 */
export function toRequirement(record) {
    return {
        enginesNode: record.enginesNode,
        nativeDependencies: record.nativeDependencies,
        buildScripts: record.buildScripts,
    };
}
//# sourceMappingURL=record.js.map