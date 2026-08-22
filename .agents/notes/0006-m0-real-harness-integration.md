# 0006 · M0 Real Harness Integration 达成(2026-08-22)

## 外部分析评估(第二轮)
用户提供的第二份外部分析(重点"M0 先打通真实 E2E")评估结论:
**6/6 引用核实属实**(engines/本地安装/home-paths/#638/#587/#2889),
核心判断"28/28 只证明自洽,未证明是真实插件"完全成立,采纳其 M0 里程碑。
两处小修正:①其"Real DSH CLI capture 待办"实际已完成(0002);
②Node 24 建议采纳但保留 conda 环境做对照(不删不改,只换主链路)。

## M0 执行结果
- [x] Node 24 独立安装(~/node24,镜像直下 tarball,弃 conda Node 之于主链路)
- [x] 隔离 DSH_HOME=~/.dsh-deepatlas-e2e(全部破坏性测试发生于此)
- [x] dsh plugin --profile web add <本地路径> → link: 安装(632ms,免 allowBuilds)
- [x] --dump-config 组合树含 deepatlas 行
- [x] web 启动冒烟:冷启动 ~30s 后 HTTP 200(apply() 挂载成功;官方:
  插件启动失败会非零退出)
- [ ] 能力真实执行:需 DeepSeek API Key 建立会话(用户提供后补录)
- [ ] CI 双平台矩阵 + ubuntu 集成测试(下一阶段)

## 关键经验(复现要点)
1. web 冷启动 30s:CI/脚本探活窗口 ≥60s;
2. profile 由 dsh 全自动生成维护,不要手写(publish.md 明示);
3. 本地 checkout 安装是 link: 挂载,改源码即时生效;
4. pnpm 全局 registry 需指向镜像,profile 内安装才能走通;
5. 输出重定向时 dsh 启动完全静默,以端口/HTTP 探活为准。

## 设计输入(自 #587/#2889)
- 审计前置是生态信任真空(#587)的唯一填补,安全模型升格为卖点而非负担;
- P3 安装器加"装前查重组合树"步骤,防 duplicate loader entry(#2889);
- M0 后续 P2 引入 PluginRecord(见 README Roadmap 更新)。
