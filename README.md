<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/assets/presentation/chamber-readme-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="brand/assets/presentation/chamber-readme-light.svg">
    <img alt="Chamber" src="brand/assets/presentation/chamber-readme-light.svg" width="840">
  </picture>
</p>

<p align="center"><strong>Local-first audit, policy, and quality-evidence layer for native AI coding agents.</strong></p>

Chamber sits around native coding-agent runtimes rather than replacing them. Host adapters translate lifecycle events into a vendor-neutral canonical event model; the Chamber core records minimized traces, evaluates deterministic policy, and emits portable quality evidence that other systems can consume.

The current MVP supports fixture-validated Codex and Gemini CLI adapters, audit-only policy evaluation, a stable user-level JSONL state store, session-aware evidence, execution-bound automatic acquisition, and a standalone Node CLI. Chamber deliberately does not own task queues, model prices, quotas, economic routing, or an Orca-specific runtime contract.

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
node bin/chamber.js correlate --state-dir .chamber-demo --session-id SESSION_ID --source-kind work-item --source-id ITEM_ID
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
chamber correlate --session-id ID --source-kind KIND --source-id ID [--source-revision REV] [--state-dir DIR]
chamber outcome --session-id ID --status accepted|rejected|unknown [--state-dir DIR]
chamber outcome --latest-unlabeled --status accepted|rejected [--state-dir DIR]
chamber outcome --correlation-id ID [--correlation-kind KIND] --status accepted|rejected|unknown [--producer PRODUCER] [--source-kind KIND --source-id ID] [--state-dir DIR]
chamber settle --execution-id ID --status accepted|rejected|unknown --source-kind KIND --source-id ID [--source-revision REV] [--producer execution-controller|independent-verifier|benchmark|oracle] [--state-dir DIR]
chamber dogfood [--state-dir DIR]
chamber normalize --host codex|gemini --input event.json [--state-dir DIR]
chamber hook --host codex|gemini [--state-dir DIR]
chamber install --host codex|gemini --config-dir ./test-config [--dry-run]
chamber uninstall --host codex|gemini --config-dir ./test-config [--dry-run]
```

`install` is a reversible, isolated registration manifest writer for testing Chamber registration. It never edits global Codex or Gemini configuration unless an operator explicitly supplies its real config directory. A real host-registration command remains gated on current official contract verification and is not part of this MVP's automated tests.

Chamber stores minimized traces in a stable user-level state directory by default. `CHAMBER_STATE_DIR` overrides both that default and `--state-dir` for every hook and operator command. `migrate --from DIR` imports only minimized, event-identified records, deduplicates by event ID, and never removes the source.

`evidence --session-id ID` evaluates exactly that session. Without an ID, Chamber infers the only recorded session or returns `selection_required` when the store has more than one. `summary` is intentionally descriptive: it reports aggregate session, outcome, worker, task-class, verification, execution-binding, correlation, and outcome-producer counts while leaving `success_probability` unestimated.

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

`correlate` records one bounded provider-neutral source reference (`source_kind`, `source_id`, and optional `source_revision`) against an existing session. It is idempotent for the same source and fails closed on a conflicting revision. Native hooks can capture the same reference once from `CHAMBER_CORRELATION_KIND`, `CHAMBER_CORRELATION_ID`, and optional `CHAMBER_CORRELATION_REVISION`; invalid or incomplete environment metadata is ignored. A controller should also provide a unique `CHAMBER_EXECUTION_ID` for each dispatch, including retries of the same task.

`outcome` records only an explicit bounded status (`accepted`, `rejected`, or `unknown`) against an existing traced session. It reuses that session's worker provenance and stores neither reviewer feedback nor transcripts. `--producer` records explicit provenance for `operator`, `user-approval`, `execution-controller`, `independent-verifier`, `benchmark`, or `oracle`; execution-controller, independent-verifier, benchmark, and oracle producers require a bounded `--source-kind` and `--source-id`, while user approval may use the selected session directly. The producer flag declares the evidence source; it does not authenticate or infer acceptance.

`outcome --latest-unlabeled` labels the uniquely most recent unlabeled session, using persisted event timestamps only. `outcome --correlation-id ID` selects the uniquely associated session and returns `selection_required` when the source maps to more than one session. A tied, missing, or unparseable selector returns without writing. Repeating the same status and provenance is idempotent, while a conflicting status or producer/source is rejected. `dogfood` is a compact report of session-level acceptance, execution, verification, execution-binding, correlation, outcome-producer, finding, intervention, budget, capability-gap, and unlabeled-session counts. Its verification state is freshness-aware: `passed`, `stale`, `failed`, or `unknown`. It never treats verification, completion, commit/push, or task-manager state as acceptance.

`settle` is the controller-facing automatic path. It selects the unique session by `CHAMBER_EXECUTION_ID` without requiring a person to discover or enter a native `session_id`, then appends one explicit outcome with bounded source provenance. Repeating the same settlement is idempotent; an unknown or non-unique execution identity returns without writing. The source and status must still come from the actual acceptance authority: Chamber never infers `accepted` from a worker exit, test result, commit, or Todoist completion.

For a Todoist-to-Codex/Orca dispatch or a future Cyclone dispatch, the controller uses the same provider-neutral handoff:

```bash
CHAMBER_CORRELATION_KIND=todoist \
CHAMBER_CORRELATION_ID="$TASK_ID" \
CHAMBER_CORRELATION_REVISION="$TASK_REVISION" \
CHAMBER_EXECUTION_ID="$DISPATCH_ID" \
  <native-agent-launch>

chamber settle --execution-id "$DISPATCH_ID" \
  --status "$AUTHORITATIVE_STATUS" \
  --producer execution-controller \
  --source-kind "$AUTHORITY_KIND" --source-id "$AUTHORITY_ID" \
  --source-revision "$AUTHORITY_REVISION"
```

The dispatcher supplies the context and invokes settlement as part of its normal completion callback; no Chamber-specific Orca or Cyclone adapter is required. If no acceptance authority exists, it leaves acceptance unknown rather than fabricating a label.

## Codex verification capture (opt-in)

Codex `PostToolUse` does not provide a reliable shell exit status, so Chamber records its recognized checks as `unknown` by default. Set `CHAMBER_CAPTURE_VERIFICATION=1` for one Codex invocation to have `PreToolUse` replace a recognized Bash check with a Chamber wrapper. The wrapper runs the unchanged command, records only its exit status as `passed` or `failed` against the existing Codex session, and preserves the command exit code. It does not persist the command or its output.

This is opt-in and leaves global Codex configuration unchanged. Enable it only after the isolated native smoke has validated the installed hook contract.

## Contributing

Contributions are welcome. Chamber currently uses lightweight maintainer-led governance and does not require a CLA or DCO. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Brand

The canonical standalone symbol, symbol-as-C wordmark, reproducible vector sources, usage rules, and derived presentation assets live under [`brand/`](brand/README.md).

Repository contents are licensed under the [Apache License, Version 2.0](LICENSE) unless otherwise noted. The software license does not grant rights to present another product or distribution as the official Chamber project. Truthful descriptive use remains allowed; see [TRADEMARKS.md](TRADEMARKS.md).
