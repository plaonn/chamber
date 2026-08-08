# Chamber

Chamber is a local-first audit, policy, and quality-evidence layer around native AI coding agents. It does not replace Codex, Gemini CLI, Cursor, or their tool loops. Host adapters translate lifecycle events into a vendor-neutral canonical event model; the Chamber core records traces, evaluates policy, and emits evidence that another system can consume.

The initial MVP supports fixture-validated Codex and Gemini CLI adapters, audit-only policy evaluation, local JSONL traces, and a standalone Node CLI. It deliberately does not own task queues, model prices, quotas, or economic routing. Chamber also has no Orca dependency: Orca may be used as an optional interaction surface for native worker sessions, but Chamber observes and controls those workers through their native runtime hooks rather than an Orca-specific integration.

## License and brand

Repository contents are licensed under the [Apache License, Version 2.0](LICENSE) unless otherwise noted.

The software license does not grant rights to present another product or distribution as the official Chamber project. Truthful descriptive use remains allowed; see [TRADEMARKS.md](TRADEMARKS.md) for the lightweight brand-use policy.

## Contributing

Contributions are welcome. Chamber currently uses lightweight maintainer-led governance and does not require a CLA or DCO. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Quick start

Requires Node 20+ and pnpm.

```bash
pnpm test
pnpm demo
node bin/chamber.js hosts
node bin/chamber.js doctor --state-dir .chamber-demo
node bin/chamber.js trace --state-dir .chamber-demo
node bin/chamber.js evidence --state-dir .chamber-demo
node bin/chamber.js outcome --state-dir .chamber-demo --session-id SESSION_ID --status accepted
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
pnpm check
```

Fixtures are sanitized and do not invoke external agent runtimes. See `test/fixtures/`.

`outcome` records only an explicit bounded status (`accepted`, `rejected`, or `unknown`) against an existing traced session. It reuses that session's worker provenance and stores neither reviewer feedback nor transcripts.
