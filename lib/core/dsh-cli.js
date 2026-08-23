import path from 'node:path';
export const DSH_PROFILE_NAME = /^[a-z0-9._-]+$/i;
export function isDshProfileName(value) {
    return DSH_PROFILE_NAME.test(value);
}
/**
 * Reuse the exact DSH launcher that owns the current plugin process. This keeps
 * plugin management working when DSH was installed locally and is not on PATH.
 */
export function dshInvocation(args, runtime = process) {
    const launcher = runtime.argv[1];
    const normalized = launcher ? launcher.replaceAll('\\', '/') : '';
    const packagedLauncher = normalized.includes('/@deepseek-ai/dsh/') && path.posix.basename(normalized) === 'bin.js';
    const sourceLauncher = /\/apps\/cli\/(?:lib\/bin\.js|src\/bin\.ts)$/.test(normalized);
    if (launcher && (packagedLauncher || sourceLauncher)) {
        return { command: runtime.execPath, args: [launcher, ...args] };
    }
    if (runtime.platform === 'win32') {
        return {
            command: process.env.ComSpec ?? 'cmd.exe',
            args: ['/d', '/s', '/c', 'dsh.cmd', ...args],
        };
    }
    return { command: 'dsh', args };
}
//# sourceMappingURL=dsh-cli.js.map