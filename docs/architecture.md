# Chamber MVP architecture

## Boundary

Chamber sits outside native runtimes. Codex and Gemini CLI remain responsible for model loops, context, reasoning, and native shell/file tools. Chamber owns adapter translation, normalized trace capture, deterministic policy evaluation, validation evidence, bounded intervention selection, and quality-evidence export. It has no embedded generative model, no Orca runtime dependency, and does not own routing, queueing, quota, or price decisions.

Chamber does not think for the worker. It measures observable execution state, detects bounded findings, selects predefined interventions, and feeds those corrections back through the native runtime so the native worker can reason again. Semantic judgment that cannot be grounded in deterministic or externally supplied evidence is outside the core. A future external semantic evaluator may emit advisory findings, but it must remain optional and separate from the model-free core.

## Canonical event first

`chamber.event.v1` contains lifecycle, host provenance, effective worker profile, normalized payload, and a clearly isolated redacted `vendor` field. Core policy code only evaluates canonical lifecycle and payload fields. Adapters are the only place where raw host names are mapped.

Lifecycle vocabulary: `session.start`, `session.end`, `prompt.submit`, `model.before`, `model.after`, `tool.before`, `tool.after`, `finish.before`, `finish.after`, and `outcome`.

## Model-free intervention loop

The target correction loop is:

```text
native event
  -> trajectory reducer
  -> deterministic detector / validator
  -> structured finding
  -> policy selection
  -> bounded intervention
  -> capability negotiation
  -> host adapter
  -> native worker self-correction
```

A detector reports an observable condition; it does not generate free-form advice. A policy maps that finding to one of a bounded set of interventions and, when text is needed, selects a versioned fixed template with bounded parameters. The native model remains responsible for deciding the next coding action.

Initial intervention primitives are:

- `observe`: record the finding without changing host behavior.
- `inject_context`: add a predefined bounded correction when the host supports context injection.
- `retry_with_context`: reject a completion boundary and return a predefined correction so the native worker can try again.
- `block`: prevent an action whose deterministic policy requires denial.
- `mutate`: apply a narrow deterministic transformation only when semantics do not change; strategic or target-changing corrections should block or retry instead of silently rewriting the worker's decision.

The core must not turn a use of templates into a hidden prompt-generation subsystem. Free-form semantic critique belongs to an optional external evaluator, not to Chamber itself.

## Trajectory state

Policy should operate on bounded derived state rather than repeatedly interpreting the full raw transcript. A trajectory reducer may maintain facts such as:

- whether meaningful mutation occurred since the last successful verification;
- the latest verification classification and execution result;
- repeated equivalent failure count;
- completion-attempt count;
- intervention counts by finding/policy revision;
- whether required evidence became stale after a later mutation.

Verification freshness is an important first rule: a successful check that occurred before a later meaningful code mutation must not prove the final state. The current MVP only checks for successful verification somewhere in history; freshness-aware trajectory state is a next implementation step.

## Capability model

Capabilities are event-conditioned, not host-wide promises. Chamber must distinguish three layers:

1. `native_capability`: the installed runtime contract says the host event can support an operation.
2. `adapter_capability`: the current Chamber adapter actually implements the response encoding or transformation.
3. `runtime_verified_capability`: a native smoke or equivalent current evidence has verified the operation behaves as expected.

Only their supported intersection is an `effective_capability` that an enforcing policy may rely on. Unsupported or unverified capability must degrade explicitly; a declaration in host documentation alone is not sufficient enforcement evidence.

Capability dimensions include `can_block`, `can_mutate_tool_args`, `can_inject_context`, `can_observe_model_io`, `can_retry_finish`, and `can_modify_output`.

## Policy primitives and failure semantics

Validators and detectors produce findings. Mutators are a separate pure transformation seam and are not used by the default profile. `completion-evidence` is trajectory-aware in the MVP sense: a finish claim that says tests passed or verification succeeded is supported only when prior canonical tool events contain a successful recognized test command.

The default `audit-default@1` profile does not block a host. Enforcement policies must declare failure semantics by category rather than treating all failures alike:

- quality correction can normally fail open or degrade to audit when Chamber lacks reliable capability;
- safety, authority, credential, or similarly hard guards may require fail-closed behavior when their contract says so;
- a policy must not silently convert an unsupported intervention into a different one with broader authority.

Interventions also require budgets. A quality finding such as missing verification should have a bounded retry count so Chamber cannot create an infinite correction loop. Budget exhaustion should be explicit evidence; the resulting fail-open, unresolved, or fail-closed behavior is policy-specific.

## Policy improvement lifecycle

Chamber improves the managed worker without retraining model weights. The learning target is policy effectiveness: which predefined intervention improves outcomes for which effective worker and task class.

Promotion should follow:

```text
audit -> shadow -> bounded canary -> compare -> promote or retire
```

- `audit`: observe findings only.
- `shadow`: record which intervention would have been selected without applying it.
- `bounded canary`: apply a candidate policy to a limited comparable cohort.
- `compare`: measure outcome differences against an appropriate baseline with uncertainty.
- `promote or retire`: keep only policies with evidence of benefit and acceptable intervention cost.

Statistical estimation may use ordinary methods such as success rates, Bayesian estimates, regression, or contextual-bandit techniques. This is not an embedded LLM requirement. Selection bias and policy revision must remain visible in the evidence cohort.

## Outcome and attribution

A single `accepted|rejected|unknown` flag is sufficient for the current MVP but not for mature policy attribution. The next evidence contract should distinguish at least:

- execution: completed, aborted, or error;
- verification: passed, failed, or unknown;
- acceptance: accepted, rejected, or unknown.

Quality evidence must identify intervention policy/template revisions so baseline and intervention cohorts can be compared without storing prompts, transcripts, or free-form reviewer feedback.

## Native contract mapping

Codex CLI `0.147.0` maps `SessionStart` to `session.start`, `UserPromptSubmit` to `prompt.submit`, `PreToolUse`/`PostToolUse` to tool lifecycle events, and `Stop` to `finish.before`. `Stop.last_assistant_message` is the canonical `completion_output`. Codex response generation is event-aware: audit/allow returns an empty no-op response, while enforce-mode denial on block-capable events returns `{ "decision": "block", "reason": ... }`. The stable Bash `PostToolUse.tool_response` is output-only JSON (commonly a string), not an exit-status object. Chamber records a recognized check as `execution: unknown` with `exact-exit-status-unsupported`; it never promotes this hook alone to passed verification.

Gemini CLI `0.37.2` maps `BeforeAgent` to `prompt.submit`, and `AfterAgent` to `finish.before` because it supplies `prompt_response` at the response validation/retry boundary. `BeforeTool` and `AfterTool` remain canonical tool lifecycle events. Gemini uses structured `{ "decision": "allow" | "deny", "reason"? }` responses; an `AfterAgent` deny requests a retry. For the built-in `run_shell_command` ToolResult, Chamber marks a check failed for explicit `error`, `data.isError`, or nonzero `data.exitCode`; marks cancellation/background/ambiguous results unknown; and accepts only the source-defined, completed no-error/no-data shape as implicit-zero success.

## Trace and evidence

The first store is append-only JSONL for dependency-free local operation and deterministic export. Raw hook payload is ephemeral: adapters normalize it and policy evaluates it in memory. Persistence writes `chamber.trace.v2` with `minimized-v2` provenance and an allowlisted projection only: identifiers, lifecycle, host/worker provenance, hook name, stop-loop flag, and verification classification/outcome. Prompts, final responses, command strings, tool output, arbitrary tool input, and raw vendor payload are omitted by default. Explicit raw-vendor debug recording is opt-in only and still redacted; it is not used by normal CLI flows.

Quality evidence identifies an effective worker profile rather than a raw model name: host, agent runtime, model, host version, adapter revision, policy profile/revision, and config revision. Deterministic verification evidence means only a recognized test/check command with host-supported successful execution semantics. Unclassified tools and recognized commands without a reliable status are not counted. Gemini shell signal termination is failed evidence, never implicit-zero success. Task class is a bounded enum derived in memory from prompt/command text; only its value, revision, and provenance are persisted. Session evidence retains the most recent non-`unknown` class so a later lifecycle event without classifiable input cannot erase it. `chamber outcome --session-id … --status accepted|rejected|unknown` is the standalone producer for explicit acceptance evidence and contains no feedback/transcript body. The MVP sets `success_probability` to `null` with `uncertainty: insufficient_evidence` until sufficient accepted outcomes exist.

## Adapter contract status

Gemini CLI's documented command hooks cover session, agent, model, and tool lifecycle events and use JSON stdin/stdout. Its documented structured allow/deny response is used directly. Codex CLI 0.147.0 exposes lifecycle hooks behind its enabled hooks feature and reports hook definitions with `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, and `Stop` naming; tool coverage depends on the native handler. Codex adapter output is event-aware and uses native no-op/block semantics, but real native smoke coverage is still required before claiming all handlers or a global registration path work.

The current adapters expose event capability intent, but the three-layer effective-capability contract above is not yet implemented. Until that work lands, capability claims used for enforcement must be treated conservatively and verified by native smoke.

## Host registration boundary

Adapters can normalize events and generate host responses. Actual global hook registration is intentionally not performed by tests or commands without an operator-selected config directory. `install --dry-run` previews a reversible Chamber registration manifest; non-dry-run writes a local manifest with a `.bak` backup. Official host configuration paths and exact registration formats are adapter-contract concerns and must be refreshed before global installation.

## Native dogfood next step

After official host registration contracts are validated against the installed CLIs, configure isolated native Codex and Gemini sessions and run audit-only coding tasks. The next implementation slice should introduce structured finding/intervention contracts, freshness-aware verification state, bounded retry policy, and effective-capability evidence before broad enforcement. Inspect the resulting local trace/evidence through `chamber trace` and `chamber evidence` and compare intervention cohorts only after those contracts are stable.

Orca can be used to launch or interact with those sessions, but it is only an optional interaction surface: Chamber requires no Orca-specific integration contract and must receive host events directly through its native adapters.
