# 对照真实环境的核实清单

> 状态:☐ 待核实 ☑ 已核实。核实记录见 docs/cli-capture/。

## 插件机制

- ☑ `package.json` 的 `dsh.bundle` 字段结构:`{ "bundle": { "patch": "./cordis.patch.yml" } }`
  (源:官方仓库架构笔记 2026-08-05-profile-plugin-bundles + packages/bundle/base 实例)
- ☑ `dsh plugin` 命令形态:`dsh plugin --profile <name> <pnpm args...>`,
  为 pnpm 转发器并 reconcile bundles 层序(源:apps/cli/src/plugin.ts)
- ☑ git 源安装的 prepare 脚本被 pnpm≥10 拦截,需 profile 的
  pnpm-workspace.yaml `allowBuilds` 放行(源:plugin.ts 150-157 行)
- ☑ profile 布局:`$DSH_HOME/profiles/<name>/package.json` + 用户 `cordis.patch.yml`
- ☑ patch 行格式:`- insert: [- id, name, config]`,整行替换语义
- ☑ schemastery 应放 dependencies(运行时校验器),cordis 放 peerDependencies
  (源:官方 docs/cookbook/adding-a-package.md + bundle 实例)
- ☐ `@deepseek-ai/cordis` / `@deepseek-ai/dsh-tools` 真实导出与 defineTool 签名
  (本地已有官方源码 clone:reference/deepseek-harness,P1 末核对 types/dsh-stubs.d.ts)
- ☐ 运行时实测:`dsh --version` / `dsh plugin --help` 输出(镜像安装完成后)
- ☐ 端到端:真实 `dsh plugin add github:` 安装本插件并重启生效

## 生态数据

- ☐ GitHub topic `dsh-plugin` 搜索 API 配额与排序稳定性(未认证 10 req/min)
- ☐ awesome 清单的默认分支名(main/master)与条目格式差异
- ☐ 白名单仓库的权威来源(awesome-dsh-plugin/awesome-dsh-plugin 的清单文件路径)

## 工程

- ☑ node ≥22 可用(WSL conda 环境 dsh-deepatlas,v22.23.2)
- ☑ vitest + tsc NodeNext(.js 后缀)工作流打通
- ☐ pnpm 可用性(dsh plugin 依赖;WSL/Windows 均未装,任务 1.1 运行时实测项)
