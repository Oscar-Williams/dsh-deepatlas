const LIFECYCLE_SCRIPTS = ['preinstall', 'install', 'postinstall', 'prepublish', 'prepare'];
const RULES = [
    {
        id: 'lifecycle-scripts',
        level: 'red',
        check: (i) => {
            const scripts = (i.manifest?.scripts ?? {});
            const hit = LIFECYCLE_SCRIPTS.filter((k) => typeof scripts[k] === 'string' && scripts[k].trim() !== '');
            return hit.length ? `package.json#scripts 命中: ${hit.join(', ')}` : null;
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
            const license = i.manifest?.license;
            return license ? null : 'package.json 缺少 license 字段';
        },
        explanation: '无协议意味着法律授权不明确,也侧面反映仓库规范化程度低。',
    },
    {
        id: 'opaque-dependencies',
        level: 'yellow',
        check: (i) => {
            const deps = {
                ...(i.manifest?.dependencies ?? {}),
                ...(i.manifest?.devDependencies ?? {}),
            };
            const suspicious = Object.keys(deps).filter((d) => {
                if (d.startsWith('@deepseek-ai/') || d.startsWith('@types/'))
                    return false;
                // 非 npm 注册表直链(git/url/tarball/file)无法被常规审计覆盖
                const v = deps[d];
                return typeof v === 'string' && /^(git\+|git:|http:|https:|file:)/.test(v);
            });
            return suspicious.length ? `非注册表依赖: ${suspicious.join(', ')}` : null;
        },
        explanation: 'git/url/file 形态的依赖绕过 npm 审计,内容不受注册表治理。',
    },
    {
        id: 'not-whitelisted',
        level: 'yellow',
        check: (i) => (i.whitelisted ? null : '不在 awesome-dsh-plugin 白名单内'),
        explanation: '未进入社区白名单的仓库可信度基线较低,建议安装前浏览源码。',
    },
];
export function audit(input) {
    const findings = [];
    for (const rule of RULES) {
        const evidence = rule.check(input);
        if (evidence) {
            findings.push({ rule: rule.id, level: rule.level, evidence, explanation: rule.explanation });
        }
    }
    const level = findings.some((f) => f.level === 'red')
        ? 'red'
        : findings.some((f) => f.level === 'yellow')
            ? 'yellow'
            : 'green';
    const scope = input.manifest
        ? ['package.json:scripts', 'package.json:dependencies', 'package.json:license']
        : ['无 package.json(skill 型插件),P3 版本将扫描 SKILL.md 与源码树'];
    return {
        target: input.target,
        level,
        findings,
        scope,
        commitPinned: input.commitPinned,
        auditedAt: new Date().toISOString(),
    };
}
//# sourceMappingURL=auditor.js.map