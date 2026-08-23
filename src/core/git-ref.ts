export const FULL_COMMIT_SHA = /^[0-9a-f]{40}$/i
export const GITHUB_REPO_SLUG = /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i

export function isFullCommitSha(value: string): boolean {
  return FULL_COMMIT_SHA.test(value.trim())
}

export function isGithubRepoSlug(value: string): boolean {
  return GITHUB_REPO_SLUG.test(value.trim())
}
