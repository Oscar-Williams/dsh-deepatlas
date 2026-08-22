# 0009 · Windows 原生 E2E 达成(2026-08-22)

## 结果
DeepAtlas 现于同一台机器拥有两套真实 DSH 验证环境:
- WSL2/Linux:安装→组合→headless 能力执行(exit 0);
- Windows 原生:staging 安装→dump-config 组合→web 启动 HTTP 200(冷启动 ~5s,比 WSL 快)。

Windows 链:F:\Node.js(v24.19.0)+ pnpm(%APPDATA%\npm)+
dsh-runtime-win(pnpm+npmmirror)+ 独立 DSH_HOME(dsh-home-win)+
deepatlas-stage-win(staging)。

## 踩坑记录(复现要点,按时间序)
1. `npm init -y >NUL` 在 Git Bash 生成名为 NUL 的文件(保留设备名陷阱);
2. Windows npm 安装 @deepseek-ai/dsh 重演 WSL 同款僵死(4 分钟零产物)
   —— 本机网络下此包必须用 pnpm;
3. pnpm.cmd 垫片要求 PATH 含 node.exe 目录(Git Bash 需 POSIX 风格 /f/Node.js);
4. staging 若嵌在 dsh-runtime-win 内部,pnpm 向上发现父 lockfile 将其
   吸收为"已存在 workspace"(Already up to date 假象)——staging 必须
   与任何 pnpm 项目脱离父子关系;
5. 跨系统拷贝:robocopy 与 MSYS 路径转换冲突(/E 被改写)、Git Bash cp
   无法创建 Windows 符号链接、tar -h 对悬空链接无效——纯 JS 依赖
   (dsh-tools 等 @deepseek-ai 树)用 tar 解引用打包跨界,schemastery
   需按 pnpm 布局从 .pnpm/@deepseek-ai+schemavery@x/node_modules/@deepseek-ai/schemastery 取真身;
6. npmmirror 缺 @deepseek-ai/dsh-type-meta(peer 自动装 latest 触发 404)
   —— 依赖尽量从本地已验证树物化,不重复走注册表;
7. staging 挪位后 profile 的 link: 路径失效,需 remove+add 重挂。

## 与外部分析(第四轮)对照
其"双运行时、不共用 node_modules、Windows 独立 DSH_HOME、Node 24 对齐
官方主 CI"全部采纳并实测成立;引用的 node-engine-floor 笔记与
discussion #1194/#1903 均核实存在。
