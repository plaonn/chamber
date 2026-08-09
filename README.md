<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/assets/presentation/chamber-readme-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="brand/assets/presentation/chamber-readme-light.svg">
    <img alt="Chamber" src="brand/assets/presentation/chamber-readme-light.svg" width="840">
  </picture>
</p>

<p align="center"><strong>Local-first audit, policy, and quality-evidence layer for native AI coding agents.</strong></p>

Chamber sits around native coding-agent runtimes rather than replacing them. Host adapters translate lifecycle events into a vendor-neutral canonical event model; the Chamber core records minimized traces, evaluates deterministic policy, and emits portable quality evidence that other systems can consume.

The current MVP supports fixture-validated Codex and Gemini CLI adapters, audit-only policy evaluation, a stable user-level JSONL state store, session-aware evidence, and a standalone Node CLI. Chamber deliberately does not own task queues, model prices, quotas, economic routing, or an Orca-specific runtime contract.

## Quick start

Requires Node.js 20+ and pnpm.

```bash
pnpm test
pnpm demo
node bin/chamber.js hosts
node bin/chamber.js doctor --state-dir .chamber-demo
node bin/chamber.js trace --state-dir .chamber-demo
node bin/chamber.js evidence --state-dir .chamber-demo
node bin/chamber.js outcome --state-dir .chamber-demo --session-id SESSION_ID --status accepted
node bin/chamber.js dogfood --state-dir .chamber-demo
pnpm smoke:gemini
```

The demo records a completion claim without test evidence. Because the default policy is audit-only, it records the unsupported claim and does not alter host behavior.

`smoke:gemini` builds a disposable project-local `.gemini/settings.json`, installs `BeforeAgent` and `AfterAgent` hooks only in that temporary project, and removes it afterward. It requires an already-valid Gemini CLI authentication method and makes one model call; it never edits global settings.

## Operator commands

```text
chamber hosts
chamber doctor [--state-dir DIR]
chamber trace [--state-dir DIR] [--session-id ID]
chamber evidence [--state-dir DIR] [--session-id ID]
chamber summary [--state-dir DIR]
chamber migrate --from DIR [--state-dir DIR]
chamber outcome --session-id ID --status accepted|rejected|unknown [--state-dir DIR]
chamber outcome --latest-unlabeled --status accepted|rejected [--state-dir DIR]
chamber dogfood [--state-dir DIR]
chamber normalize --host codex|gemini --input event.json [--state-dir DIR]
chamber hook --host codex|gemini [--state-dir DIR]
chamber install --host codex|gemini --config-dir ./test-config [--dry-run]
chamber uninstall --host codex|gemini --config-dir ./test-config [--dry-run]
```

`install` is a reversible, isolated registration manifest writer for testing Chamber registration. It never edits global Codex or Gemini configuration unless an operator explicitly supplies its real config directory. A real host-registration command remains gated on current official contract verification and is not part of this MVP's automated tests.

Chamber stores minimized traces in a stable user-level state directory by default. `CHAMBER_STATE_DIR` overrides both that default and `--state-dir` for every hook and operator command. `migrate --from DIR` imports only minimized, event-identified records, deduplicates by event ID, and never removes the source.

`evidence --session-id ID` evaluates exactly that session. Without an ID, Chamber infers the only recorded session or returns `selection_required` when the store has more than one. `summary` is intentionally descriptive: it reports aggregate session, outcome, worker, task-class, and verification counts while leaving `success_probability` unestimated.

## Architecture

```text
native agent -> thin host adapter -> canonical Chamber event
                                  |
                                  v
                           trace / policy / evidence
                                  |
                                  v
                         portable quality evidence
```

Read the [architecture contract](docs/architecture.md), [event and evidence schemas](docs/schema.md), and [storage decision](docs/decisions/0001-jsonl-local-store.md).

## Development

```bash
pnpm test
pnpm check
pnpm check:brand
```

`pnpm test` and `pnpm check` validate the JavaScript runtime surface. `pnpm check:brand` regenerates deterministic brand SVGs, parses the brand spec/assets, and verifies that generated brand files are committed in sync.

Fixtures are sanitized and do not invoke external agent runtimes. See `test/fixtures/`.

`outcome` records only an explicit bounded status (`accepted`, `rejected`, or `unknown`) against an existing traced session. It reuses that session's worker provenance and stores neither reviewer feedback nor transcripts.

`outcome --latest-unlabeled` labels the uniquely most recent unlabeled session, using persisted event timestamps only. A tied, missing, or unparseable timestamp returns a bounded `selection_required` queue without writing. Repeating the same label is idempotent, while a conflicting label is rejected. `dogfood` is a compact report of session-level acceptance, execution and verification coverage plus minimized finding, intervention, budget, capability-gap, and unlabeled-session counts. Its verification state is freshness-aware: `passed`, `stale`, `failed`, or `unknown`. It never treats verification or completion as acceptance.

## Codex verification capture (opt-in)

Codex `PostToolUse` does not provide a reliable shell exit status, so Chamber records its recognized checks as `unknown` by default. Set `CHAMBER_CAPTURE_VERIFICATION=1` for one Codex invocation to have `PreToolUse` replace a recognized Bash check with a Chamber wrapper. The wrapper runs the unchanged command, records only its exit status as `passed` or `failed` against the existing Codex session, and preserves the command exit code. It does not persist the command or its output.

This is opt-in and leaves global Codex configuration unchanged. Enable it only after the isolated native smoke has validated the installed hook contract.

## Contributing

Contributions are welcome. Chamber currently uses lightweight maintainer-led governance and does not require a CLA or DCO. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Brand

The canonical standalone symbol, symbol-as-C wordmark, reproducible vector sources, usage rules, and derived presentation assets live under [`brand/`](brand/README.md).

Repository contents are licensed under the [Apache License, Version 2.0](LICENSE) unless otherwise noted. The software license does not grant rights to present another product or distribution as the official Chamber project. Truthful descriptive use remains allowed; see [TRADEMARKS.md](TRADEMARKS.md).
