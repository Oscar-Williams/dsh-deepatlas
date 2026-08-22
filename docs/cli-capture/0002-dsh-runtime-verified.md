# CLI 形态核实记录 0002(运行时实测)

> 日期:2026-08-22 · 环境:WSL2 Ubuntu 26.04 + conda node v22.23.2 +
> pnpm 11.22.0(npmmirror 源)· 安装位置:dsh-runtime/(本机)
> 包版本:**@deepseek-ai/dsh 0.1.1-rc.1**

## 实测输出(原文摘录)

### dsh --version
```
0.1.1-rc.1
```

### dsh --help(要点)
```
Usage: dsh [options] [command] [args...]

dsh: boot a DeepSeek Harness profile — an ordered stack of plugin-bundle patch
layers under your own overrides.

Options:
  -V, --version               output the version number
  --profile <name>            the profile under $DSH_HOME/profiles to boot
  --patch <path>              extra patch-list overlay applied after the profile
                              layer (repeatable)
  --dump-config               print the composed profile tree and exit
  --dump-default-config       print the profile tree without its user layer or
                              --patch overlays and exit

Commands:
  web [options] [args...]     boot the web profile (alias of --profile web)
  plugin [options] [args...]  manage a profile's plugins by forwarding the
                              remaining arguments to pnpm in the profile
                              directory

Examples:
  dsh --profile web                          boot the web profile (same as: dsh web)
  dsh --profile headless "run the tests"     answer one task, print the result, and exit
  dsh --profile tui --patch ./extra.yml      boot a custom profile with one extra overlay
  dsh plugin --profile tui add <package>     install a plugin into the tui profile
```

### dsh plugin --help
```
error: required option '--profile <name>' not specified
```
(插件子命令必须绑定 profile,与源码一致;其余参数原样转发给 pnpm)

## 关键结论

1. **安装语法官方示例确认**:`dsh plugin --profile <name> add <package>`
   与本项目 README/installer 使用形式一致;
2. **无头模式是 P3 端到端验证的钥匙**:`dsh --profile headless "任务"`
   一次性执行并退出——未来"安装 DeepAtlas→headless 调用 deepatlas_find→
   断言输出"可以完全脚本化,无需浏览器;
3. `--dump-config` 可打印组合后的 profile 树,是调试 cordis.patch.yml
   挂载问题的官方手段;
4. pnpm 安装时拦截了 5 个包的构建脚本(dsh-subprocess-local/@google/genai/
   koffi/node-pty/protobufjs),需 `pnpm approve-builds` 放行——与
   cli-capture/0001 第 3 条(allowBuilds)互证,native addon(koffi FFI、
   node-pty)存在意味着 win32/linux 二进制不可混用,再次印证
   "插件与宿主同环境"原则。

## 安装路径备注(本机复现)
- 默认 npm 源不可用;conda node + npm 大依赖树会 V8 堆崩溃;
- 可行路径:pnpm(11.22.0)+ npmmirror + fetch-retries=6 +
  NODE_OPTIONS=--max-old-space-size=4096。
