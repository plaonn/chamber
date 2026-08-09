# Chamber contributor guidance

- Keep Chamber independent of Orca and any single agent runtime. Orca or another orchestrator may launch native worker sessions, but do not add an Orca-specific integration contract unless a future requirement explicitly needs one.
- Preserve `brand/` assets and specification unless a task explicitly changes brand work.
- Treat host adapters as thin translations; vendor fields must not leak into core policy logic.
- Add fixtures and tests for every adapter or schema behavior change.
- Never run installation against a user's global agent configuration during tests. Use `--config-dir` fixtures and `--dry-run`.
- Store only redacted event material. Do not commit trace files or credentials.
- Run `pnpm test` and `pnpm check` before handoff.
- When native dogfood or runtime execution uses a checkout distinct from the implementation worktree, verify the effective runtime revision before handoff. A clean fast-forward may be synchronized only under the owning execution context's existing Git authority; never silently overwrite, reset, or synchronize a dirty, diverged, or unverified runtime checkout.
