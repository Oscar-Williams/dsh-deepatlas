import { createHash } from 'node:crypto';
import { isFullCommitSha, isGithubRepoSlug } from './git-ref.js';
const API = 'https://api.github.com';
export const MAX_ARTIFACT_BYTES = 1_048_576;
const headersFor = (token, raw = false) => ({
    Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
});
export function normalizeRepositoryPath(value) {
    const path = value.trim().replace(/^\.\//, '').replace(/\\/g, '/');
    if (!path || path.startsWith('/') || path.split('/').includes('..'))
        return null;
    return path;
}
export async function resolveCommit(repository, ref = 'HEAD', token, signal, fetcher = fetch) {
    if (!isGithubRepoSlug(repository))
        throw new Error('repository 必须使用 owner/repo 格式');
    if (isFullCommitSha(ref))
        return ref.toLowerCase();
    const url = `${API}/repos/${repository}/commits/${encodeURIComponent(ref)}`;
    const response = await fetcher(url, { headers: headersFor(token), signal });
    if (!response.ok)
        throw new Error(`commit 解析失败:GitHub API ${response.status}`);
    const body = await response.json();
    if (!body.sha || !isFullCommitSha(body.sha))
        throw new Error('commit 解析失败:响应缺少完整 SHA');
    return body.sha.toLowerCase();
}
export async function fetchArtifactAtCommit(repository, file, commit, token, signal, fetcher = fetch, maxBytes = MAX_ARTIFACT_BYTES) {
    const normalized = normalizeRepositoryPath(file);
    if (!isGithubRepoSlug(repository) || !isFullCommitSha(commit) || !normalized) {
        return { artifact: null, error: `${file} 获取失败:仓库、commit 或路径非法` };
    }
    const encoded = normalized.split('/').map(encodeURIComponent).join('/');
    const url = `${API}/repos/${repository}/contents/${encoded}?ref=${encodeURIComponent(commit)}`;
    try {
        const response = await fetcher(url, { headers: headersFor(token, true), signal });
        if (!response.ok)
            return { artifact: null, error: `${normalized} 获取失败:GitHub API ${response.status}` };
        const text = await response.text();
        const bytes = Buffer.byteLength(text);
        if (bytes > maxBytes)
            return { artifact: null, error: `${normalized} 超过 ${maxBytes} 字节上限` };
        if (text.includes('\u0000'))
            return { artifact: null, error: `${normalized} 是二进制内容` };
        return {
            artifact: {
                repository, commit: commit.toLowerCase(), path: normalized, text, size: bytes,
                contentSha256: createHash('sha256').update(text).digest('hex'),
            },
        };
    }
    catch (error) {
        if (signal?.aborted)
            throw error;
        return { artifact: null, error: `${normalized} 获取失败:${error instanceof Error ? error.message : String(error)}` };
    }
}
function exportEntry(exportsValue) {
    if (typeof exportsValue === 'string')
        return exportsValue;
    if (!exportsValue || typeof exportsValue !== 'object')
        return undefined;
    const root = exportsValue['.'] ?? exportsValue;
    if (typeof root === 'string')
        return root;
    if (!root || typeof root !== 'object')
        return undefined;
    const conditions = root;
    return [conditions.import, conditions.default, conditions.require].find((value) => typeof value === 'string');
}
export function declaredSourceFiles(manifest) {
    const files = [];
    const entry = typeof manifest.main === 'string' ? manifest.main : exportEntry(manifest.exports);
    files.push(entry ?? 'index.js');
    const dsh = manifest.dsh;
    const bundle = dsh && typeof dsh === 'object' ? dsh.bundle : undefined;
    if (bundle && typeof bundle === 'object') {
        const patch = bundle.patch;
        if (typeof patch !== 'string' || patch.trim() === '')
            return { files, error: 'dsh.bundle.patch 缺失或不是字符串' };
        files.push(patch);
    }
    const normalized = [];
    for (const file of files) {
        const safe = normalizeRepositoryPath(file);
        if (!safe)
            return { files: [...new Set(files.map((item) => item.replace(/^\.\//, '')))], error: `manifest 声明了非法仓库内路径:${file}` };
        if (!normalized.includes(safe))
            normalized.push(safe);
    }
    return { files: normalized };
}
//# sourceMappingURL=github-artifacts.js.map