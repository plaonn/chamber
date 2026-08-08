# Chamber MVP architecture

## Boundary

Chamber sits outside native runtimes. Codex and Gemini CLI remain responsible for model loops, context, and native shell/file tools. Chamber owns adapter translation, normalized trace capture, policy evaluation, validation evidence, and quality-evidence export. It has no Orca runtime dependency and does not own routing, queueing, quota, or price decisions.

## Canonical event first

`chamber.event.v1` contains lifecycle, host provenance, effective worker profile, normalized payload, and a clearly isolated redacted `vendor` field. Core policy code only evaluates canonical lifecycle and payload fields. Adapters are the only place where raw host names are mapped.

Lifecycle vocabulary: `session.start`, `session.end`, `prompt.submit`, `model.before`, `model.after`, `tool.before`, `tool.after`, `finish.before`, `finish.after`, and `outcome`.

## Capability model

Each adapter publishes booleans for `can_block`, `can_mutate_tool_args`, `can_inject_context`, `can_observe_model_io`, `can_retry_finish`, and `can_modify_output`. A policy decision names required capabilities. Enforcement on a host without them returns an explicit `audit` decision with its missing capability names; it is never silently ignored.

## Policy primitives

Validators return allow/deny/retry-oriented decisions. Mutators are a separate pure transformation seam and are not used by the default profile. `completion-evidence` is trajectory-aware: a finish claim that says tests passed or verification succeeded is supported only when prior canonical tool events contain a successful recognized test command.

The default `audit-default@1` profile does not block a host. A future enforce profile can use policy-specific `failure_semantics` and adapter capability checks.

## Trace and evidence

The first store is append-only JSONL for dependency-free local operation and deterministic export. Each line includes `chamber.trace.v1`, record time, redacted raw vendor data, canonical event, and policy decision. Key/value redaction runs before storage. This is intentionally a local record, not a centralized analytics service.

Quality evidence identifies an effective worker profile rather than a raw model name: host, agent runtime, model, host version, adapter revision, policy profile/revision, and config revision. The MVP sets `success_probability` to `null` with `uncertainty: insufficient_evidence` until sufficient accepted outcomes exist.

## Adapter contract status

Gemini CLI's documented command hooks cover session, agent, model, and tool lifecycle events and use JSON stdin/stdout. Its documented structured allow/deny response is used directly. Codex CLI 0.147.0 exposes lifecycle hooks behind its enabled hooks feature and reports hook definitions with `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, and `Stop` naming; tool coverage depends on the native handler. Codex adapter output uses the same allow/deny decision envelope, but a real native smoke is still required before claiming all handlers or a global registration path work.

## Host registration boundary

Adapters can normalize events and generate host responses. Actual global hook registration is intentionally not performed by tests or commands without an operator-selected config directory. `install --dry-run` previews a reversible Chamber registration manifest; non-dry-run writes a local manifest with a `.bak` backup. Official host configuration paths and exact registration formats are adapter-contract concerns and must be refreshed before global installation.

## Orca dogfood next step

After official host registration contracts are validated against the installed CLIs, configure one isolated test profile for a native Codex or Gemini session, run an audit-only task, and inspect the resulting local trace/evidence through `chamber trace` and `chamber evidence`. Orca may provide the first interaction surface, but Chamber must receive host events through its adapters and remain runnable without Orca.
