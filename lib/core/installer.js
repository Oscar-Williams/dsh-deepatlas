/** 生成安装命令(对齐生态惯例:dsh plugin --profile X add github:owner/repo#ref) */
export function buildCommand(req) {
    const [owner, repo] = req.target.split('/');
    const ref = req.commit ? `#${req.commit}` : '';
    return `dsh plugin --profile ${req.profile} add github:${owner}/${repo}${ref}`;
}
/** 闸门检查:同意与风险等级都满足才放行 */
export function planInstall(req, dryRun) {
    const command = buildCommand(req);
    const restartHint = '安装后需重启 dsh web 并刷新页面方可生效';
    if (!req.userConsent) {
        return { allowed: false, blockedReason: '未获得用户显式同意,拒绝安装', command, dryRun, restartHint };
    }
    if (req.audit.level === 'red') {
        return {
            allowed: false,
            blockedReason: `审计发现红色风险(${req.audit.findings.filter((f) => f.level === 'red').map((f) => f.rule).join(', ')}),请人工审查源码后手动安装`,
            command,
            dryRun,
            restartHint,
        };
    }
    if (!req.commit) {
        return { allowed: false, blockedReason: '未锁定 commit,拒绝安装(供应链安全)', command, dryRun, restartHint };
    }
    return { allowed: true, command, dryRun, restartHint };
}
/**
 * 执行安装。dryRun=true 时仅返回命令文本;
 * P3 实现真实执行(execFile 调 dsh CLI)并捕获输出与退出码。
 */
export async function executeInstall(plan, _exec) {
    if (!plan.allowed)
        throw new Error(plan.blockedReason);
    if (plan.dryRun || !_exec) {
        return `[dry-run] ${plan.command}`;
    }
    return _exec(plan.command);
}
//# sourceMappingURL=installer.js.map