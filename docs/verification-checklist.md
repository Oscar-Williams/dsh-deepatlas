# 对照真实环境的核实清单

> 骨架基于公开教程与社区文档编写,以下事项在接入真实 dsh 环境时**必须逐一核实**。
> 状态:☐ 待核实 ☑ 已核实

## 插件机制

- ☐ `package.json` 的 `dsh.bundle` 字段结构(entry 键名/是否需要额外字段),
  对照官方仓库 `docs/cookbook/adding-a-package.md`
- ☐ `@deepseek-ai/cordis` / `@deepseek-ai/dsh-tools` / `@deepseek-ai/schemastery`
  的真实包名与导出(defineTool 签名、Schema API)
- ☐ `ctx.tools.register` 的调用形态(单注册 vs 批量)
- ☐ 安装命令准确形态:`dsh plugin --profile X add github:owner/repo#ref`
  (运行 `dsh plugin --help` 截图存档)
- ☐ 源码直挂开发模式的配置写法(cordis.yml 格式)
- ☐ 插件数据目录惯例(~/.dsh/ vs 其他)

## 生态数据

- ☐ GitHub topic `dsh-plugin` 搜索 API 配额与排序稳定性(未认证 10 req/min)
- ☐ awesome 清单的默认分支名(main/master)与条目格式差异
- ☐ 白名单仓库的权威来源(awesome-dsh-plugin/awesome-dsh-plugin 的清单文件路径)

## 工程

- ☐ node/pnpm 版本要求;Windows 路径兼容(cli.ts 已用 path.join)
- ☐ vitest 版本与 tsx/esbuild 转译(vitest 2.x 原生支持 TS)
