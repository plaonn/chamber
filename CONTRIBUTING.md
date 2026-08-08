# Contributing to Chamber

Thanks for considering a contribution to Chamber.

Chamber is intentionally small: it is a local-first audit, policy, and quality-evidence layer around native AI coding agents. It is not an agent runtime, queue, router, or orchestration product. Orca or another orchestrator may be used to launch or interact with native worker sessions, but Chamber should remain independent of those surfaces and observe/control workers through native runtime hooks unless a future requirement explicitly establishes a separate integration contract.

## Before opening a change

- Keep host adapters thin. Vendor-specific field names should be normalized before core policy logic sees them.
- Preserve the canonical event and evidence contracts unless the change intentionally revises them.
- Add or update fixtures and tests when adapter, schema, policy, trace, or evidence behavior changes.
- Keep traces and fixtures sanitized. Do not commit prompts, transcripts, tool output, credentials, API keys, or private runtime data.
- Do not make tests edit a user's global Codex, Gemini, or other agent configuration. Use isolated config directories and dry-run paths.

## Development

Requires Node.js 20+ and pnpm.

```bash
pnpm install
pnpm test
pnpm check
```

For the optional Gemini native smoke:

```bash
pnpm smoke:gemini
```

The smoke makes a real Gemini CLI model call using the developer's existing authentication, but writes hook configuration only inside a disposable project-local directory and removes that directory afterward.

## Pull requests

A focused pull request should explain:

- What behavior or contract changed.
- Why the change belongs in Chamber rather than a native runtime, orchestrator, or execution-control plane.
- Which native/runtime versions or documented contracts the change relies on when applicable.
- What tests or smoke evidence cover the change.
- Any remaining uncertainty or host-specific limitation.

Do not claim a native contract is verified merely because a fixture passes. Real host-registration or lifecycle claims need current native documentation or direct smoke evidence.

## Governance and contribution terms

Chamber currently uses lightweight maintainer-led governance. No CLA or DCO sign-off is required at this stage.

By submitting a contribution, you agree that your contribution is provided under the repository's Apache License 2.0. You must have the right to submit the code, documentation, or other material you contribute.

The maintainer may ask for provenance or licensing clarification when a contribution is unusually large, generated from another source, or appears to incorporate third-party material.

## Security and sensitive reports

Do not put credentials, private traces, unreleased proprietary code, or other secrets in public issues or pull requests. Follow [SECURITY.md](SECURITY.md) for sensitive security reports.

## Brand

Code contributions do not grant rights to represent a fork or derivative distribution as the official Chamber project. See [TRADEMARKS.md](TRADEMARKS.md) for the project naming and brand-use policy.
