# DeepAtlas 安全与权限模型

> 本插件的核心矛盾:它要自动安装"第三方任意代码",因此安全不是附加项,而是产品本体。

## 产品红线(P3.5 固化)

1. **绝不修改用户全局环境**:`~/.gitconfig`、`~/.npmrc`、全局 pnpm config
   一律不碰;所有代理/镜像/隔离需求以进程级环境变量或临时配置注入,
   安装失败后用户机器零副作用(评审意见采纳,Note 0011);
2. **源码扫描结论只称 risk signals,不称安全证明**——"Risk: Elevated
   — executes child processes" 而非 "Unsafe plugin";
3. **审计缓存内容寻址**(repo+commit+manifest/lockfile hash+auditor 版本),
   commit 变更自动失效,规则升级自动失效。

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
| 静默安装 | 模型绕过用户擅自安装 | userConsent 必须显式为 true;闸门独立复核审计等级 |
| 数据外泄 | 索引/日志上传 | 无遥测;所有数据仅存 dataDir;仓库字段不包含用户信息 |
| 依赖混淆 | git/http 直链依赖绕过审计 | opaque-dependencies 规则标黄 |

## 分级与动作

| 等级 | 条件 | 动作 |
|---|---|---|
| 🔴 红 | 任一红色规则命中(当前:lifecycle-scripts) | 拒绝自动安装,展示证据,引导人工审查 |
| 🟡 黄 | 黄色规则命中(unpinned/no-license/opaque-deps/not-whitelisted) | 可继续,但需用户在确认环节二次勾选知悉 |
| 🟢 绿 | 无命中 | 正常进入授权安装流程 |

## 审计规则清单(v0)

1. `lifecycle-scripts`(红):preinstall/install/postinstall/prepublish/prepare 非空
2. `unpinned-commit`(黄):安装命令未锁定 commit
3. `no-license`(黄):package.json 缺 license
4. `opaque-dependencies`(黄):git/http/https/file 形态依赖
5. `not-whitelisted`(黄):不在 awesome-dsh-plugin 白名单

P3 扩展:源码树静态扫描(child_process 引用、fs 写路径、process.env 凭据读取、
外联域名清单)、npm audit 联动、安装后行为基线对比。

## 权限边界(实现层面)

- `executeInstall` 在 dryRun=true 时**不可能**触发真实安装(无 exec 分支);
- 真实执行(P3)仅通过 `execFile('dsh', [...])` 调用官方 CLI,不直接改写
  profile / cordis.patch.yml;
- 工具参数中 `userConsent` 由模型传入,但闸门要求其与用户可见的推荐卡片
  对应;P3 计划接入 DSH 的 tools/pre-execute 事件做二次拦截。

## 用户须知

- 黄色不等于安全,只是"未见已知高危模式";
- 白名单是可信加分项而非免检通行证;
- 安装任何插件后建议重启并观察首个会话行为。
