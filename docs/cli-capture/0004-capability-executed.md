# CLI 形态核实记录 0004(M0 收官:能力真实执行)

> 日期:2026-08-22 · 环境:Node 24 + 隔离 DSH_HOME + DEEPSEEK_API_KEY ·
> 方式:`dsh --profile headless "调用 deepatlas_status 工具…"`(单轮节约模式)
> 结果:**exit 0**,模型调用工具并原样打印返回(JSON 见本文件末尾附注)

## 会话前修复的三个契约差异(教程 vs 运行时)

1. `@deepseek-ai/schemastery` 是**默认导出**(官方 6 处 `import Schema/z from`),
   教程的命名导入 `{ Schema }` 直接令 loader 崩溃;
2. `defineTool` 的 `parameters` 是**普通 spec 对象**
   (`{ 名: { type, required, description } }`),不是 schemastery 实例;
3. `output` **必填**且必须含 `render(args, value): ContentBlock[]`;
   其 schema 的 `additionalProperties` 必须显式 true/false。
   (教训固化在 src/tools/common.ts 头注释)

## 执行证据(节选)

```
{ "exists": true, "pluginCount": 3016,
  "builtAt": "2026-08-22T11:32:44.257Z", "stale": false,
  "sources": [ github-topic 403 降级, awesome-list 3241 条 ok ],
  "top10": [...] }
headless_exit=0
```

## 暴露的 P2 首要问题

awesome-list 条目 stars=0/无时间 → 质量分退化(全部 5 分),Top10 无排序意义。
P2 需为 awesome 条目补抓 GitHub 元数据(repos API 批量,配 token)。

## 安全备注
API Key 仅以环境变量注入本机进程,未写入任何文件;会话日志在隔离
DSH_HOME 内。建议用户任务完成后在 platform 后台轮换该 Key。
