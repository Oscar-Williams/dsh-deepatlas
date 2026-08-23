/**
 * Profile 快照与回滚(P3.5-lite)
 *
 * 安装前快照 profile 关键文件;安装/组合/启动验证失败时恢复,
 * 输出"已还原到安装前状态"。依赖目录(node_modules)不回滚——
 * package.json 恢复后,dsh 下次 plugin 操作会按清单 reconcile 清理。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
const SNAPSHOT_FILES = ['package.json', 'cordis.patch.yml', 'pnpm-workspace.yaml', 'pnpm-lock.yaml'];
const SNAP_DIR = '.deepatlas-backup';
export async function snapshotProfile(profileDir) {
    const snapDir = path.join(profileDir, SNAP_DIR);
    await fs.mkdir(snapDir, { recursive: true });
    const saved = [];
    for (const name of SNAPSHOT_FILES) {
        const src = path.join(profileDir, name);
        try {
            await fs.copyFile(src, path.join(snapDir, name));
            saved.push(name);
        }
        catch {
            /* 不存在的文件跳过 */
        }
    }
    return { profileDir, files: saved, at: new Date().toISOString() };
}
export async function restoreProfile(snap) {
    const snapDir = path.join(snap.profileDir, SNAP_DIR);
    const restored = [];
    for (const name of snap.files) {
        await fs.copyFile(path.join(snapDir, name), path.join(snap.profileDir, name));
        restored.push(name);
    }
    return { restored };
}
/** 丢弃快照(安装成功后调用,不留垃圾) */
export async function discardSnapshot(profileDir) {
    await fs.rm(path.join(profileDir, SNAP_DIR), { recursive: true, force: true });
}
//# sourceMappingURL=rollback.js.map