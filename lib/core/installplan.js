export function newPlan(target, profile, commit) {
    return { target, commit, profile, state: 'RESOLVED', trace: [] };
}
function advance(plan, to, note) {
    const from = plan.state;
    return {
        ...plan,
        state: to,
        detail: note && to.startsWith('REJECTED') ? note : plan.detail,
        trace: [...plan.trace, { at: new Date().toISOString(), from, to, note }],
    };
}
/** RESOLVED → APPROVED:三重闸门 + 兼容性(P2 新增硬闸) */
export function approve(plan, input) {
    if (!input.compatibilityOk)
        return advance(plan, 'REJECTED_COMPAT', '运行时不兼容(Node 引擎等硬性冲突)');
    if (!input.userConsent)
        return advance(plan, 'REJECTED_CONSENT', '未获得用户显式同意');
    if (input.audit.level === 'red')
        return advance(plan, 'REJECTED_AUDIT', '审计红色风险');
    if (!plan.commit)
        return advance(plan, 'REJECTED_UNPINNED', '未锁定 commit');
    return advance(plan, 'APPROVED');
}
/** 行匹配:name: 行内任意位置含插件名(兼容 @scope/name 形态) */
function rowMatches(dumpConfigOutput, pluginName) {
    const esc = pluginName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`name:[^\\n]*${esc}`).test(dumpConfigOutput);
}
/** 装前查重(#2889):dump-config 输出已含目标插件行则拒绝 */
export function checkDuplicate(plan, dumpConfigOutput, pluginName) {
    if (rowMatches(dumpConfigOutput, pluginName)) {
        return advance(plan, 'REJECTED_DUPLICATE', `组合树已存在 ${pluginName} 行,再装将触发 duplicate loader entry(#2889)`);
    }
    return plan;
}
/** APPROVED → INSTALLED:执行安装命令(exec 注入以便测试) */
export async function install(plan, dryRun, exec) {
    if (plan.state !== 'APPROVED')
        return advance(plan, plan.state, '非 APPROVED 状态,拒绝执行');
    const [owner, repo] = plan.target.split('/');
    const cmd = `dsh plugin --profile ${plan.profile} add github:${owner}/${repo}${plan.commit ? '#' + plan.commit : ''}`;
    const withCmd = { ...plan, installCommand: cmd };
    if (dryRun || !exec)
        return advance({ ...withCmd, state: 'APPROVED' }, 'INSTALLED', '[dry-run] 仅生成命令,未执行');
    const r = await exec(cmd);
    if (r.code !== 0)
        return advance(withCmd, 'INSTALLED', `安装命令退出码 ${r.code}:${r.output.slice(0, 200)}`);
    return advance(withCmd, 'INSTALLED');
}
/** INSTALLED → COMPOSED:dump-config 断言目标行存在 */
export function verifyComposed(plan, dumpConfigOutput, pluginName) {
    if (plan.state !== 'INSTALLED')
        return plan;
    if (!rowMatches(dumpConfigOutput, pluginName))
        return advance(plan, 'INSTALLED', '组合树未见目标行,COMPOSED 失败(回退 INSTALLED)');
    return advance(plan, 'COMPOSED');
}
/** COMPOSED → ACTIVE:启动冒烟(本轮占位,P3 后续接 headless) */
export function markActiveIfBooted(plan, booted) {
    if (plan.state !== 'COMPOSED')
        return plan;
    return booted ? advance(plan, 'ACTIVE') : plan;
}
/** 是否可向用户宣告"安装成功" */
export function isActive(plan) {
    return plan.state === 'ACTIVE';
}
/** 兼容元数据查找辅助(从索引条目取名) */
export function pluginNameOf(meta) {
    return meta.name;
}
//# sourceMappingURL=installplan.js.map