/**
 * 兼容性闸门(P2):运行时事实 vs 插件要求
 *
 * RuntimeInfo 来自当前进程(process.*);PluginRecord 的引擎/native/构建
 * 要求来自目标插件 package.json(经 auditor/record 抽取)。
 * checkCompatibility 输出可解释结论,供推荐卡与安装闸门共用。
 */
/** 迷你 semver:覆盖 engines 常见形态(exact、脱字号、波浪号、比较符、星号、双竖线联合) */
export function satisfiesRange(version, range) {
    const [major, minor, patch] = version.split('.').map((n) => Number.parseInt(n, 10));
    if (!Number.isFinite(major))
        return false;
    return range
        .split('||')
        .map((part) => part.trim())
        .some((part) => {
        if (part === '' || part === '*')
            return true;
        const m = /^(>=|<=|>|<|\^|~)?\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\.\w+)?$/.exec(part);
        if (!m)
            return false;
        const op = m[1] ?? '=';
        const rMajor = Number(m[2]);
        const rMinor = m[3] === undefined ? undefined : Number(m[3]);
        const rPatch = m[4] === undefined ? undefined : Number(m[4]);
        // 无次版本号的比较按通配处理(如 ">=24")
        const cmp = major !== rMajor
            ? Math.sign(major - rMajor)
            : rMinor !== undefined && minor !== undefined
                ? Math.sign(minor - (rMinor ?? 0))
                : 0;
        const eq = major === rMajor && (rMinor === undefined || minor === rMinor) && (rPatch === undefined || patch === rPatch);
        switch (op) {
            case '=':
                return major === rMajor && (rMinor === undefined || minor === rMinor);
            case '^':
                // 同 major 且不低于下界
                if (major !== rMajor)
                    return false;
                if (rMinor === undefined)
                    return true;
                if (minor !== rMinor)
                    return minor > rMinor;
                return rPatch === undefined || patch >= rPatch;
            case '~':
                if (major !== rMajor || rMinor === undefined || minor !== rMinor)
                    return major === rMajor && minor === rMinor;
                return rPatch === undefined || patch >= rPatch;
            case '>=':
                return cmp > 0 || eq || (rMinor === undefined && major === rMajor) || (rMinor !== undefined && major === rMajor && minor > rMinor);
            case '>':
                return cmp > 0 && !eq;
            case '<=':
                return cmp < 0 || eq;
            case '<':
                return cmp < 0 && !eq;
            default:
                return false;
        }
    });
}
export function getRuntimeInfo() {
    return {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.versions.node,
        packageManager: 'pnpm', // dsh plugin 即 pnpm 转发器(cli-capture/0001)
        dshVersion: 'unknown',
    };
}
/** 已知 native addon 包名(装前需 allowBuilds 且平台相关) */
const KNOWN_NATIVE = ['koffi', 'node-pty', 'protobufjs', 'sharp', 'better-sqlite3', 'node-gyp-build'];
export function checkCompatibility(req, runtime) {
    const reasons = [];
    let node;
    if (!req.enginesNode) {
        node = { pass: 'unknown', detail: '未声明 engines.node,按 DSH 自身要求评估' };
    }
    else {
        const pass = satisfiesRange(runtime.nodeVersion, req.enginesNode);
        node = { pass, detail: pass ? `Node ${runtime.nodeVersion} 满足 ${req.enginesNode}` : `Node ${runtime.nodeVersion} 不满足 ${req.enginesNode}` };
        if (!pass)
            reasons.push(node.detail);
    }
    const nativeHit = req.nativeDependencies.filter((d) => KNOWN_NATIVE.includes(d));
    const platformNote = nativeHit.length
        ? `含 native addon(${nativeHit.join(', ')}),二进制与 ${runtime.platform}/${runtime.arch} 相关,装前确认平台可用`
        : '无已知 native addon';
    const buildRequired = req.buildScripts.length > 0;
    const build = {
        required: buildRequired,
        note: buildRequired
            ? `含安装期脚本(${req.buildScripts.join(', ')}),pnpm 将要求 allowBuilds 放行`
            : '无安装期脚本,免 allowBuilds',
    };
    return { ok: reasons.length === 0, node, platform: { note: platformNote }, build, reasons };
}
//# sourceMappingURL=compat.js.map