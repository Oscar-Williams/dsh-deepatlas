/**
 * GitHub 认证与限流感知(P2/A1,采纳外部评审意见)
 *
 * Token 解析优先级:配置指定环境变量名 → GITHUB_TOKEN → GH_TOKEN → 匿名。
 * Token 是"增强凭据"而非"必需凭据":无 Token 时匿名降级,功能可用仅配额受限。
 * 绝不持久化、日志或经工具输出回显 Token。
 */
import { DeepAtlasConfig } from '../config.js'

export function resolveGithubToken(config?: Pick<DeepAtlasConfig, 'githubTokenEnv'>): string | undefined {
  const names = [config?.githubTokenEnv ?? 'DEEPATLAS_GITHUB_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN']
  for (const name of names) {
    if (!name) continue
    const v = process.env[name]
    if (v && v.trim()) return v.trim()
  }
  return undefined
}

export function authMode(token?: string): 'authenticated' | 'anonymous' {
  return token ? 'authenticated' : 'anonymous'
}

export const RATE_FLOOR = 50 // core 剩余低于该值即收手,防二次限流封禁

/** 从响应读取限流事实(GitHub 标准头) */
export function rateInfoFromHeaders(h: Headers): { remaining?: number; reset?: number } {
  const remaining = Number(h.get('x-ratelimit-remaining') ?? '')
  const reset = Number(h.get('x-ratelimit-reset') ?? '')
  return {
    remaining: Number.isFinite(remaining) ? remaining : undefined,
    reset: Number.isFinite(reset) ? reset : undefined,
  }
}
