# 0017 · Retrieval v3:TaskIntent 混合归一 + 能力证据固化(2026-08-23)

## v3-A TaskIntentNormalizer(混合架构落地)
设计:模型只理解意图,代码掌控检索——`deepatlas_find`/`deepatlas_advise`
新增 `capabilities` 参数(28 个规范 ID,模型在理解口语任务后传入);
静态抽取仍为默认路径,两者并集进检索。零外部服务(宿主 LLM 即归一器)。

## v3-B PluginRecord 能力证据
- extractCapabilityRecords:按字段(name/description/topics)记录命中
  别名与来源,confidence 1 证据 0.6/2+ 证据 0.9(确定性);
- scanner 扫描期固化 capsEv(存量索引已离线迁移,1767/3016 有能力记录);
- 检索优先读 capsEv,旧索引回退查询期抽取;
- advise 已装能力 = ID→索引 capsEv 精确 join(v0.1.1 遗留项闭环)。

## Paraphrase Suite(120 查询)与三 Gate 首跑(全部如实)
| Gate | 结果 | 数据 |
|---|---|---|
| RetrievalDev(dev-30) | **PASS** | Recall 96.7/SA 93.3/Strong 83.3(reranker 未动,回归一致) |
| Generalization(120 改写) | **PASS(hybrid)** | 静态 SA 50.8%→**混合 85.0%**;稳定率 6.7%→**56.7%**;mustNot@3=0 |
| AdvisorSafety(10 案) | FAIL(方向正确) | 静默 5/5 完美;推荐 2/5——wrong 全为"该说没说",**零误报**;advise 已补 caps 通道(同 find),下轮重测 |

**核心结论(对照实验)**:同一批口语查询,模型归一通道使 SA +34pt、
稳定率 +50pt 且零侵入——v3-A 架构价值获干净证明;剩余 gap 来自部分
意图 caps 派生为空(原句无信号)与 rank 层,已定位。

## 工程备注
- benchmark 新增 --paraphrase(双跑对照)/--advisor(注入式 dump)模式;
- bash/python 转义层三次坑(正则反斜杠/dump 换行/跨 OS /tmp),
  复杂注入一律走 Edit 工具。
