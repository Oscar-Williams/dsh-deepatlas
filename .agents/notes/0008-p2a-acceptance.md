# 0008 · P2-A 验收通过:元数据回填完成,排名修复(2026-08-22)

## 回填结果
- 更新 2926 条(+1 匿名期),跳过 89 条(仓库 404/改名等);
- 全程 authenticated(core 桶),分批落盘(每 50 条)经受住了
  SIGPIPE 事故后的重启续跑检验。

## Top10 验收(修复前:全员 5 分、按字母序)
1. deepseek-ai/deepseek-harness ⭐183457 分73
2. DSH-better-sidebar          ⭐2621   分73
3. dsh-context                 ⭐789    分72
4. dsh-ads                     ⭐535    分70
5. dsh-browser                 ⭐387    分69
6. Prism-Shadow/penguin-harness ⭐1603  分68
7. esengine/DeepSeek-Reasonix  ⭐35022  分68
8. MemTensor/MemOS             ⭐10910  分68
9. xiufengsun/TokenTracker     ⭐1399  分68
10. Javis603/token-monitor     ⭐1605  分68
与社区调研(小红书高赞榜)高度吻合。归档/fork 标记已入库,
推荐理由可展示真实警示。

## 观察与后续
- star 上限饱和:官方 harness 183k⭐ 只得社区分 100,榜单第 6-10 名
  35022⭐ 与 387⭐ 同分——对数缩放对头部区分度不足,P2 校准项
  (可调基数或改 z-score,权重配置化时一并处理);
- awesome 来源 89 条死链需在下一轮全量 scan 中清理或标记。

## Windows 验证面(进行中)
- Node v24.19.0(F:\Node.js)+ pnpm(%APPDATA%\npm,经 PATH 注入);
- staging 拷贝方案避免跨 OS 污染 node_modules
  (tar 排除法;robocopy 与 MSYS 路径转换冲突、Git Bash cp 不支持
  Windows 符号链接,均已试错记录);
- npm 在 Windows 重演 WSL 同款僵死(4 分钟零产物),直接换 pnpm;
  pnpm 垫片需 PATH 含 node.exe 所在目录。
