# DeepAtlas 兼容契约(Compatibility Contract)

评审第八轮 P0:依赖范围不得用 `*`,host-facing 包与宿主保持受控范围。

| 项 | 契约 |
|---|---|
| tested DSH | 0.1.1-rc.1 / 0.1.1-rc.2(双平台 E2E 实证) |
| Node | ^22.19.0 \|\| >=24.0.0(官方 engines) |
| @deepseek-ai/cordis | >=4.0.1 <5.0.0(peer + dependency 双声明;cordis 为独立 4.x 版本线) |
| @deepseek-ai/dsh-tools | >=0.1.1-rc.0 <0.2.0(同上) |
| @deepseek-ai/schemastery | >=3.0.0 <4.0.0 |

说明:
- peer 与 dependency 双声明是分发必需(tarball/github 安装需解析依赖,
  而 link: 开发挂载靠宿主树)——与官方 workspace"peer 镜像"规矩同源;
- DSH 处于 developer preview,0.2 破坏性变更时本契约触发上限拦截,
  Distribution E2E 会先于用户失败(好事);
- 升级流程:改范围 → 本地 verify-distribution.sh → CI 三闸门 → 实测
  新版 DSH → 更新本表。
