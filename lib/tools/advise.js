import { scannerFor } from './scan.js';
import { looseObjectOutput, renderJson } from './common.js';
import { extractCapabilities } from '../core/capabilities.js';
import { retrieve } from '../core/retrieval.js';
/** 宿主已装清单读取器(闭包绑定 profile,v0.1.1 修复硬编码 web 的不一致) */
export function makeDumpRunner(profile) {
    return async () => {
        const { execFile } = await import('node:child_process');
        const { promisify } = await import('node:util');
        const exec = promisify(execFile);
        try {
            const { stdout } = await exec('dsh', ['--profile', profile, '--dump-config'], { timeout: 30_000 });
            return stdout;
        }
        catch {
            return '';
        }
    };
}
export function buildAdviseTool(_ctx, config) {
    return {
        name: 'deepatlas_advise',
        description: '能力缺口顾问:给定用户任务,若当前 Harness 已有相关插件则保持安静(silent),仅当发现未安装的强匹配插件时给出 1-3 条建议(含质量分与安装预览)。P4.1。',
        parameters: {
            task: { type: 'string', required: true, description: '用户当前任务描述原文' },
            capabilities: {
                type: 'string',
                description: '规范能力 ID(逗号分隔,模型理解任务后传入;口语化任务强烈建议携带,与 deepatlas_find 同一清单):messaging-wechat,messaging-im,deep-reading,long-term-memory,knowledge-base,browser-automation,token-monitor,context-compression,ui-theme,desktop-gui,tui-terminal,sidebar-workbench,git-integration,task-board,database,spreadsheet-doc,image-vision,ocr,screenshot,ssh-remote,mobile-remote,automation-schedule,backup,workflow-orchestration,coding-tools,prompt-enhance',
            },
        },
        output: { schema: looseObjectOutput, render: renderJson },
        async execute(args, dumpFn = makeDumpRunner(config.installProfile)) {
            const scanner = scannerFor(config);
            const index = await scanner.loadIndex();
            if (!index)
                return { silent: true, reason: '索引不存在' };
            // P4.1 正式形态:按 capabilities 判缺口(非插件 ID,评审第八轮 §16)
            // v3-A 混合归一:静态抽取 ∪ 模型传入 caps(与 find 同通道)
            const taskCaps = new Set([
                ...extractCapabilities(args.task),
                ...(args.capabilities ?? '').split(',').map((x) => x.trim()).filter(Boolean),
            ]);
            if (taskCaps.size === 0) {
                return { silent: true, reason: '任务未识别出能力需求,不打扰' };
            }
            const dumpText = await dumpFn();
            // v3-B 精确路径:已装 ID → 索引 capsEv join;未入索引的回退到 ID 文本抽取
            const installedCaps = new Set();
            for (const m of dumpText.matchAll(/name:\s*'?([@\w\/.:-]+)'?/g)) {
                const rec = index.plugins.find((p) => p.id === m[1].toLowerCase() || (p.displayName ?? p.name).toLowerCase() === m[1].toLowerCase());
                if (rec?.capsEv?.length)
                    rec.capsEv.forEach((c) => installedCaps.add(c.id));
                else
                    for (const c of extractCapabilities(m[1]))
                        installedCaps.add(c);
            }
            // v0.1.1 保守化:不再对 dump 全文跑 alias(配置文本出现某词≠具备该能力);
            // 精确路径(Installed IDs → PluginRecord.capabilities)在 Retrieval v3-B 实现。
            const missingCaps = [...taskCaps].filter((c) => !installedCaps.has(c));
            if (missingCaps.length === 0) {
                return { silent: true, reason: `所需能力已具备(${[...taskCaps].join(', ')}),保持安静` };
            }
            const pool = retrieve(args.task, index.plugins, 3);
            const recs = pool.filter(({ capOverlap }) => capOverlap.some((c) => missingCaps.includes(c)));
            if (recs.length === 0) {
                return { silent: true, reason: `缺能力(${missingCaps.join(', ')})但索引中无强匹配插件` };
            }
            return {
                silent: false,
                gap: `任务需要 ${missingCaps.join(', ')} 能力,当前宿主未覆盖`,
                recommendations: recs.map(({ plugin: p, taskScore, capOverlap }) => ({
                    id: p.id,
                    name: p.displayName ?? p.name,
                    stars: p.stars,
                    quality: p.quality?.total ?? 0,
                    reason: `补齐 ${capOverlap.filter((c) => missingCaps.includes(c)).join(', ')};任务匹配 ${taskScore}`,
                    installCommandPreview: `dsh plugin --profile ${config.installProfile} add github:${p.id}#<commit>`,
                })),
            };
        },
    };
}
//# sourceMappingURL=advise.js.map