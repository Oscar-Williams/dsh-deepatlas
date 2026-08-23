# 贡献指南

DeepAtlas 的开发流程围绕一条原则展开：验证用户实际获得的分发物。源码、提交的构建产物、安装文档和公开标签共同构成一次完整交付。

## 开发环境

推荐在 WSL2 的独立 Conda 环境中安装工具链，确保 Windows、WSL 全局 Node 与项目依赖各自保持清晰：

```bash
conda create -n dsh-deepatlas -c conda-forge nodejs=22.23.2
conda activate dsh-deepatlas
npm install -g pnpm @deepseek-ai/dsh@0.1.1-rc.2

node --version
pnpm --version
dsh --version
```

当前兼容范围与受控依赖版本记录在 [兼容契约](./docs/compatibility.md)。每次开发和验证均从激活该环境开始。

## 目录职责

```text
src/    TypeScript 源码与唯一实现来源
lib/    GitHub 安装直接使用的构建产物
tests/  单元、契约、故障注入与分发回归
docs/   架构、安全、兼容与发布记录
```

## 修改与验证

一个分支聚焦一个可审阅目标，提交粒度与功能边界保持一致。源码变更同步生成 `lib/`：

```bash
npm ci
npm run typecheck
npm run typecheck:tests
npm test
npm run build
git diff --check
git status --short
```

源码改动涉及构建输出时，将对应 `src/` 与 `lib/` 文件放入同一提交。提交完成后再次运行 `npm run build && git diff --exit-code -- lib/`，可确认仓库中的分发产物已经同步。当前回归基线为 22 个测试文件、108 项测试。CI 进一步覆盖 Node 22/24、Windows、分发完整性、全新 DSH_HOME 安装和 Web HTTP 200 启动验证。

## Pull Request

PR 标题概括单一核心改动，正文说明背景、实现、验证结果和关联资料。评审反馈继续提交到同一分支，GitHub 会自动更新现有 PR 的提交历史与差异。

## 发布流程

```text
feature/fix branch
        ↓ Pull Request + CI
      main
        ↓ annotated tag
 GitHub Release
        ↓ public-tag install + boot acceptance
```

公开标签对应唯一合并提交。README、CHANGELOG、`package.json`、`package-lock.json` 与 GitHub Release 使用同一版本号。安装验证采用 README 中的 Codeload HTTPS 地址。

## 安全与凭据

安全规则见 [安全与权限模型](./docs/security.md)。仓库仅记录环境变量名和配置示例；API Token、登录信息与本地日志留在各自的安全存储中。提交前运行工作树敏感信息扫描，并在发布检查表中记录结果。
