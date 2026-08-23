# 贡献指南

## 项目哲学

> **Validate what users install, not what developers run.**
> 验证用户实际安装的分发物,而不是开发者工作区里的理想状态。

lib/ 事故(2026-08-22,Note 0011)证明:开发验证路径(link:/staging 自带产物)
与用户分发路径(github: 纯 clone,无构建)不一致时,一切本地绿灯都可能是假象。
commit pinning、Distribution E2E、clean persona、boot verification、rollback
这些机制都是同一件事:**缩小"推荐成功"与"用户真的获得能力"之间的距离。**

## 目录语义

```
src/   Source of truth(唯一事实来源)
lib/   Generated distribution artifact —— GitHub 安装必需,随仓库分发
```

## 修改代码的标准流程

```bash
npm run build          # 重新生成 lib/
npm test               # 63 项测试
npm run typecheck && npm run typecheck:tests
git add src/ lib/      # src 与 lib 必须同一提交(否则分发完整性 CI 会拦截)
git commit && git push
```

**不要只提交 src 不提交 lib**——`distribution-integrity` CI 会以
`git diff --exit-code -- lib/` 拦截产物漂移。

## 发布流程(RC 阶段启用)

```
main(开发)→ tag v0.x.y-rc.n(候选)→ tag v0.x.y(正式)
展示人类可读版本,内部执行不可变 commit(github:owner/repo#<SHA>)
```

## 安全红线

见 [docs/security.md](./docs/security.md):绝不修改用户全局 git/npm 配置;
扫描结论只称 risk signals;密钥绝不入库(含 Note 与 cli-capture 文档)。
