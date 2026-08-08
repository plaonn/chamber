# Chamber MVP architecture

## Boundary

Chamber sits outside native runtimes. Codex and Gemini CLI remain responsible for model loops, context, and native shell/file tools. Chamber owns adapter translation, normalized trace capture, policy evaluation, validation evidence, and quality-evidence export. It has no Orca runtime dependency and does not own routing, queueing, quota, or price decisions.

## Canonical event first

`chamber.event.v1` contains lifecycle, host provenance, effective worker profile, normalized payload, and a clearly isolated redacted `vendor` field. Core policy code only evaluates canonical lifecycle and payload fields. Adapters are the only place where raw host names are mapped.

Lifecycle vocabulary: `session.start`, `session.end`, `prompt.submit`, `model.before`, `model.after`, `tool.before`, `tool.after`, `finish.before`, `finish.after`, and `outcome`.

## Capability model

Capabilities are event-conditioned, not host-wide promises. Each adapter computes `can_block`, `can_mutate_tool_args`, `can_inject_context`, `can_observe_model_io`, `can_retry_finish`, and `can_modify_output` from the normalized host event. A policy decision names required capabilities. Enforcement on an event without them returns an explicit `audit` decision with its missing capability names; it is never silently ignored.

## Policy primitives

Validators return allow/deny/retry-oriented decisions. Mutators are a separate pure transformation seam and are not used by the default profile. `completion-evidence` is trajectory-aware: a finish claim that says tests passed or verification succeeded is supported only when prior canonical tool events contain a successful recognized test command.

The default `audit-default@1` profile does not block a host. A future enforce profile can use policy-specific `failure_semantics` and adapter capability checks.

## Native contract mapping

Codex CLI `0.147.0` maps `SessionStart` to `session.start`, `UserPromptSubmit` to `prompt.submit`, `PreToolUse`/`PostToolUse` to tool lifecycle events, and `Stop` to `finish.before`. `Stop.last_assistant_message` is the canonical `completion_output`. Codex response generation is event-aware: `PreToolUse` emits `{ "decision": "approve" }` or `{ "decision": "block", "reason": ... }`; `Stop` uses an empty no-op response or block. The stable Bash `PostToolUse.tool_response` is output-only JSON (commonly a string), not an exit-status object. Chamber records a recognized check as `execution: unknown` with `exact-exit-status-unsupported`; it never promotes this hook alone to passed verification.

Gemini CLI `0.37.2` maps `BeforeAgent` to `prompt.submit`, and `AfterAgent` to `finish.before` because it supplies `prompt_response` at the response validation/retry boundary. `BeforeTool` and `AfterTool` remain canonical tool lifecycle events. Gemini uses structured `{ "decision": "allow" | "deny", "reason"? }` responses; an `AfterAgent` deny requests a retry. For the built-in `run_shell_command` ToolResult, Chamber marks a check failed for explicit `error`, `data.isError`, or nonzero `data.exitCode`; marks cancellation/background/ambiguous results unknown; and accepts only the source-defined, completed no-error/no-data shape as implicit-zero success.

## Trace and evidence

The first store is append-only JSONL for dependency-free local operation and deterministic export. Raw hook payload is ephemeral: adapters normalize it and policy evaluates it in memory. Persistence writes `chamber.trace.v2` with `minimized-v2` provenance and an allowlisted projection only: identifiers, lifecycle, host/worker provenance, hook name, stop-loop flag, and verification classification/outcome. Prompts, final responses, command strings, tool output, arbitrary tool input, and raw vendor payload are omitted by default. Explicit raw-vendor debug recording is opt-in only and still redacted; it is not used by normal CLI flows.

Quality evidence identifies an effective worker profile rather than a raw model name: host, agent runtime, model, host version, adapter revision, policy profile/revision, and config revision. Deterministic verification evidence means only a recognized test/check command with host-supported successful execution semantics. Unclassified tools and recognized commands without a reliable status are not counted. Gemini shell signal termination is failed evidence, never implicit-zero success. Task class is a bounded enum derived in memory from prompt/command text; only its value, revision, and provenance are persisted. Session evidence retains the most recent non-`unknown` class so a later lifecycle event without classifiable input cannot erase it. `chamber outcome --session-id … --status accepted|rejected|unknown` is the standalone producer for explicit acceptance evidence and contains no feedback/transcript body. The MVP sets `success_probability` to `null` with `uncertainty: insufficient_evidence` until sufficient accepted outcomes exist.

## Adapter contract status

Gemini CLI's documented command hooks cover session, agent, model, and tool lifecycle events and use JSON stdin/stdout. Its documented structured allow/deny response is used directly. Codex CLI 0.147.0 exposes lifecycle hooks behind its enabled hooks feature and reports hook definitions with `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, and `Stop` naming; tool coverage depends on the native handler. Codex adapter output uses the same allow/deny decision envelope, but a real native smoke is still required before claiming all handlers or a global registration path work.

## Host registration boundary

Adapters can normalize events and generate host responses. Actual global hook registration is intentionally not performed by tests or commands without an operator-selected config directory. `install --dry-run` previews a reversible Chamber registration manifest; non-dry-run writes a local manifest with a `.bak` backup. Official host configuration paths and exact registration formats are adapter-contract concerns and must be refreshed before global installation.

## Orca dogfood next step

After official host registration contracts are validated against the installed CLIs, configure one isolated test profile for a native Codex or Gemini session, run an audit-only task, and inspect the resulting local trace/evidence through `chamber trace` and `chamber evidence`. Orca may provide the first interaction surface, but Chamber must receive host events through its adapters and remain runnable without Orca.
