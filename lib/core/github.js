export function resolveGithubToken(config) {
    const names = [config?.githubTokenEnv ?? 'DEEPATLAS_GITHUB_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN'];
    for (const name of names) {
        if (!name)
            continue;
        const v = process.env[name];
        if (v && v.trim())
            return v.trim();
    }
    return undefined;
}
export function authMode(token) {
    return token ? 'authenticated' : 'anonymous';
}
export const RATE_FLOOR = 50; // core 剩余低于该值即收手,防二次限流封禁
/** 从响应读取限流事实(GitHub 标准头) */
export function rateInfoFromHeaders(h) {
    const remaining = Number(h.get('x-ratelimit-remaining') ?? '');
    const reset = Number(h.get('x-ratelimit-reset') ?? '');
    return {
        remaining: Number.isFinite(remaining) ? remaining : undefined,
        reset: Number.isFinite(reset) ? reset : undefined,
    };
}
//# sourceMappingURL=github.js.map