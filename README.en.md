# DeepAtlas for DeepSeek Harness

[![CI](https://github.com/Oscar-Williams/dsh-deepatlas/actions/workflows/ci.yml/badge.svg)](../../actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![DSH](https://img.shields.io/badge/topic-dsh%20%7C%20deepseek-blue)](../../graphs)

The DSH plugin ecosystem doubles every few days — keeping up by hand doesn't scale. DeepAtlas watches it for you: a local index of 3000+ plugins, capability-based matching against your task, a safety check before anything installs, and commit-pinned transactional installs with rollback.

DeepAtlas is a task-aware plugin navigator for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH). It maintains a local index of the ecosystem (3000+ plugins with live GitHub metadata), understands what capability your task needs, recommends the right plugin, audits it for risk signals, and installs it transactionally — commit-pinned, with rollback.

## Highlights

- **Capability-aware retrieval** — a 28-entry bilingual capability taxonomy (wechat, long-term-memory, browser, token-monitor, …) powers multi-field search; stars never override task fit.
- **AuditReport v1** — provenance / install scripts / native deps / source risk signals (child-process, dynamic-eval, network, fs-write, credential-read). Findings are *risk signals*, never "safe/unsafe" verdicts. Content-addressed cache (`sha256(repo#commit|audit-v1)`) auto-invalidates on commit or rule change.
- **Transactional install state machine** — RESOLVED → APPROVED (consent + non-red audit + commit pin + compatibility) → INSTALLED → COMPOSED → BOOT_VERIFIED → ACTIVE, with FAILED → ROLLING_BACK → ROLLED_BACK. Only **ACTIVE** means success. Idempotent re-installs are rejected (#2889 duplicate-loader protection).
- **TOCTOU invariant** — the audited commit must equal the installed commit, enforced at the tool level.
- **Distribution gates (CI)** — `distribution-integrity` (committed `lib/` must match `src/`) and `distribution-e2e` (git archive → npm pack → tarball install → dump-config → boot HTTP 200), so what users install is what we test.
- **Quiet advisor (P4.1)** — `deepatlas_advise` detects capability gaps against your installed set and stays silent when your harness already covers the task.

## Install

```bash
dsh plugin --profile <profile> add github:Oscar-Williams/dsh-deepatlas#v0.1.1
```

Restart `dsh web` afterwards. Six tools are registered: `deepatlas_scan / status / find / audit / install / advise`.

## Benchmark (honest numbers)

Dev-30 golden set (frozen): Candidate Recall@20 **96.7%**, Top3 strong-or-acceptable **93.3%**, Top3 strong **83.3%**, mustNot@3 **0**, non-installable@3 **0** — P4 gate **PASS**.
Independent holdout-15 (run once, never tuned against): Top3-SA **26.7%** — colloquial paraphrases expose taxonomy coverage gaps; alias expansion + a fresh holdout is the top item for v0.1.1 (see CHANGELOG).

## Documentation

[中文 README](./README.md) · [Architecture](./docs/architecture.md) · [Security model](./docs/security.md) · [Compatibility contract](./docs/compatibility.md) · [RC checklist](./docs/rc1-checklist.md) · [Contributing](./CONTRIBUTING.md)

MIT © 2026 DeepAtlas contributors
