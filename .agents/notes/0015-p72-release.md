# 0015 · ⑦.2/⑦.3 → holdout → P4.1 → RC2 → v0.1.0 发布(2026-08-23)

## 检索 v2 迭代记录(三轮,全部有据)
1. v2 首跑:Recall 46.7%→83.3%(capability 命中);抓真 bug:拉丁短别名
   无词边界(word 命中 keywords/password,污染整池)→ 词边界匹配;
2. quality 权重 2→3 + 黄金集两轮勘误(镜像仓库补录/更专精插件入列,
   逐条有独立依据,note 字段存证);
3. '数据' 别名引入即误伤(memento 借"数据持久化"抢数据库位)→ 移除,
   补 databases 复数;data-agent 靠 "connect to databases and write SQL"
   本义命中。
终态 dev-30:Recall 96.7 / SA 93.3 / Strong 83.3 / mustNot 0 /
nonInstallable 0 —— gate PASS。

## holdout-15(只跑一次,如实)
Top3-SA 26.7%,与 dev 差距巨大。诊断:**特征过拟合**(taxonomy 别名
按 dev 措辞设计;口语改写如"每次重开会话都要重新交代背景"不含任何
memory 别名即检索失效)。非数值过拟合,不可通过权重修复。
处置:不回头调参(纪律);差距入 CHANGELOG 已知限制首位;
v0.1.1 需别名扩容+全新第二套 holdout。

## P4.1 正式形态
deepatlas_advise 改为 capabilities 缺口判断:任务能力集−已装能力并集
(dump-config 全文抽取),缺口为空即 silent;find 同步接检索 v2
(生产=基准单一事实源)。

## 发布
RC2 = v0.1.0(功能冻结于 gate PASS + holdout 如实披露)。
README.en、CHANGELOG、RC checklist、tags。
