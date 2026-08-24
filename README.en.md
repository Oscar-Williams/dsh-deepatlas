# DeepAtlas for DeepSeek Harness

[![CI](https://github.com/Oscar-Williams/dsh-deepatlas/actions/workflows/ci.yml/badge.svg)](https://github.com/Oscar-Williams/dsh-deepatlas/actions/workflows/ci.yml)
[![DSH](https://img.shields.io/badge/DSH-0.1.1--rc.1%20%7C%20rc.2-blue)](./docs/compatibility.md)
[![Status](https://img.shields.io/badge/status-public%20preview-blueviolet)](./CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

DeepAtlas helps DeepSeek Harness (DSH) users decide whether a plugin capability change is worth making, with a reviewable record of discovery, verification, and installation. Describe a goal such as cross-session memory, messaging, or browser automation, and the DSH host model can call DeepAtlas on demand to compare the active profile with suitable candidates, match evidence, and risk signals.

After you select a candidate, DeepAtlas reviews a full commit, checks compatibility, and enters a pinned installation and recovery flow only after explicit approval. The current release works on demand within the conversation. Plugin discovery requires one user-confirmed complete scan before first use, while indexes, audit records, and installation state remain local.

[中文](./README.md) · [Architecture](./docs/architecture.md) · [Security](./docs/security.md) · [Compatibility](./docs/compatibility.md) · [Changelog](./CHANGELOG.md)

## How DeepAtlas participates in a task

DeepAtlas exposes six tools to the active DSH conversation. After you ask to find a plugin, compare candidates, or check a capability gap, the host model can select `deepatlas_find` or `deepatlas_advise` from the visible tool schemas. An explicit request such as “use DeepAtlas to find a plugin” provides more predictable invocation. Continuous task awareness and controlled proactive suggestions are planned for v0.2.4.

| Stage | Trigger | Runtime behavior |
|---|---|---|
| Ecosystem scan | The user confirms `deepatlas_scan` | The active DSH process reads GitHub and community sources, then builds or refreshes the local index |
| Task retrieval | The user raises a plugin-discovery need and the host model selects a DeepAtlas tool | DeepAtlas interprets this request and canonical capabilities, then searches the existing local index |
| Capability advice | The host model calls `deepatlas_advise` | The tool compares the active profile, returning a silent result when coverage is sufficient and suggestions for a clear gap |
| Audit and install | The user selects a repository and full commit, then confirms each stage | DeepAtlas performs static audit, compatibility checks, snapshotting, pinned installation, and recovery |

Natural-language tool selection is performed by the active DSH model and can vary with the model, prompt, and visible tool set. Initial indexing and later refreshes run through the confirmed scan tool; routine retrieval reads the local index.

## Highlights

- **Capability coverage checks** compare the active profile with the task, remain quiet when coverage is sufficient, and return 1–3 suggestions for a clear gap.
- **Task capability retrieval** combines 28 bilingual capability classes, field-level evidence, and quality signals while presenting match reasons and capability overlap.
- **Reviewable capability evidence** uses GitHub Search and community lists for discovery, then reads candidate manifests, READMEs, and declared entries at one full commit while recording repository paths, content hashes, and coverage status.
- **Pre-install risk audit** checks lifecycle scripts, dependency shapes, native dependencies, source patterns in the manifest-declared entry and bundle patch, and Node compatibility at a full commit SHA.
- **Controlled installation and recovery** authorizes from the matching local audit record, snapshots the profile before execution, and enters rollback when verification fails.
- **Evidence-backed ecosystem discovery** collects candidates from GitHub and community lists, then checks plugin structure and publisher files at one pinned commit to distinguish installable candidates from leads that need review.
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

The local index is the plugin candidate catalog used by DeepAtlas retrieval. After you confirm and start a complete scan, DeepAtlas reads GitHub and community sources, merges duplicate repositories, collects candidate evidence, and writes that catalog locally. The result includes the candidate count, source health, and index location. Maintainer verification results live in [Evaluation status](#evaluation-status).

With a stable network and a GitHub token, a complete scan typically finishes within several minutes. The anonymous validation run on 2026-08-23 took 15 minutes 46 seconds, mostly while waiting for GitHub Search quota. Actual duration varies with quota, network conditions, and ecosystem size. The scan runs in the active DSH process, so keep the process and network available until it completes.

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
GitHub / community sources
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

| Tool | Trigger and purpose | Main output |
|---|---|---|
| `deepatlas_scan` | Complete or incrementally refresh the ecosystem index after user confirmation | Item count, source health, index location |
| `deepatlas_status` | Inspect index age, TTL, source state, and Top 10 on request | Current state, auth mode, metadata coverage |
| `deepatlas_find` | Called by the host model for the current need; retrieve by task and capabilities | Match evidence, quality score, overlap notes |
| `deepatlas_advise` | Called by the host model when needed; compare task needs with installed plugins | Silent result or 1–3 suggestions |
| `deepatlas_audit` | Audit after the user selects a repository and full 40-character SHA | Risk level, evidence, compatibility, `auditedRef` |
| `deepatlas_install` | Plan or execute from the audit record after explicit user approval | State trace, command, execution/composition/activation flags |

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
| EvidenceGold v1 | accepted precision 100%; recall 100%; must-not false accepts 0 | Publisher provenance, word boundaries, and conflict regression |
| EvidenceFullScan (2026-08-24) | schema v2; structural/release Gate PASS | Same-run full scan of both sources and a pinned publisher cohort; [sanitized receipt](./benchmark/evidence-full-scan-receipt.json) |

HostIntentGate will independently measure the live path from natural language through the DSH host model to a capability array. The current 85.0% result measures retrieval after canonical capabilities have entered the tool parameters; EvidenceGold calibrates provenance, accepted claims, and false-accept boundaries. Both evaluations use frozen datasets, replayable records, and independent gates. Scale figures are dated release snapshots; the user's latest local scan represents the current ecosystem view.

## Compatibility and current scope

- DeepAtlas is a public preview and DSH is a Developer Preview.
- The current release line covers DSH `0.1.1-rc.1` / `0.1.1-rc.2` and Node 22.19 / 24.
- Distribution uses a GitHub tag or full commit SHA and includes prebuilt `lib/` artifacts.
- The current audit covers static risk signals. Resolved-environment checks, isolated boot, and goal acceptance will be delivered through the later Capability Change Transaction.
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

The v0.2.2 stable baseline is **22 test files and 108 tests**; the current v0.2.3 development branch has **26 test files and 131 tests**. CI covers Node 22/24, Windows, Evidence release and precision gates, distribution integrity, tarball installation and boot verification, plus nightly install-by-commit E2E. GitHub installation ships the committed `lib/`, so source changes must include matching build output.

## Roadmap

- **v0.2.2**: pinned HTTPS installation, release integrity, complete partitioned discovery, DSH rc.2 lossless JSON, audit authorization hardening, Windows CLI handling, and install recovery.
- **v0.2.3 (including rc.x)**: complete Evidence v2 provenance, conflict resolution, migration, coverage reporting, and regression gates.
- **v0.2.4 (including rc.x)**: deliver Capability Diagnosis, HostIntentGate, real DSH session replay, and controlled task awareness.
- **v0.2.5 (across multiple rc.x builds)**: deliver a complete Capability Change Transaction spanning a goal contract, exact candidate, actual dependency resolution, module-resolution probes, a full loader boot, runtime deltas, goal acceptance, policy verdict, rollback artifact, and content-addressed receipt.
- **v0.2.6**: harden dependency-drift and capability-reality checks, source adapters, failure injection, and receipt replay while reusing available DSH safe-boot, doctor, and capability-declaration interfaces.
- **v0.2.7 and later v0.2.x releases**: extend active assurance, post-install validation, drift and causal tracing, team policy, portable proof, and Verified Installability metrics.

See the [v0.2.x roadmap](./docs/v0.2.x-roadmap.md) for milestones, acceptance criteria, and the DSH coordination policy, the [Capability Change Transaction design](./docs/capability-change-transaction.md) for the transaction model, and the [Resolved Environment Preflight specification](./docs/resolved-environment-preflight.md) for the environment evidence layer.

## Naming

| Context | Name |
|---|---|
| Product | DeepAtlas |
| Full name | DeepAtlas for DeepSeek Harness |
| GitHub repository / DSH package | `dsh-deepatlas` |
| Chinese description | DSH 本地能力保障与插件导航 |

## Acknowledgements

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
- [Oh-My-DSH](https://github.com/like-study1/Oh-My-DSH)
- [awesome-deepseek-harness](https://github.com/Dominic789654/awesome-deepseek-harness)

## License

[MIT](./LICENSE) © 2026 DeepAtlas contributors
