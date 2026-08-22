/**
 * 安全审计器(M4):安装的前置门槛
 *
 * 审计规则(借鉴 dsh-find-plugins 并扩展),当前版本基于 package.json
 * 清单快照;P3 扩展为抓取仓库源码树做静态扫描 + npm audit。
 * 输出结构化报告:风险分级(绿/黄/红)+ 逐条证据,红色一律拒绝自动安装。
 */

/** 审计输入:目标插件的清单快照与仓库信息 */
export interface AuditInput {
  /** "owner/repo" */
  target: string
  /** 目标仓库的 package.json(解析后的对象;skill 型插件可能没有,传 null) */
  manifest: Record<string, unknown> | null
  /** 是否锁定到具体 commit */
  commitPinned: boolean
  /** 仓库是否在白名单 */
  whitelisted: boolean
}

interface Rule {
  id: string
  level: 'yellow' | 'red'
  /** 返回证据字符串表示命中,null 表示未命中 */
  check: (input: AuditInput) => string | null
  explanation: string
}

const LIFECYCLE_SCRIPTS = ['preinstall', 'install', 'postinstall', 'prepublish', 'prepare']

const RULES: Rule[] = [
  {
    id: 'lifecycle-scripts',
    level: 'red',
    check: (i) => {
      const scripts = (i.manifest?.scripts ?? {}) as Record<string, string>
      const hit = LIFECYCLE_SCRIPTS.filter((k) => typeof scripts[k] === 'string' && scripts[k].trim() !== '')
      return hit.length ? `package.json#scripts 命中: ${hit.join(', ')}` : null
    },
    explanation: '包含安装期生命周期脚本,任意代码会在安装时执行——供应链攻击最常见入口,需人工审查脚本内容。',
  },
  {
    id: 'unpinned-commit',
    level: 'yellow',
    check: (i) => (i.commitPinned ? null : '安装命令未锁定具体 commit'),
    explanation: '未锁定 commit 时,仓库后续推送(或被投毒)会在下次安装时静默生效。',
  },
  {
    id: 'no-license',
    level: 'yellow',
    check: (i) => {
      const license = i.manifest?.license
      return license ? null : 'package.json 缺少 license 字段'
    },
    explanation: '无协议意味着法律授权不明确,也侧面反映仓库规范化程度低。',
  },
  {
    id: 'opaque-dependencies',
    level: 'yellow',
    check: (i) => {
      const deps = {
        ...((i.manifest?.dependencies ?? {}) as Record<string, string>),
        ...((i.manifest?.devDependencies ?? {}) as Record<string, string>),
      }
      const suspicious = Object.keys(deps).filter((d) => {
        if (d.startsWith('@deepseek-ai/') || d.startsWith('@types/')) return false
        // 非 npm 注册表直链(git/url/tarball)无法被常规审计覆盖
        const v = deps[d]
        return typeof v === 'string' && /^(git|http|https|file):/.test(v)
      })
      return suspicious.length ? `非注册表依赖: ${suspicious.join(', ')}` : null
    },
    explanation: 'git/url/file 形态的依赖绕过 npm 审计,内容不受注册表治理。',
  },
  {
    id: 'not-whitelisted',
    level: 'yellow',
    check: (i) => (i.whitelisted ? null : '不在 awesome-dsh-plugin 白名单内'),
    explanation: '未进入社区白名单的仓库可信度基线较低,建议安装前浏览源码。',
  },
]

export function audit(input: AuditInput): import('../types').AuditReport {
  const findings = []
  for (const rule of RULES) {
    const evidence = rule.check(input)
    if (evidence) {
      findings.push({ rule: rule.id, level: rule.level, evidence, explanation: rule.explanation })
    }
  }
  const level = findings.some((f) => f.level === 'red')
    ? ('red' as const)
    : findings.some((f) => f.level === 'yellow')
      ? ('yellow' as const)
      : ('green' as const)

  const scope = input.manifest
    ? ['package.json:scripts', 'package.json:dependencies', 'package.json:license']
    : ['无 package.json(skill 型插件),P3 版本将扫描 SKILL.md 与源码树']

  return {
    target: input.target,
    level,
    findings,
    scope,
    commitPinned: input.commitPinned,
    auditedAt: new Date().toISOString(),
  }
}
