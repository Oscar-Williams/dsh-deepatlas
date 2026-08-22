/**
 * PluginRecord 知识模型(P2):把"仓库条目"升级为"能力与要求图谱"
 *
 * DeepAtlas 的护城河不是搜索,而是归一化后的插件知识:功能、运行要求、
 * 信任与风险。record 由 package.json 清单(+索引元数据)构建,
 * 兼容性结论由 compat.checkCompatibility 给出。
 */
import { CompatibilityRequirement } from './compat.js'

export interface PluginRecord {
  /** owner/repo */
  id: string
  name: string
  version: string
  description: string
  /** 插件类型(bundle/cordis/skill),来自索引或清单推断 */
  type: 'bundle' | 'cordis' | 'skill' | 'unknown'
  /** 是否声明 dsh.bundle(bundle 角色) */
  declaresBundle: boolean
  license: string
  enginesNode?: string
  nativeDependencies: string[]
  buildScripts: string[]
  /** 依赖总数(粗粒度供应链面) */
  dependencyCount: number
  /** 元数据来源说明 */
  evidence: string[]
}

const BUILD_SCRIPTS = ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish']

/** 已知 native addon(与 compat.ts 同步维护) */
const KNOWN_NATIVE = ['koffi', 'node-pty', 'protobufjs', 'sharp', 'better-sqlite3', 'node-gyp-build']

export function buildPluginRecord(
  id: string,
  manifest: Record<string, unknown> | null,
  meta?: { name?: string; type?: string; description?: string; license?: string },
): PluginRecord {
  const evidence: string[] = []
  if (manifest) evidence.push('package.json')

  const deps = {
    ...((manifest?.dependencies ?? {}) as Record<string, string>),
    ...((manifest?.optionalDependencies ?? {}) as Record<string, string>),
  }
  const scripts = (manifest?.scripts ?? {}) as Record<string, string>
  const buildScripts = BUILD_SCRIPTS.filter((k) => typeof scripts[k] === 'string' && scripts[k].trim() !== '')

  const record: PluginRecord = {
    id,
    name: (manifest?.name as string) ?? meta?.name ?? id.split('/')[1] ?? id,
    version: (manifest?.version as string) ?? '0.0.0',
    description: (manifest?.description as string) ?? meta?.description ?? '',
    type: (meta?.type as PluginRecord['type']) ?? 'unknown',
    declaresBundle: Boolean(manifest && typeof manifest.dsh === 'object' && manifest.dsh !== null && 'bundle' in (manifest.dsh as object)),
    license: (manifest?.license as string) ?? meta?.license ?? 'unknown',
    enginesNode: typeof manifest?.engines === 'object' && manifest?.engines !== null
      ? String((manifest.engines as Record<string, string>).node ?? '') || undefined
      : undefined,
    nativeDependencies: Object.keys(deps).filter((d) => KNOWN_NATIVE.includes(d)),
    buildScripts,
    dependencyCount: Object.keys(deps).length,
    evidence,
  }
  if (record.declaresBundle) evidence.push('dsh.bundle 声明确认')
  return record
}

/** 转为兼容性检查输入 */
export function toRequirement(record: PluginRecord): CompatibilityRequirement {
  return {
    enginesNode: record.enginesNode,
    nativeDependencies: record.nativeDependencies,
    buildScripts: record.buildScripts,
  }
}
