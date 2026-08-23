# 0012 · 分发闸门与故障注入(P3.5-A/B,2026-08-23)

## 外部评审(第六轮)评估
六轮中可执行性最高的一份,自我收窄(P4 拆四、只做 P4.1;基准降至 30 条;
P4 设进入门槛)。全盘采纳其顺序:①分发完整性 CI ②分发 E2E ③故障注入
回滚 → ④AuditReport v1 ⑤内容寻址缓存 → ⑥P3.8 基准。本轮完成 ①②③。

## 本轮交付
1. distribution-integrity CI:build 后 `git diff --exit-code -- lib/`,
   产物漂移即红——lib/ 事故的"永不回归"闸门;
2. distribution-e2e CI:测试对象 = `git archive HEAD`(Git 能交付的全部),
   全新 DSH_HOME 安装 → dump-config 断言 → web 启动 HTTP 200;
3. 状态机补失败分支:FAILED→ROLLING_BACK→ROLLED_BACK +
   finalVerdict(用户层仅 ACTIVE / ROLLED_BACK 两种结语);
   故障注入三场景测试(A:COMPOSED 失败回滚还原;B:BOOT 失败;
   C:重复安装幂等,查重拒绝且 profile 不变),测试 60→63;
4. CONTRIBUTING.md:项目哲学("Validate what users install")+
   src/lib 同提交纪律 + 发布 tag 流程。

## 关键决策
- lib/ 定位为 Release Artifact(随仓库分发,非源码),src 为唯一事实源;
- 用户真实 profile 不再作测试靶场,后续自动化走 fixture persona
  (临时 DSH_HOME + 占位 Key);
- 真实用户 profile 的 3080 实例重启后才会加载新装 DeepAtlas。

## 待续(按评审顺序)
④ AuditReport v1(npm audit + 源码 risk signals) ⑤ 内容寻址审计缓存
⑥ P3.8 黄金集(30 条,冻结 baseline,含 popularity-overfit 对抗样本)
→ P4 Entry Gate → P4.1 → RC1(含 git history 密钥扫描)。
