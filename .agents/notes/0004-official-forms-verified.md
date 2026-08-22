# 0004 · 官方形态核实落地(2026-08-22)

## 方式
npm 源拉取 @deepseek-ai/dsh 超时(默认源与镜像均慢),改为
git clone --depth 1 官方仓库到
F:\Agent_Related\Deepseek-Harness_Related\reference\deepseek-harness,
直接读源码核实——比文档转述更权威。

## 核实结果(详见 docs/cli-capture/0001)
1. dsh.bundle 真实结构 = { "bundle": { "patch": "./cordis.patch.yml" } },
   骨架期猜的 entry 键是错的,已修正;
2. dsh plugin 是 pnpm 转发器 + bundles 层序 reconcile;
3. pnpm≥10 拦截 git 源 prepare 脚本(allowBuilds 放行)——官方供应链
   防护在位,与本项目 auditor 的 lifecycle-scripts 红线互证;
4. schemastery 应在 dependencies(运行时校验器),已调整。

## 决策
- DSH 安装采用"双轨":dsh-runtime/(快装,供运行时实测)+
  reference/deepseek-harness(源码,供规范参考与类型核对);
- 运行时 CLI 实测项保留在 verification-checklist,镜像安装完成后补录。

## 安装环境建议(用户问题⑤)
官方三系统一等路径 = Node≥22 LTS;微信/小红书社区 Windows 原生教程为主流,
WSL 几乎无人提及;本机工具链(node/pnpm/测试)在 WSL,DSH 运行时建议
Windows 原生安装(浏览器/桌面集成友好),与 WSL 开发环境并存不冲突。
