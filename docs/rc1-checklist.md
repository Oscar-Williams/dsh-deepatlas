# RC1 检查单(v0.1.0-rc.1,2026-08-23)

| 项 | 状态 | 证据 |
|---|---|---|
| 全部测试通过 | ✅ 71/71 | CI quality job |
| 双类型检查 + 构建 | ✅ | CI quality job |
| 分发完整性(lib 零漂移) | ✅ | CI distribution-integrity |
| 分发 E2E(archive→pack→安装→HTTP 200) | ✅ | CI distribution-e2e(Run23 起) |
| Linux 真实 E2E(主人格 GitHub 安装) | ✅ | Note 0011 |
| Windows 真实 E2E(双平台 ACTIVE) | ✅ | Note 0010 |
| 故障注入回滚(3 场景) | ✅ | tests/fault-injection |
| 密钥扫描:工作区 | ✅ PASS | scripts/secret-scan.sh |
| 密钥扫描:git 全历史 | ✅ PASS | 同上(含已知指纹核查) |
| P3.8 基准冻结 | ✅ baseline | benchmark/baseline.json |
| P4 Entry Gate | ⚠️ **FAIL(如实)** | Top3=30% < 90%,mustNot@3=1;调参为下一阶段(⑦) |
| 用户全局配置零副作用 | ✅ 原则固化 | security.md 产品红线;深度演示用配置已记录可逆 |
| upstream DSH 兼容性跟踪 | ⚠️ 持续 | cli-capture 体系;0.1.1-rc.* 快速演进中 |

**结论**:RC1 以"基准未达标"的诚实状态冻结代码功能(评审:RC 只修 bug 不加功能);
发布(README.en/收录申请)推迟至 ⑦ 调参使 P4 Gate 达标之后。
