# DeepAtlas for DeepSeek Harness

[![CI](https://github.com/Oscar-Williams/dsh-deepatlas/actions/workflows/ci.yml/badge.svg)](https://github.com/Oscar-Williams/dsh-deepatlas/actions/workflows/ci.yml)
[![DSH](https://img.shields.io/badge/DSH-0.1.1--rc.1%20%7C%20rc.2-blue)](./docs/compatibility.md)
[![Status](https://img.shields.io/badge/status-public%20preview-blueviolet)](./CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

DeepAtlas is a task-aware plugin navigator for DeepSeek Harness (DSH). It maintains a local index of 3,000+ ecosystem entries, retrieves candidates for the current task, reports risk signals before installation, and constrains installation with explicit consent, commit pinning, and a rollback-aware state machine.

> DeepAtlas and DSH are both previews. DSH may still introduce compatibility-breaking changes, and installing a third-party plugin means running third-party code inside the DSH process. DeepAtlas reports risk signals; it does not certify that a plugin is safe.

[中文](./README.md) · [Architecture](./docs/architecture.md) · [Security](./docs/security.md) · [Compatibility](./docs/compatibility.md) · [Changelog](./CHANGELOG.md)

## What it provides

- **Local ecosystem index** built from the `dsh-plugin` topic, curated lists, and live repository metadata.
- **Capability retrieval** using 28 bilingual capability classes, weighted fields, and quality signals. The host model may normalize a task into an enum-constrained capability array, but it does not make audit or installation decisions.
- **Risk-signal audit** covering provenance, lifecycle scripts, dependency shapes, native dependencies, and source patterns, with content-addressed cache invalidation.
- **Installation invariants** requiring explicit consent, a non-red audit, compatibility, and an exact match between the audited and installed commit.
- **Transactional state tracking** from RESOLVED to ACTIVE, with a rollback path after failure. Only ACTIVE is reported as a successful installation.
- **Quiet capability advisor** that remains silent when the task is already covered or evidence is insufficient.

## Install

Prerequisites: Node.js `^22.19.0 || >=24.0.0` and a working DSH installation.

```bash
npx @deepseek-ai/dsh web
dsh plugin --profile <profile> add github:Oscar-Williams/dsh-deepatlas#v0.2.0
```

Restart the selected DSH profile after installation. DeepAtlas registers six tools:

`deepatlas_scan` · `deepatlas_status` · `deepatlas_find` · `deepatlas_audit` · `deepatlas_install` · `deepatlas_advise`

Ask the agent to scan the plugin index before the first search. `DEEPATLAS_GITHUB_TOKEN` is optional and only increases the GitHub API limit. Indexes, audit caches, and records stay under the configured local `dataDir`.

`dryRun` defaults to `true`. In that mode, installation produces a command and state trace without invoking the DSH CLI. Real installation must be explicitly enabled and still passes the audit, consent, compatibility, and commit-pin gates.

## Evaluation status

The gates answer different questions and must not be collapsed into a single “generalization” score.

| Gate / dataset | Current result | What it establishes |
|---|---:|---|
| RetrievalDev (frozen dev-30) | Recall@20 96.7%; Top3-SA 93.3%; mustNot@3 0 | Deterministic regression on known development intents |
| Independent holdout-15 | Top3-SA 26.7% | Static retrieval still generalizes poorly to colloquial tasks |
| NormalizedIntentRetrieval (120 paraphrases) | 50.8% static → 85.0% with gold capability input | The capability channel works; it does **not** prove host-model intent understanding |
| AdvisorSafety fixture | recommend 5/5; silence 5/5; false positives 0 | A small deterministic regression, not real-session performance |

The next HostIntentGate will measure the missing layer independently: natural language → DSH host model → canonical capability array.

## Development

Use Node.js 22.19 or 24, preferably in WSL2/Linux:

```bash
npm ci
npm test                # currently 16 test files, 78 tests
npm run typecheck
npm run typecheck:tests
npm run build           # regenerates the committed lib/ payload
```

CI also covers Node 22/24, Windows, distribution integrity, tarball installation and boot verification, plus nightly GitHub-by-commit installation. Because `lib/` is part of the GitHub-installed package, every `src/` change must be built and checked for payload drift.

## Known limitations and roadmap

- DSH is still a Developer Preview; current evidence covers DSH `0.1.1-rc.1` and `0.1.1-rc.2`.
- HostIntentGate does not exist yet; the 85.0% result uses pre-supplied canonical capabilities.
- Capability evidence covers only part of the current index, and its 0.6/0.9 confidence is not yet a full source-weighted scoring model.
- Static audit findings are risk signals, not sandboxing, signature verification, or proof of benign behavior.
- Real installation is opt-in because `dryRun=true` is the default.
- Distribution currently uses commit/tag-pinned GitHub sources; there is no npm release.

Planned order: `v0.2.1 release integrity → HostIntentGate → Evidence v2 → upstream DSH compatibility canary`. DeepAtlas will remain on the 0.x line while DSH APIs are still changing.

## License

[MIT](./LICENSE) © 2026 DeepAtlas contributors
