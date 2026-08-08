# Chamber

Chamber is a local-first audit, policy, and quality-evidence layer around native AI coding agents. It does not replace Codex, Gemini CLI, Cursor, or their tool loops. Host adapters translate lifecycle events into a vendor-neutral canonical event model; the Chamber core records traces, evaluates policy, and emits evidence that another system can consume.

The initial MVP supports fixture-validated Codex and Gemini CLI adapters, audit-only policy evaluation, local JSONL traces, and a standalone Node CLI. It deliberately does not own task queues, model prices, quotas, or economic routing.

License: no license has been selected for this repository; no license text is added by this MVP.

## Quick start

Requires Node 20+ and pnpm.

```bash
pnpm test
pnpm demo
node bin/chamber.js hosts
node bin/chamber.js doctor --state-dir .chamber-demo
node bin/chamber.js trace --state-dir .chamber-demo
node bin/chamber.js evidence --state-dir .chamber-demo
```

The demo records a completion claim without test evidence. Because the default policy is audit-only, it records the unsupported claim and does not alter host behavior.

## Operator commands

```text
chamber hosts
chamber doctor [--state-dir DIR]
chamber trace [--state-dir DIR] [--session-id ID]
chamber evidence [--state-dir DIR] [--session-id ID]
chamber normalize --host codex|gemini --input event.json [--state-dir DIR]
chamber install --host codex|gemini --config-dir ./test-config --dry-run
chamber uninstall --host codex|gemini --config-dir ./test-config --dry-run
```

`install` is a reversible, isolated registration manifest writer for testing Chamber registration. It never edits global Codex or Gemini configuration unless an operator explicitly supplies its real config directory. A real host-registration command remains gated on current official contract verification and is not part of this MVP's automated tests.

## Architecture

```text
native agent → thin host adapter → canonical Chamber event
                                  ↓
                           trace / policy / evidence
                                  ↓
                         portable quality evidence
```

Read [the architecture contract](docs/architecture.md), the [event and evidence schemas](docs/schema.md), and the [storage decision](docs/decisions/0001-jsonl-local-store.md).

## Development

```bash
pnpm test
pnpm lint
pnpm typecheck
```

Fixtures are sanitized and do not invoke external agent runtimes. See `test/fixtures/`.
