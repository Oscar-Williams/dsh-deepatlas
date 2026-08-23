import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { asLosslessJson, looseObjectOutput, renderJson } from './common.js';
import { newPlan, approve, checkDuplicate, install, verifyComposed, markFailed, rollbackToSnapshot } from '../core/installplan.js';
import { dshInvocation, isDshProfileName } from '../core/dsh-cli.js';
import { AuditCache } from '../core/audit-cache.js';
import { defaultDataDir } from '../core/index-store.js';
import { isFullCommitSha, isGithubRepoSlug } from '../core/git-ref.js';
import { discardSnapshot, restoreProfile, snapshotProfile } from '../core/rollback.js';
import { checkCompatibility, getRuntimeInfo } from '../core/compat.js';
import { toRequirement } from '../core/record.js';
const exec = promisify(execFile);
async function run(cmd, args, signal) {
    try {
        const { stdout } = await exec(cmd, args, { timeout: 120_000, signal });
        return { code: 0, output: stdout };
    }
    catch (err) {
        const e = err;
        return { code: e.code ?? 1, output: (e.stdout ?? '') + e.message };
    }
}
async function runDsh(args, signal) {
    const invocation = dshInvocation(args);
    return run(invocation.command, invocation.args, signal);
}
export function buildInstallTool(_ctx, config) {
    return {
        name: 'deepatlas_install',
        description: '安装社区插件(需先 deepatlas_audit)。四重闸门(同意/非红审计/锁 commit/兼容)+装前查重(防 #2889),全程状态机 trace 可审计,仅 ACTIVE 视为成功。dryRun 模式只生成命令。',
        parameters: {
            target: { type: 'string', required: true, description: '目标仓库,格式 owner/repo' },
            commit: { type: 'string', required: true, description: '锁定的完整 40 位 commit SHA(供应链安全,必填)' },
            userConsent: { type: 'boolean', required: true, description: '用户是否明确同意安装,必须由用户亲口/显式操作给出' },
        },
        output: { schema: looseObjectOutput, render: renderJson },
        async execute(args, execution) {
            execution?.signal?.throwIfAborted();
            const target = args.target.trim().toLowerCase().replace(/^github:/, '');
            if (!isDshProfileName(config.installProfile)) {
                return asLosslessJson({ ok: false, error: 'installProfile 仅允许字母、数字、点、下划线和连字符', plan: newPlan(target, config.installProfile, args.commit) });
            }
            if (!isGithubRepoSlug(target)) {
                return asLosslessJson({ ok: false, error: 'target 必须严格使用 owner/repo 格式', plan: newPlan(target, config.installProfile, args.commit) });
            }
            if (!isFullCommitSha(args.commit)) {
                return asLosslessJson({ ok: false, error: 'commit 必须是完整 40 位十六进制 SHA', plan: newPlan(target, config.installProfile, args.commit) });
            }
            // TOCTOU 不变量由内容寻址缓存强制实现：安装只读取同一 target+commit
            // 的 audit-v3 记录，风险等级与兼容结论不接受调用者输入。
            const cached = await new AuditCache(defaultDataDir(config.dataDir)).get(target, args.commit);
            const validLevel = cached && ['green', 'yellow', 'red'].includes(cached.level);
            const cachedAudit = cached?.target === target
                && cached.auditedRef === args.commit
                && cached.commitPinned === true
                && cached.provenance?.commitPinned === true
                && validLevel
                && cached.pluginRecord?.id === target
                && cached.pluginRecord.name.trim() !== ''
                ? cached
                : null;
            const auditedRecord = cachedAudit?.pluginRecord;
            const currentCompatibility = auditedRecord
                ? checkCompatibility(toRequirement(auditedRecord), getRuntimeInfo())
                : null;
            const auditedPackageName = auditedRecord?.name ?? '';
            let plan = newPlan(target, config.installProfile, args.commit);
            plan = approve(plan, {
                userConsent: args.userConsent,
                audit: cachedAudit,
                compatibilityOk: currentCompatibility?.ok === true,
            });
            if (plan.state !== 'APPROVED') {
                return asLosslessJson({ ok: false, dryRun: config.dryRun, error: plan.detail, plan });
            }
            if (plan.state === 'APPROVED' && !config.dryRun) {
                // 装前查重:读当前 profile 组合树(#2889)
                const dump = await runDsh(['--profile', config.installProfile, '--dump-config'], execution?.signal);
                plan = dump.code === 0
                    ? checkDuplicate(plan, dump.output, auditedPackageName)
                    : markFailed(plan, 'PRECHECK', `dump-config 退出码 ${dump.code}:${dump.output.slice(0, 200)}`);
            }
            const profileDir = path.join(process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh'), 'profiles', config.installProfile);
            let snapshot = null;
            if (plan.state === 'APPROVED' && !config.dryRun) {
                try {
                    snapshot = await snapshotProfile(profileDir);
                }
                catch (error) {
                    plan = markFailed(plan, 'SNAPSHOT', error instanceof Error ? error.message : String(error));
                }
            }
            const restoreSnapshot = async () => {
                if (!snapshot)
                    return;
                await restoreProfile(snapshot);
                const reconcile = await runDsh(['plugin', '--profile', config.installProfile, 'install', '--offline']);
                if (reconcile.code !== 0) {
                    throw new Error(`profile 依赖恢复失败(退出码 ${reconcile.code}):${reconcile.output.slice(0, 200)}`);
                }
                await discardSnapshot(snapshot);
            };
            if (plan.state === 'APPROVED') {
                plan = await install(plan, config.dryRun, async () => runDsh(['plugin', '--profile', config.installProfile, 'add', `github:${target}#${args.commit}`], execution?.signal));
            }
            if (plan.state === 'FAILED' && snapshot) {
                plan = await rollbackToSnapshot(plan, restoreSnapshot);
            }
            if (plan.state === 'INSTALLED' && !config.dryRun) {
                const dump = await runDsh(['--profile', config.installProfile, '--dump-config'], execution?.signal);
                plan = verifyComposed(plan, dump.output, auditedPackageName);
                if (plan.state === 'INSTALLED') {
                    plan = markFailed(plan, 'COMPOSED', dump.code === 0 ? '组合树未见目标插件' : `dump-config 退出码 ${dump.code}`);
                    if (snapshot)
                        plan = await rollbackToSnapshot(plan, restoreSnapshot);
                }
            }
            if (plan.state === 'COMPOSED' && snapshot)
                await discardSnapshot(snapshot);
            const planned = plan.state === 'PLANNED' && plan.trace.at(-1)?.note?.startsWith('[dry-run]') === true;
            const composed = plan.state === 'COMPOSED' || plan.state === 'ACTIVE';
            const active = plan.state === 'ACTIVE';
            const executed = !config.dryRun && composed;
            return asLosslessJson({ ok: planned || composed, dryRun: config.dryRun, executed, composed, active, plan });
        },
    };
}
//# sourceMappingURL=install.js.map