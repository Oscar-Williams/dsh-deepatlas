# CLI 形态核实记录 0001(源码级)

> 日期:2026-08-22 · 来源:官方仓库浅克隆(本地 reference/deepseek-harness,
> commit 由 clone --depth 1 获取),非在线文档转述。
> 网络限制:本机 npm 源拉取 @deepseek-ai/dsh 超时,运行时 `dsh plugin --help`
> 实测待镜像安装完成后补充(见 0002,占位)。

## 已核实(源码引用)

### 1. bundle 声明(apps/…/architecture/2026-08-05-profile-plugin-bundles.md)
```json
"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
```
- 两种清单角色:`dsh.bundle`(插件包)与 `dsh.profile`(组合层);
- exports 需暴露 `"./cordis.patch.yml": "./cordis.patch.yml"`,files 需包含该文件;
- 无 bundle 声明的包安装后只是普通依赖,不激活任何层;
- 仅 `dsh.profile.bundles` 直接条目贡献层,传递 bundle 不自动生效。

### 2. patch 行格式(packages/bundle/base/cordis.patch.yml)
```yaml
- insert:
    - id: <行ID>
      name: '<npm 包名>'
      config: { ... }   # 可选
```
- patch 整行替换目标行 config(非合并);后写胜出。

### 3. dsh plugin 命令(apps/cli/src/plugin.ts)
- `dsh plugin --profile <name> <args...>`:pnpm 转发器,安装后
  reconcilePlugins 将带 dsh.bundle 声明的包并入 bundles 层序;
- git/github 安装源(如 `github:owner/repo#ref`)的 prepare 脚本会被
  pnpm ≥10 拦截,需在 profile 的 pnpm-workspace.yaml `allowBuilds` 显式放行
  ——**供应链防护官方在位,与本项目审计器的 lifecycle-scripts 红线互证**;
- Windows 下经 shell 调 pnpm .cmd shim(CVE-2024-27980 加固);
- pnpm 不在 PATH 时报错码 127 并提示安装 pnpm。

### 4. profile 布局
- `$DSH_HOME/profiles/<name>/package.json`(pnpm 管理依赖 + `dsh.profile`
  有序 bundles 清单)+ 用户 `cordis.patch.yml`;
- 默认模板组合:`@deepseek-ai/dsh-base` + `dsh-web-app`(web)/`dsh-headless`(无头)。

## 对本项目的修正(已执行)
- package.json:`dsh.bundle.entry`(猜测)→ `dsh.bundle.patch`(核实);
- exports/files 补 cordis.patch.yml;新增根 cordis.patch.yml(自挂载行);
- schemastery 由 peerDependencies → dependencies(官方:运行时校验器)。

## 待运行时补充
- [ ] `dsh --version`、`dsh plugin --help` 实际输出截图/文本
- [ ] 一次真实的 `dsh plugin --profile web add github:Oscar-Williams/dsh-deepatlas#<commit>` 端到端安装
