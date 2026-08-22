# 0005 · 外部架构意见评估与采纳(2026-08-22)

## 意见来源
用户提供的外部评审(ChatGPT),主张:DSH 主进程与 Node runtime 必须同环境;
推荐"Windows UI + WSL2(Node+DSH+插件)"架构;DeepAtlas 应做运行时检测与
Install Adapter 分层。

## 核实结果(全部属实)
1. engines "node": "^22.19.0 || >=24.0.0" —— 本地官方 clone 核对一致;
   本机 conda 22.23.2 满足约束,无需升级;
2. discussion #638 存在,社区方案 = WSL 内 npx dsh web + .wslconfig
   localhost 转发,Windows 浏览器访问——与意见一致;
3. 2026-08-01-windows-pwsh-default 笔记存在,另有 08-08 ACL 沙箱、
   bash parity 等笔记,Windows 一等公民地位证据比意见引用的还多;
4. developer preview / breaking changes 提醒属实(官方页早前已核实)。

## 采纳
- 架构原则:DeepAtlas 与宿主 DSH/npm runtime 同环境(profile 机制放大:
  $DSH_HOME 是 per-OS 的,跨环境管理必然错位)→ 本机开发/验证定稿 WSL2;
- 设计增量:P2 推荐卡加兼容性字段;P3 Install Adapter 安装前自检
  (platform/arch/node/pm/dsh 版本),已写入 README Roadmap。

## 保留(我方补充的现实约束)
- 该意见未覆盖本机环境现实:WSL 内安装 @deepseek-ai/dsh 时 conda 版 Node
  (libnode)在依赖解析阶段 V8 堆崩溃(Heap OOM),需 NODE_OPTIONS 加堆重试
  或改用系统 Node——"WSL 装 DSH"路线在本机有额外摩擦,已实测记录;
- 日常交互使用 Windows 原生 DSH 与开发期 WSL2 并不冲突,DeepAtlas 做成
  runtime 检测后两边都能服务——note 0004 的建议与本意见互补而非矛盾;
- 意见的 Adapter 分层图未含 dry-run/审计闸门,采纳分层但闸门保持在
  Adapter 之前执行(安全模型不放松)。
