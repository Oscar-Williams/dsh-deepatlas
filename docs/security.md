# DeepAtlas 安全与权限模型

DeepAtlas 面向会进入 DSH 核心进程的第三方代码，安全检查贯穿发现、审计、授权、安装和恢复的完整流程。

## 产品边界

1. **保持用户全局环境完整**：代理、镜像与隔离配置均通过进程级环境变量或临时配置注入，`~/.gitconfig`、`~/.npmrc` 与全局 pnpm 配置维持原状；
2. **源码扫描输出可复核的 risk signals**：例如 `Risk: Elevated — executes child processes`，并附带规则与证据位置；
3. **审计缓存内容寻址**：授权键绑定 repo、完整 commit 与 auditor 版本；
   commit 或规则版本变化会生成新的缓存身份。

## 生态安全事实(已核实)

- **discussion #587(2026-08-14)**:DSH 第三方插件运行于核心进程内,可在
  启动阶段、任何运行时守卫生效前改写配置树(沙箱/审批策略/凭据);
  `dsh plugin add` 不做签名与来源校验——生态层面存在信任真空,
  DeepAtlas 的"审计前置 + 白名单 + commit 锁定"正是对该真空的填补;
- **pnpm ≥10 拦截 git 源插件的 prepare/构建脚本**(allowBuilds 放行机制,
  官方 plugin.ts 明示):安装期任意代码执行的最后一道官方防线;
- **discussion #2889(2026-08-18)**:同一插件经 bundle 与手工 patch 双路
  挂载 → `duplicate loader entry id` 启动崩溃 → 安装器必须装前查重组合树
  (P3 设计输入)。

## 威胁模型

| 威胁 | 场景 | 缓解 |
|---|---|---|
| 供应链投毒 | 仓库安装后新增恶意 commit | 安装强制锁定 commit;更新需重新走审计 |
| 安装期执行 | package.json 生命周期脚本 | auditor 标红,拒绝自动安装 |
| 提示注入 | 恶意仓库自述诱导模型执行指令 | 自述仅作展示文案,工具层无"执行 README"能力;输出固定结构 |
| 静默安装 | 模型绕过用户授权 | userConsent 必须显式为 true；闸门从同一 commit 的 audit-v3 缓存读取审计事实，并按当前运行时重算兼容性 |
| 数据外泄 | 索引/日志上传 | 无遥测;所有数据仅存 dataDir;仓库字段不包含用户信息 |
| 依赖混淆 | git/http 直链依赖绕过审计 | opaque-dependencies 规则标黄 |

## 分级与动作

| 等级 | 条件 | 动作 |
|---|---|---|
| 🔴 红 | 任一红色规则命中(当前:lifecycle-scripts) | 拒绝自动安装,展示证据,引导人工审查 |
| 🟡 黄 | 黄色规则命中(unpinned/no-license/opaque-deps/not-whitelisted) | 可继续,但需用户在确认环节二次勾选知悉 |
| 🟢 绿 | 无命中 | 正常进入授权安装流程 |

## 审计规则清单

1. `lifecycle-scripts`(红):preinstall/install/postinstall/prepublish/prepare 非空
2. `unpinned-commit`(黄):安装命令未锁定 commit
3. `no-license`(黄):package.json 缺 license
4. `opaque-dependencies`(黄):git/http/https/file 形态依赖
5. `not-whitelisted`(黄):不在 awesome-dsh-plugin 白名单

当前实现还扫描源码中的 child process、文件系统写入、环境变量与网络请求模式，
并记录 Node engines、native dependency 和构建脚本兼容性。

## 权限边界(实现层面)

- `dryRun=true` 只生成锁定命令并进入 `PLANNED`。
- 真实执行通过当前 DSH JavaScript launcher；Windows PATH fallback 使用受控的
  `cmd.exe /d /s /c dsh.cmd`，参数在进入子进程前完成格式校验。
- 安装前快照 profile，安装后通过 `dump-config` 验证组合树；失败进入恢复状态。
- 工具参数中 `userConsent` 由模型转达，安装前仍应对应用户当前可见的审计报告。
- DSH `AbortSignal` 贯穿扫描、审计与安装子进程，取消后停止后续落盘和执行。

## 用户须知

- 黄色表示规则发现了需要关注的证据；绿色表示当前规则未命中红黄项。
- 社区清单收录会影响可信度信号，每个插件仍按 commit 独立审计。
- 安装完成后重启对应 profile，并在首个会话中确认工具注册和主要功能。
