/**
 * 内容寻址审计缓存(P3.5-D)
 * key = sha256(repo#commit | auditor-vN):commit 变更自动失效,
 * 规则版本升级自动失效(评审:不要按 repo 缓存)。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
export const AUDITOR_VERSION = 'audit-v1';
export function cacheKey(repo, commit) {
    return createHash('sha256').update(`${repo}#${commit}|${AUDITOR_VERSION}`).digest('hex').slice(0, 24);
}
export class AuditCache {
    file;
    constructor(dataDir) {
        this.file = path.join(dataDir, 'audit-cache.json');
    }
    async load() {
        try {
            return JSON.parse(await fs.readFile(this.file, 'utf8'));
        }
        catch {
            return {};
        }
    }
    async get(repo, commit) {
        const all = await this.load();
        return all[cacheKey(repo, commit)]?.report ?? null;
    }
    async put(repo, commit, report) {
        const all = await this.load();
        all[cacheKey(repo, commit)] = { at: new Date().toISOString(), report };
        await fs.mkdir(path.dirname(this.file), { recursive: true });
        const tmp = `${this.file}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(all, null, 2), 'utf8');
        await fs.rename(tmp, this.file);
    }
}
//# sourceMappingURL=audit-cache.js.map