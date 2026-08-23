export const FULL_COMMIT_SHA = /^[0-9a-f]{40}$/i;
export const GITHUB_REPO_SLUG = /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i;
export function isFullCommitSha(value) {
    return FULL_COMMIT_SHA.test(value.trim());
}
export function isGithubRepoSlug(value) {
    return GITHUB_REPO_SLUG.test(value.trim());
}
//# sourceMappingURL=git-ref.js.map