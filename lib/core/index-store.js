/**
 * 本地索引存储:JSON 文件读写、过期判断
 * 数据仅存本地,不上传(任务书安全红线 3)。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
export const SCHEMA_VERSION = 1;
export function defaultDataDir(explicit) {
    if (explicit && explicit.trim())
        return explicit;
    const base = process.env.DEEPATLAS_HOME ?? process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh');
    return path.join(base, 'deepatlas');
}
export class IndexStore {
    filePath;
    constructor(dataDir) {
        this.filePath = path.join(dataDir, 'index.json');
    }
    get location() {
        return this.filePath;
    }
    async load() {
        try {
            const raw = await fs.readFile(this.filePath, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed.schemaVersion !== SCHEMA_VERSION)
                return null; // 版本不符视为需重建
            return parsed;
        }
        catch {
            return null;
        }
    }
    async save(index) {
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });
        const tmp = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
        try {
            await fs.writeFile(tmp, JSON.stringify(index, null, 2), 'utf8');
            await fs.rename(tmp, this.filePath); // 原子替换,避免写一半损坏索引
        }
        finally {
            await fs.rm(tmp, { force: true });
        }
    }
    /** 索引是否已过期(TTL 小时) */
    isStale(index, ttlHours) {
        if (ttlHours <= 0)
            return false;
        const ageMs = Date.now() - Date.parse(index.builtAt);
        return Number.isNaN(ageMs) || ageMs > ttlHours * 3600_000;
    }
}
//# sourceMappingURL=index-store.js.map