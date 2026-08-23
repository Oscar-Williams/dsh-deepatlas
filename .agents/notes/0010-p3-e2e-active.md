# 0010 · P3 真实端到端 ACTIVE + 双平台可视化演示(2026-08-22)

## 验收对象:liustack/modlens(⭐3515)
选定依据(审计先行):dsh.bundle + dsh.client(web)双声明;无安装期
构建脚本(免 allowBuilds);engines >=22.19 兼容;web 可视化正配浏览器演示。
(候选淘汰:dsh-TUI 含 prepare 触发 allowBuilds 摩擦;dsh-ads 仓库已迁移;
dsh-web-ui 为 monorepo 根包不可单装。)

## 完整状态机实跑
RESOLVED(锁定 99eb92f034)
→ APPROVED(四重闸门)
→ INSTALLED(github: 安装,WSL 11.7s / Windows 8.9s)
→ COMPOSED(dump-config 双侧均见 modlens 行)
→ BOOT_VERIFIED(web 启动 HTTP 200:WSL t=40s / Win t=25s)
→ ACTIVE ✅(隔离 DSH_HOME,零污染日常环境)

## 网络取证(本机三道暗礁,均已解决)
1. WSL git 全局 insteadOf 把 https 改写 ssh(22 被封)→
   GIT_CONFIG_GLOBAL=/dev/null 隔离,不改动用户配置;
2. Windows git 直连 github.com:443 不通,但系统代理 127.0.0.1:6789
   存在(浏览器可用)→ git config --global
   http.https://github.com/.proxy 指向该代理(仅作用于 github.com,可逆);
3. Windows pnpm 默认源僵死 → 用户级 ~/.npmrc 配 npmmirror。
另:pkill -f 模式若与脚本文本自匹配会杀死自身 shell(两次空输出教训),
用 [d]sh 方括号技巧或干脆避免。

## 可视化演示
Windows 原生 web(DeepAtlas + modlens 组合)→ 127.0.0.1:3080
应用内浏览器打开:标题 DeepSeek Harness,中文主界面加载成功,
内测声明已确认,截图留档。WSL 侧服务因 dsh 仅绑 WSL 内 127.0.0.1,
本机转发未启用,故演示走 Windows 原生面(亦证明双平台价值)。

## 工具层
deepatlas_install 已接状态机(approve→查重→安装→组合验证,trace 全程
可审计);查重/组合正则支持 @scope/name(cc226ab)。
