import { declaredSourceFiles, fetchArtifactAtCommit, listRepositoryRootAtCommit, resolveCommit, } from './github-artifacts.js';
const emptyCoverage = (status, observedAt, errors = []) => ({
    status, requiredRoles: [], fetchedRoles: [], errors, observedAt,
});
export async function hydratePublisherEvidence(repository, options = {}) {
    const observedAt = options.observedAt ?? new Date().toISOString();
    const fetcher = options.fetcher ?? fetch;
    let commit;
    try {
        commit = await resolveCommit(repository, options.ref ?? 'HEAD', options.token, options.signal, fetcher);
    }
    catch (error) {
        return { observations: [], artifacts: [], type: 'unknown', coverage: emptyCoverage('failed', observedAt, [error instanceof Error ? error.message : String(error)]) };
    }
    let root;
    try {
        root = await listRepositoryRootAtCommit(repository, commit, options.token, options.signal, fetcher);
    }
    catch (error) {
        return {
            commit, observations: [], artifacts: [], type: 'unknown',
            coverage: { ...emptyCoverage('failed', observedAt, [error instanceof Error ? error.message : String(error)]), commit },
        };
    }
    const files = root.filter((entry) => entry.type === 'file');
    const byLowerName = new Map(files.map((entry) => [entry.name.toLowerCase(), entry.path]));
    const packagePath = byLowerName.get('package.json');
    const skillPath = byLowerName.get('skill.md');
    const readmePath = files.find((entry) => /^readme(?:\.[a-z0-9_-]+)?$/i.test(entry.name))?.path;
    if (!packagePath && !skillPath && !readmePath) {
        return { commit, observations: [], artifacts: [], type: 'unknown', coverage: { ...emptyCoverage('not-applicable', observedAt), commit } };
    }
    const required = new Map();
    if (packagePath)
        required.set('manifest', packagePath);
    if (skillPath)
        required.set('skill', skillPath);
    if (readmePath)
        required.set('readme', readmePath);
    const fetched = new Map();
    const errors = [];
    const fetchRole = async (role, path) => {
        const result = await fetchArtifactAtCommit(repository, path, commit, options.token, options.signal, fetcher);
        if (!result.artifact)
            errors.push(`${role}:${result.error ?? '不可用'}`);
        else
            fetched.set(role, result.artifact);
        return result.artifact;
    };
    let manifest;
    if (packagePath) {
        const artifact = await fetchRole('manifest', packagePath);
        if (artifact) {
            try {
                manifest = JSON.parse(artifact.text);
                const declared = declaredSourceFiles(manifest);
                if (declared.error)
                    errors.push(`manifest:${declared.error}`);
                else
                    for (const [index, path] of declared.files.entries())
                        required.set(`entry:${index}`, path);
            }
            catch (error) {
                errors.push(`manifest:package.json 解析失败:${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
    for (const [role, path] of required)
        if (!fetched.has(role))
            await fetchRole(role, path);
    const observations = [];
    const observation = (role, values, sourceKind) => {
        const artifact = fetched.get(role);
        if (!artifact)
            return;
        observations.push({
            values,
            provenance: {
                sourceId: `publisher-${role}`, sourceKind, authority: 'publisher', repository,
                ref: { kind: 'commit', value: commit }, path: artifact.path, contentSha256: artifact.contentSha256,
                observedAt, originGroup: `publisher:${repository}:${role}`,
            },
        });
    };
    if (manifest) {
        const keywords = Array.isArray(manifest.keywords) ? manifest.keywords.filter((value) => typeof value === 'string') : [];
        observation('manifest', {
            name: typeof manifest.name === 'string' ? manifest.name : '',
            description: typeof manifest.description === 'string' ? manifest.description : '',
            topics: keywords,
            provides: [],
        }, 'manifest');
    }
    const readme = fetched.get('readme');
    if (readme)
        observation('readme', { name: '', description: readme.text, topics: [], provides: [] }, 'github-contents');
    const skill = fetched.get('skill');
    if (skill)
        observation('skill', { name: '', description: skill.text, topics: [], provides: [] }, 'github-contents');
    const fetchedRoles = [...fetched.keys()].sort();
    const requiredRoles = [...required.keys()].sort();
    const status = errors.length === 0 && fetchedRoles.length === requiredRoles.length ? 'complete'
        : fetchedRoles.length ? 'partial' : 'failed';
    const dsh = manifest?.dsh;
    const type = skillPath ? 'skill'
        : dsh && typeof dsh === 'object' && dsh.bundle ? 'bundle'
            : dsh ? 'cordis' : 'unknown';
    return {
        commit, observations, type,
        artifacts: [...fetched.values()].map(({ path, contentSha256, size }) => ({ path, contentSha256, size })),
        coverage: { status, commit, requiredRoles, fetchedRoles, errors, observedAt },
    };
}
//# sourceMappingURL=publisher-evidence.js.map