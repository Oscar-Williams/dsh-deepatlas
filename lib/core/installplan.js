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
    if (!input.userConsent)
        return advance(plan, 'REJECTED_CONSENT', '未获得用户显式同意');
    if (!input.audit)
        return advance(plan, 'REJECTED_AUDIT', '未找到与目标 commit 匹配的审计记录');
    if (input.audit.level === 'red')
        return advance(plan, 'REJECTED_AUDIT', '审计红色风险');
    if (!plan.commit)
        return advance(plan, 'REJECTED_UNPINNED', '未锁定 commit');
    if (!input.compatibilityOk)
        return advance(plan, 'REJECTED_COMPAT', '运行时不兼容(Node 引擎等硬性冲突)');
    return advance(plan, 'APPROVED');
}
/** 行匹配:name: 行内任意位置含插件名(兼容 @scope/name 形态) */
function rowMatches(dumpConfigOutput, pluginName) {
    const esc = pluginName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exactName = new RegExp(`^\\s*name:\\s*['\"]?${esc}['\"]?\\s*(?:#.*)?$`);
    return dumpConfigOutput.split(/\r?\n/).some((line) => exactName.test(line));
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
        return advance({ ...withCmd, state: 'APPROVED' }, 'PLANNED', '[dry-run] 仅生成命令,未执行');
    const r = await exec(cmd);
    if (r.code !== 0)
        return markFailed(withCmd, 'INSTALL', `安装命令退出码 ${r.code}:${r.output.slice(0, 200)}`);
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
/** COMPOSED → ACTIVE:宿主重启后的外部冒烟确认 */
export function markActiveIfBooted(plan, booted) {
    if (plan.state !== 'COMPOSED')
        return plan;
    return booted ? advance(plan, 'ACTIVE') : plan;
}
/** 任意执行中状态 → FAILED(验证失败进入故障分支,等待回滚) */
export function markFailed(plan, stage, reason) {
    const executing = ['APPROVED', 'INSTALLED', 'COMPOSED', 'BOOT_VERIFIED'];
    if (!executing.includes(plan.state))
        return plan;
    return advance(plan, 'FAILED', `${stage} 失败:${reason}`);
}
/** FAILED → ROLLING_BACK → ROLLED_BACK；恢复动作失败必须显式暴露。 */
export async function rollbackToSnapshot(plan, restore) {
    if (plan.state !== 'FAILED')
        return plan;
    const rolling = advance(plan, 'ROLLING_BACK');
    try {
        await restore();
        return advance(rolling, 'ROLLED_BACK');
    }
    catch (err) {
        return advance(rolling, 'ROLLBACK_FAILED', `回滚动作本身出错:${err instanceof Error ? err.message : String(err)}`);
    }
}
/** 用户层最终表述:只有 ACTIVE(成功)与 ROLLED_BACK(失败但已恢复)两种结语 */
export function finalVerdict(plan) {
    if (plan.state === 'ACTIVE')
        return 'ACTIVE';
    if (plan.state === 'ROLLED_BACK')
        return 'ROLLED_BACK';
    if (plan.state === 'ROLLBACK_FAILED')
        return 'ROLLBACK_FAILED';
    if (typeof plan.state === 'string' && plan.state.startsWith('REJECTED'))
        return 'BLOCKED';
    return 'IN_PROGRESS';
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