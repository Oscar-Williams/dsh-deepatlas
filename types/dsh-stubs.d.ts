/**
 * DSH 运行时依赖的本地类型桩(仅开发/CI 使用)
 *
 * 在未安装 @deepseek-ai/* peer 依赖的环境(如独立 clone 后跑 typecheck/test)
 * 提供最小类型,使 tsc/vitest 可离线运行;DSH 环境真实包存在时,
 * 模块解析优先命中 node_modules,本桩自动失效。
 * 接入真实环境后请对照 docs/verification-checklist.md 核实签名。
 */
declare module '@deepseek-ai/schemastery' {
  export const Schema: any
}

declare module '@deepseek-ai/dsh-tools' {
  export const defineTool: <T>(tool: T) => T
}

declare module '@deepseek-ai/cordis' {
  export interface ToolService {
    register(tool: unknown): void
  }
  export interface Logger {
    info(...args: unknown[]): void
    warn(...args: unknown[]): void
    error(...args: unknown[]): void
  }
  export interface Context {
    tools: ToolService
    logger: Logger
    on(event: string, callback: () => void): void
  }
}
