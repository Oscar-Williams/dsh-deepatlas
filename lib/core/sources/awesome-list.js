/** 生态公认的白名单仓库(命中即 whitelisted=true) */
export const WHITELIST_REPOS = [
    'awesome-dsh-plugin/awesome-dsh-plugin',
    'like-study1/oh-my-dsh',
];
/** 骨架阶段收录的清单源,P1 扩展为可配置 */
export const AWESOME_LISTS = [
    { sourceId: 'awesome-dominic', url: 'https://raw.githubusercontent.com/Dominic789654/awesome-deepseek-harness/main/README.md' },
    { sourceId: 'awesome-0xsline', url: 'https://raw.githubusercontent.com/0xsline/awesome-deepseek-harness/main/README.md' },
];
const ENTRY = /^\s*[-*]\s*\[([^\]]+)\]\((https:\/\/github\.com\/([^/\s)]+\/[^/\s)]+))\/?\)\s*[—–-]?\s*(.*)$/;
export class AwesomeListSource {
    id = 'awesome-list';
    label = 'awesome 清单(白名单/目录)';
    async *collect() {
        for (const list of AWESOME_LISTS) {
            let body;
            try {
                const res = await fetch(list.url);
                if (!res.ok)
                    continue;
                body = await res.text();
            }
            catch {
                continue; // 单个清单失败不阻断整体扫描
            }
            for (const line of body.split('\n')) {
                const m = ENTRY.exec(line);
                if (!m)
                    continue;
                const fullName = m[3].toLowerCase();
                yield {
                    id: fullName,
                    name: m[1],
                    repoUrl: m[2],
                    description: m[4].trim(),
                    stars: 0, // awesome 条目缺 star 数,由 scanner 合并 GitHub 数据时补齐
                    lastPushedAt: '',
                    license: 'unknown',
                    topics: [],
                };
            }
        }
    }
}
//# sourceMappingURL=awesome-list.js.map