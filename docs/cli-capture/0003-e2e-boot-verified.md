# CLI 形态核实记录 0003(M0 端到端:安装→组合→启动)

> 日期:2026-08-22 · 环境:WSL2 Ubuntu 26.04 · Node v24.0.0(独立目录,弃用
> conda Node 之于本链路)· pnpm 11.22.0(npmmirror)· @deepseek-ai/dsh
> 0.1.1-rc.1 · 隔离 `DSH_HOME=~/.dsh-deepatlas-e2e`

## 执行链(全部成功)

```bash
export DSH_HOME="$HOME/.dsh-deepatlas-e2e"

# 1. 本地 checkout 安装(官方:本地路径免 allowBuilds)
dsh plugin --profile web add /mnt/f/Agent_Related/ZCode_Related/plugin1
# → dependencies: + dsh-deepatlas link:/mnt/f/.../plugin1
# → Done in 632ms using pnpm v11.22.0

# 2. profile 由 dsh 自动生成与维护(publish.md:"never write by hand")
#    $DSH_HOME/profiles/web/{package.json(dsh.profile), cordis.patch.yml,
#    pnpm-lock.yaml, pnpm-workspace.yaml, node_modules}

# 3. 组合验证
dsh --profile web --dump-config | grep -A2 deepatlas
# → # == dsh-deepatlas
#   - id: deepatlas
#     name: dsh-deepatlas

# 4. 启动冒烟(--no-open 防浏览器接管)
dsh --profile web --no-open
# → t≈20s 端口 3080 监听;t≈30s HTTP 200(冷启动约 30s,探活需耐心)
```

## 结论

1. **DeepAtlas 已是真实可运行的 DSH 插件**:安装→清单→patch 层并入→
   组合树含本插件→web 服务 200。按官方 reference,"任何插件启动失败会
   非零退出"——HTTP 200 即证明 apply() 在真实宿主进程挂载成功;
2. pnpm 以 `link:` 挂本地 checkout,源码改动即时生效(免重复安装);
3. web 冷启动 ~30s,CI 冒烟测试的探活窗口必须 ≥60s;
4. 遗留:能力真实执行(deepatlas_status/find)需一次真实会话,
   前置条件为 DeepSeek API Key(用户提供后补录)。

## 安全事实(本轮核实 discussion #587 / #2889)

- **#587(2026-08-14)**:第三方插件运行于核心进程内,可在任何运行时
  守卫生效前改写配置树(沙箱模式/审批策略/凭据);`dsh plugin add`
  无签名/来源校验。→ DeepAtlas 审计前置 + 白名单 + commit 锁定是
  对该真空的正面回应,写入 security.md;
- **#2889(2026-08-18)**:同一插件经 bundle 与手工 patch 双路挂载会
  `duplicate loader entry id` 崩溃 web。→ P3 安装器必须先查组合树是否
  已含目标行;README 开发直挂说明已含"勿与安装态并存"警示的必要性
  由此坐实。
