# 0016 · v0.1.1 可靠性补丁 + 第九轮评审(2026-08-23)

## 评审第九轮评估:九轮中最扎实的一份——直接读仓库源码,
三处 P0 全部经本地核实为真:
a) engines.node ">=18"(P0 骨架期写的)→ 已修 "^22.19.0 || >=24.0.0";
b) advise dump-runner 硬编码 'web' → makeDumpRunner(config.installProfile)
   闭包化(消除"检测 web/安装 headless"不一致);
c) dump 全文 alias 兜底 → 移除(保守化;PluginRecord.capabilities
   精确 join 排 Retrieval v3-B)。

## 方向判断采纳
- 主矛盾已从"找得到"转为"任务语义泛化"(holdout 断层的正确解读);
- Retrieval v3 = TaskIntentNormalizer(混合:静态优先,低置信才调宿主
  LLM 做意图归一,模型只理解不决策)+ 多路召回 + PluginRecord 能力
  证据;不引入向量库(零额外服务依赖,定位正确);
- 评测 v3 = Paraphrase Robustness Suite(30 意图×4 改写=120 查询,
  测"换说法仍稳定");holdout-15 永久封存为历史测量集;
- Gate 三分:RetrievalDevGate(PASS)/GeneralizationGate(FAIL)/
  AdvisorSafetyGate(precision 优先,未建);
- CI v2:node24+windows+nightly github:#SHA(兑现 CHANGELOG 计划项);
- awesome PR 顺序后移至 v0.1.1 之后(采纳;恰解昨日推送凭证卡点)。

## README 润色(用户要求)
- 判断:"插件找人"语义正确(推荐=插件来到用户面前),"插件找插件"
  易误读为插件间互找;真正要去的是对仗口号腔;
- 执行:开头改为一句自然的人话(痛点+一句话机制),安装节对齐
  真实步骤(前提/命令/重启/首次扫描/示例),双语同步;
- 安装命令统一 pinned tag(#v0.1.1)。

## 发布
v0.1.1 标签已推送(2b0ef21);GitHub Release 补发;
下一轮主线:TaskIntentNormalizer(v3-A)+ PluginRecord 能力证据(v3-B)
→ Paraphrase Suite → 三 Gate 体系。
