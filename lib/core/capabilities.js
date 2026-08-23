export const CAPABILITIES = [
    { id: 'messaging-wechat', aliases: ['wechat', 'weixin', '微信', '企业微信', 'wecom'] },
    { id: 'messaging-telegram', aliases: ['telegram', 'tg', '电报'] },
    { id: 'messaging-im', aliases: ['im', '即时通讯', '消息推送', '机器人通知', 'notify', 'notification', '通知推送', '飞书', 'feishu', 'lark', '钉钉', 'dingtalk', 'qq'] },
    { id: 'deep-reading', aliases: ['deepread', 'deep read', '深度阅读', '网页阅读', 'read later', '摘要'] },
    { id: 'long-term-memory', aliases: ['memory', 'memorize', '记忆', '长期记忆', '跨会话', 'cross-session', '记住', '偏好'] },
    { id: 'knowledge-base', aliases: ['knowledge', '知识库', '向量', 'vector', 'rag', 'embedding', '检索增强'] },
    { id: 'browser-automation', aliases: ['browser', '浏览器', 'chrome', 'web automation', '网页自动化', '填表', 'playwright', 'puppeteer'] },
    { id: 'web-search', aliases: ['search', '搜索', '联网', 'web search', '检索网页'] },
    { id: 'token-monitor', aliases: ['token', '用量', '余额', '花费', '成本', 'cost', 'usage', '计费', 'billing', '监控'] },
    { id: 'context-compression', aliases: ['压缩', 'compress', 'context', '上下文', '省 token', 'token 优化', 'compaction'] },
    { id: 'ui-theme', aliases: ['theme', 'skin', '皮肤', '美化', '主题', 'appearance'] },
    { id: 'desktop-gui', aliases: ['desktop', '桌面', 'gui', '图形界面', 'standalone app', '客户端'] },
    { id: 'tui-terminal', aliases: ['tui', 'terminal', '终端', '命令行', 'cli ui', '会话分叉', '分叉'] },
    { id: 'sidebar-workbench', aliases: ['sidebar', '侧边栏', '工作台', 'workbench', '面板', 'panel', 'ide'] },
    { id: 'git-integration', aliases: ['git', '提交历史', 'github', 'commit', 'diff', '版本'] },
    { id: 'task-board', aliases: ['看板', 'taskboard', 'task board', 'kanban', '任务板', 'todo'] },
    { id: 'database', aliases: ['database', '数据库', 'sqlite', 'sql', '表结构', 'postgres', 'mysql', 'databases', 'db'] },
    { id: 'spreadsheet-doc', aliases: ['表格', 'spreadsheet', 'excel', 'office', '文档处理', 'word', 'univer'] },
    { id: 'image-vision', aliases: ['image', '图片', '视觉', 'vision', '识图', '图像', 'imageunderstanding', 'multimodal'] },
    { id: 'ocr', aliases: ['ocr', '文字识别', '截图识别'] },
    { id: 'screenshot', aliases: ['screenshot', '截图', '截屏', 'capture'] },
    { id: 'ssh-remote', aliases: ['ssh', '远程服务器', 'remote', '远程执行'] },
    { id: 'mobile-remote', aliases: ['手机', 'mobile', '移动端', '远程访问'] },
    { id: 'automation-schedule', aliases: ['定时', 'schedule', 'cron', '自动化', 'automation', '定时任务', 'trigger'] },
    { id: 'backup', aliases: ['backup', '备份', '同步', 'sync'] },
    { id: 'workflow-orchestration', aliases: ['workflow', '工作流', '编排', 'orchestration', '多 agent', '调度', 'pipeline'] },
    { id: 'coding-tools', aliases: ['coding', '编程', 'lsp', '代码补全', 'refactor'] },
    { id: 'prompt-enhance', aliases: ['prompt', '提示词', '去 ai 味', '润色'] },
];
/** 从任意文本抽取能力:中文 alias 子串匹配;拉丁 alias 词边界匹配(防 word→keywords 误伤) */
export function extractCapabilities(text) {
    const t = text.toLowerCase();
    const out = new Set();
    for (const cap of CAPABILITIES) {
        for (const alias of cap.aliases) {
            const a = alias.toLowerCase();
            if (/[a-z0-9]/.test(a) && !/\p{Script=Han}/u.test(a)) {
                // 纯拉丁别名:词边界(短词如 word/data/search 不许在 keywords 里误命中)
                if (new RegExp(`(^|[^a-z0-9])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'u').test(t)) {
                    out.add(cap.id);
                    break;
                }
            }
            else if (t.includes(a)) {
                out.add(cap.id);
                break;
            }
        }
    }
    return out;
}
/** v3-B 证据化抽取:按字段记录命中别名;confidence 1 证据 0.6 / 2+ 证据 0.9(确定性) */
export function extractCapabilityRecords(parts) {
    const byId = new Map();
    for (const cap of CAPABILITIES) {
        for (const part of parts) {
            const t = part.text.toLowerCase();
            const hit = cap.aliases.find((alias) => {
                const a = alias.toLowerCase();
                if (/[a-z0-9]/.test(a) && !/\p{Script=Han}/u.test(a)) {
                    try {
                        return new RegExp(`(^|[^a-z0-9])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'u').test(t);
                    }
                    catch {
                        return t.includes(a);
                    }
                }
                return t.includes(a);
            });
            if (hit) {
                const list = byId.get(cap.id) ?? [];
                list.push({ source: part.source, text: hit });
                byId.set(cap.id, list);
            }
        }
    }
    return [...byId.entries()].map(([id, ev]) => ({ id, ev, confidence: ev.length >= 2 ? 0.9 : 0.6 }));
}
//# sourceMappingURL=capabilities.js.map