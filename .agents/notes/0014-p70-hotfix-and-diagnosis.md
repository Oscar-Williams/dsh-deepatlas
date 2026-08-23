# 0014 · ⑦.0 四项修正 + ⑦.1 诊断(2026-08-23)

## 评审第八轮评估
诊断框架(先分类失败再调权重)完全正确;P0 两项(TOCTOU、`*` 依赖)
确属插队级。⑦.0 全部 + ⑦.1 全部本轮落地;⑦.2/⑦.3 按诊断结论
排下一轮。RC1 保留为 Engineering RC(不公开宣传),发布等 gate PASS。

## ⑦.0 落地
a) TOCTOU 不变量:audit 返回 auditedRef,未锁 commit 明确警示;
   install 新增必填 auditCommit,与 commit 不一致即拒绝(测试覆盖);
b) 依赖范围:三包全部收紧(<0.2.0 / <4.0.0),docs/compatibility.md
   正式契约化(评审 §3);
c) displayName(原始大小写)+ 全小写 id 内部 join(身份模型 v1);
d) kind 实体分类(kind.ts):framework/collection/documentation/
   application/plugin + isInstallable;find 与基准共用 Eligibility。
   **结构性生效:mustNot@3 由 1 → 0,无任何 benchmark 点名特判。**

## ⑦.1 诊断结论(benchmark v2,--explain/Recall@20/分类指标)
- **filter(检索/预筛)失败 16/21(77%)——当前最大短板**;
- rank 失败仅 5;数据层 recall 0(索引覆盖足够);
- Recall@20 = 46.7%(评审判断验证:远未到调排序的阶段);
- 分类横切:消息平台 0/3、数据库 0/3、自动化 0/3、Git 3/3、UI 2/2。
- 结论:**lexical 单字段预筛区分度不足**,与评审 §9/§10 预言一致。

## 下一轮主线(⑦.2 检索 v2,评审既定路线)
capability taxonomy(20-40 类+中英别名)→ 多字段检索
(capability/name/description/awesome 文本,字段加权)→ Top30 候选池;
⑦.3 rerank 才动用 quality/community;随后建 holdout-15 防过拟合。
测试 71→76。
