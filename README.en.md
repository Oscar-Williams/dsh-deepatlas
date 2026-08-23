# DeepAtlas for DeepSeek Harness

[![CI](https://github.com/Oscar-Williams/dsh-deepatlas/actions/workflows/ci.yml/badge.svg)](https://github.com/Oscar-Williams/dsh-deepatlas/actions/workflows/ci.yml)
[![DSH](https://img.shields.io/badge/DSH-0.1.1--rc.1%20%7C%20rc.2-blue)](./docs/compatibility.md)
[![Status](https://img.shields.io/badge/status-public%20preview-blueviolet)](./CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

DeepAtlas is a task-aware plugin navigator for DeepSeek Harness (DSH). It maintains a local index of 3,000+ ecosystem entries: describe the task at hand and DeepAtlas returns capability-matched candidates, quality evidence, and overlap notes. Once you choose a plugin, it continues with commit-level audit, compatibility checks, and a controlled installation flow.

Third-party plugins share the DSH process privileges. DeepAtlas provides reviewable risk signals and an installation trace, while every installation remains subject to explicit user approval.

[中文](./README.md) · [Architecture](./docs/architecture.md) · [Security](./docs/security.md) · [Compatibility](./docs/compatibility.md) · [Changelog](./CHANGELOG.md)

## Highlights

- **Complete ecosystem discovery** combines the GitHub `dsh-plugin` topic with community lists. Time-range partitioning works around GitHub Search's 1,000-result limit.
- **Task capability retrieval** combines 28 bilingual capability classes, field-level evidence, and quality signals for natural-language tasks and canonical capability input.
- **Quiet capability advisor** stays silent when the selected profile already covers the task and returns 1–3 suggestions for clear capability gaps.
- **Pre-install risk audit** checks lifecycle scripts, dependency shapes, native dependencies, source patterns in the manifest-declared entry and bundle patch, and Node compatibility at a full commit SHA.
- **Controlled installation and recovery** authorizes from the matching local audit record, snapshots the profile before execution, and enters rollback when verification fails.
- **Local-first state** keeps indexes, audit cache, and install records in the DSH home or a user-selected directory. A GitHub token is used only to raise API limits.

## Quick start

### 1. Prepare the environment

The current compatibility envelope is:

- Node.js `^22.19.0 || >=24.0.0`
- DeepSeek Harness `0.1.1-rc.1` / `0.1.1-rc.2`
- `pnpm` available on `PATH` because DSH forwards plugin-management commands to pnpm

```bash
node --version
pnpm --version
dsh --version
```

For a first DSH run, start the shipped Web profile:

```bash
npx -y @deepseek-ai/dsh@0.1.1-rc.2 web
```

### 2. Install into a profile

This example installs the pinned public release into `web`:

```bash
dsh plugin --profile web add https://codeload.github.com/Oscar-Williams/dsh-deepatlas/tar.gz/refs/tags/v0.2.2
```

This HTTPS address fetches the pinned release consistently across Windows, WSL, and common restricted networks. Replace both `web` occurrences with `headless` or another profile name when appropriate.

### 3. Verify the composed tree

```bash
dsh --profile web --dump-config
```

The output should contain a `dsh-deepatlas` / `deepatlas` layer. Restart the selected profile afterward:

```bash
dsh web
```

### 4. Build the first index

Send this request inside DSH:

> Call `deepatlas_status`. If no index exists yet, run one complete scan.

The first complete scan automatically partitions GitHub queries, merges community lists, deduplicates repositories, and writes the local index. A dedicated WSL run on 2026-08-23 read 10,914 GitHub topic results and 5,175 community-list entries, producing 11,700 unique index records.

Anonymous mode completed in 15 minutes 46 seconds, with most of that time spent waiting for GitHub Search API quota. A GitHub token raises the Search budget from 10 to 30 requests per minute, so a stable authenticated connection normally completes the scan within a few minutes. Keep the DSH process running; completion returns the item count, source health, and index location.

For consistently fast scans:

- Keep `api.github.com`, `github.com`, and `codeload.github.com` reachable.
- Set `DEEPATLAS_GITHUB_TOKEN` in the environment that starts DSH, then confirm `githubAuth: authenticated` with `deepatlas_status`. See [GitHub's REST API rate-limit documentation](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).
- Keep the network route stable during the scan and use `incremental=true` for routine refreshes after the first index.
- Scans support cancellation. Completed results replace the index atomically, and the previous index remains available when a source is unavailable.
- Maintainers can run `npm run scan` to view partition pages and live fetch progress.

Example requests:

- “I need cross-session memory in DSH. Compare suitable plugins.”
- “Find a Telegram integration and show candidates with risk signals.”
- “Audit this plugin at the specified commit. Show the report and ask before installation.”

## How it works

```text
GitHub topic / community lists
              │
              ▼
        local ecosystem index ───────→ deepatlas_status
              │
task text + canonical capabilities
              │
              ├─────────────────────→ deepatlas_find
              │                        candidates / evidence / overlap
              │
              └─────────────────────→ deepatlas_advise
                                       silent when covered / suggest on gap
                                                    │
selected full commit SHA ─→ deepatlas_audit ────────┤
                                                    ▼
                                         user reviews and approves
                                                    │
                                                    ▼
                                         deepatlas_install
                              snapshot → install → compose check → recovery
```

The host model interprets the task and supplies canonical capabilities. Deterministic code owns indexing, ranking, audit rules, and installation gates.

## Six tools

| Tool | Purpose | Main output |
|---|---|---|
| `deepatlas_scan` | Complete or incremental ecosystem scan | Item count, source health, index location |
| `deepatlas_status` | Index age, TTL, source state, and Top 10 | Current state, auth mode, metadata coverage |
| `deepatlas_find` | Retrieve by task and capabilities | Match evidence, quality score, overlap notes |
| `deepatlas_advise` | Compare task needs with installed plugins | Silent result or 1–3 suggestions |
| `deepatlas_audit` | Audit a repository at a full 40-character SHA | Risk level, evidence, compatibility, `auditedRef` |
| `deepatlas_install` | Plan or execute from the matching audit record | State trace, command, execution/composition/activation flags |

Recommended order: `status → scan → find → audit → explicit approval → install`.

## Configuration

| Option | Default | Description |
|---|---:|---|
| `dataDir` | empty | Uses the active `DSH_HOME/deepatlas`, then `~/.dsh/deepatlas` when `DSH_HOME` is unset |
| `installProfile` | `web` | Profile used for duplicate detection, installation, and composition checks |
| `indexTtlHours` | `24` | Age at which status recommends a refresh |
| `minStars` | `0` | Minimum star threshold for candidates |
| `githubTokenEnv` | `DEEPATLAS_GITHUB_TOKEN` | Environment variable that contains an optional GitHub token |
| `dryRun` | `true` | Produces the complete plan and command while preserving the profile |

To enable real installation, override the `deepatlas` row in `$DSH_HOME/profiles/<profile>/cordis.patch.yml`. A DSH row patch replaces the full `config`, so retain every field:

```yaml
- id: deepatlas
  config:
    dataDir: ''
    installProfile: web
    indexTtlHours: 24
    minStars: 0
    githubTokenEnv: DEEPATLAS_GITHUB_TOKEN
    dryRun: false
```

Run `dsh --profile web --dump-config` to inspect the effective value. `DEEPATLAS_HOME` can explicitly share one data directory across profiles; `dataDir` has the highest priority.

## Installation safeguards

DeepAtlas enforces these conditions in the tool layer:

1. Audit and installation use a canonical `owner/repo` and a full 40-character commit SHA.
2. Installation reads risk facts and compatibility requirements from the `target + commit + audit-v3` content-addressed cache entry, then recalculates compatibility for the current runtime.
3. Red findings, incompatible runtime, missing audit evidence, or missing user approval block the plan.
4. Real execution checks the current composed tree and creates a profile snapshot.
5. A successful command is followed by another composition check; failures enter a recorded recovery state.
6. `dryRun=true` enters `PLANNED` and returns the exact pinned command for review.

Green and yellow results summarize signals observed by the current rules. Repository provenance, dependencies, and runtime behavior remain part of the overall review.

## Evaluation status

| Gate / dataset | Current result | Coverage |
|---|---:|---|
| RetrievalDev (frozen dev-30) | Recall@20 96.7%; Top3-SA 93.3%; mustNot@3 0 | Deterministic regression on known development intents |
| Independent holdout-15 | Top3-SA 26.7% | Static retrieval baseline on colloquial tasks |
| NormalizedIntentRetrieval (120 paraphrases) | 50.8% static → 85.0% with canonical capabilities | Retrieval gain from the capability channel |
| AdvisorSafety fixture | recommend 5/5; silence 5/5; false positives 0 | Deterministic quiet-advisor regression |

HostIntentGate will independently measure the live path from natural language through the DSH host model to a capability array. Evidence v2 will calibrate evidence provenance, confidence, and coverage. Both use frozen datasets, replayable records, and independent gates before entering a release line.

## Compatibility and current scope

- DeepAtlas is a public preview and DSH is a Developer Preview.
- The current release line covers DSH `0.1.1-rc.1` / `0.1.1-rc.2` and Node 22.19 / 24.
- Distribution uses a GitHub tag or full commit SHA and includes prebuilt `lib/` artifacts.
- Audit covers static risk signals. Runtime isolation, signature verification, and behavior detection belong to broader security controls.
- `dryRun=true` provides the safe default; users enable real installation per profile.

Every new DSH RC enters a compatibility canary covering dependency contracts, Windows/Linux distribution, composition, tool calls, and real startup before the compatibility matrix changes.

## Update and uninstall

Update to another pinned release:

```bash
dsh plugin --profile web remove dsh-deepatlas
dsh plugin --profile web add https://codeload.github.com/Oscar-Williams/dsh-deepatlas/tar.gz/refs/tags/v0.2.2
```

Uninstall:

```bash
dsh plugin --profile web remove dsh-deepatlas
```

Local indexes and audit records remain in `dataDir` after package removal.

## Development and verification

```bash
npm ci
npm test
npm run typecheck
npm run typecheck:tests
npm run build
```

The current regression baseline is **22 test files and 108 tests**. CI covers Node 22/24, Windows, distribution integrity, tarball installation and boot verification, plus nightly install-by-commit E2E. GitHub installation ships the committed `lib/`, so source changes must include matching build output.

## Roadmap

- **v0.2.2**: pinned HTTPS installation, release integrity, complete partitioned discovery, DSH rc.2 lossless JSON, audit authorization hardening, Windows CLI handling, and install recovery.
- **v0.3.x**: complete HostIntentGate, Evidence v2, real-session false-positive monitoring, and explainability reports.
- **v0.4.x**: automated DSH RC canaries, expanded audit rules, incremental index maintenance, and long-term compatibility policy.
- **1.0 criteria**: stable DSH APIs, repeatable cross-version verification, defined data migrations, and a security-response process.

## Naming

| Context | Name |
|---|---|
| Product | DeepAtlas |
| Full name | DeepAtlas for DeepSeek Harness |
| GitHub repository / DSH package | `dsh-deepatlas` |
| Chinese description | DSH 插件导航 |

## Acknowledgements

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
- [Oh-My-DSH](https://github.com/like-study1/Oh-My-DSH)
- [awesome-deepseek-harness](https://github.com/Dominic789654/awesome-deepseek-harness)

## License

[MIT](./LICENSE) © 2026 DeepAtlas contributors
