# 0007 · P2-A 认证与元数据回填(2026-08-22)

## 外部评审(第三轮)评估与采纳
- ✅ "classic PAT 无 scope = 只读公开信息"正确——实测 Token 的
  X-OAuth-Scopes 头为空,最小权限确认;
- ✅ core(5000/h)与 search(30/min)独立配额桶——/rate_limit 实测吻合,
  scan(搜索桶)与 backfill(core 桶)分别治理;
- ✅ Token 是"增强凭据"而非"必需凭据":三级解析(配置名→GITHUB_TOKEN→
  GH_TOKEN→匿名降级),无 Token 插件仍可用;
- ✅ metadataFetchedAt 缓存 + <7d 不重抓 + 限流地板(remaining<50 收手);
- ⚠️ 其"不要把 Token 发给模型"的建议未能完全遵守:Token 已出现在对话中
  (用户直接提供)。缓解:仅存 WSL ~/.deepatlas/secrets.env(600),
  不入仓库(提交前 grep 泄漏检查)、不进日志、工具输出只报 authMode。
  **两把密钥(API Key + PAT)任务完成后均须轮换。**

## 实测数据
- dsh-web-ui 已 5519⭐(首测 5508,一周内仍在涨);
- dsh-plugin topic 总数 10546(8 月中 700+,生态两周十倍级增长)。

## 遗留
- 全量回填 3016 条进行中(后台,~18min);完成后验收 Top10 修复;
- scan 的 github-topic 源在认证 Token 下应恢复(search 桶 30/min,
  全量分页需 ~106 请求/次 → 分多窗口或只抓头部,下一轮决策)。
