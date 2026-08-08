# Contributing to Chamber

Chamber is currently a small, maintainer-led open-source project. Contributions are welcome, but the project intentionally keeps governance lightweight while the architecture is still settling.

## Before contributing

- Read `AGENTS.md` and the relevant architecture/schema documents before changing behavior or public contracts.
- For substantial changes, prefer opening an issue or discussion first so scope and product boundaries can be aligned before implementation.
- Keep Chamber independent of Orca and any single native agent runtime.
- Do not include secrets, credentials, private transcripts, private absolute paths, or real sensitive hook payloads in issues, fixtures, commits, or test output.

## Development checks

Before submitting a code change, run:

```bash
pnpm test
pnpm check
```

Add or update fixtures and regression tests when changing adapters, schemas, policy behavior, persistence, or evidence semantics.

## Contribution license

Repository contents are licensed under the Apache License, Version 2.0 unless otherwise noted.

Unless explicitly agreed otherwise in writing, a contribution intentionally submitted for inclusion in Chamber is provided under the Apache License, Version 2.0, consistent with Section 5 of that license. Contributors retain copyright in their own contributions while granting the rights described by Apache-2.0.

Only submit work that you have the right to contribute. Do not submit third-party code, data, images, or other material under terms that are incompatible with this repository.

Chamber currently does **not** require a Contributor License Agreement (CLA) or Developer Certificate of Origin (DCO). That may be revisited only if the project grows to need more formal contribution governance.

## Brand changes

Code contribution and brand permission are separate matters. The Apache-2.0 license does not grant trademark or product-name rights.

Changes to the official Chamber symbol or other canonical brand assets require explicit maintainer review and must keep `brand/brand-spec.json`, the generator, canonical exports, and `brand/README.md` consistent. See `TRADEMARKS.md` for brand-use guidance.

## Scope and review

A merged contribution becomes part of Chamber's maintained codebase, but merge does not imply that every proposed API, integration, or compatibility claim becomes a permanent project commitment. Maintainers may ask for a smaller scope, additional evidence, compatibility work, or a follow-up change when needed to preserve the project's documented boundaries.
