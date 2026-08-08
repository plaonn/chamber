# Schema contracts

## `chamber.event.v1`

Required fields: `event_id`, `occurred_at`, `session_id`, `lifecycle`, `host`, and `worker_profile`. `host` requires `runtime` and `adapter_revision`. `worker_profile` requires `host`, `agent_runtime`, `adapter_revision`, `policy_profile`, and `policy_revision`; model/version/config revisions may be `unknown` but must be represented. `worker_profile.native_controls` uses `chamber.native-controls.v1`: an adapter-owned, versioned allowlist of namespaced bounded scalar controls, or explicit `unknown` when controls are not observably available for the session. It never accepts arbitrary configuration or provider payload. Canonical event payload may contain ephemeral policy inputs (`prompt`, `completion_output`, command and tool-response fields), but those are not the persisted trace schema.

```json
{
  "schema_version": "chamber.event.v1",
  "session_id": "example-session",
  "lifecycle": "tool.after",
  "host": {"runtime": "codex", "version": "0.147.0", "adapter_revision": "codex-hook-v2"},
  "worker_profile": {"host": "codex", "agent_runtime": "codex-cli", "model": "unknown", "host_version": "0.147.0", "adapter_revision": "codex-hook-v2", "policy_profile": "audit-default", "policy_revision": "1", "config_revision": "unknown", "native_controls": {"schema_version": "chamber.native-controls.v1", "status": "unknown", "reason": "adapter-control-not-observed", "values": {}}},
  "payload": {"verification": {"classification": "recognized-check", "execution": "unknown", "source": "native-hook", "provenance": "codex.post-tool-use.output-only", "limitation": "exact-exit-status-unsupported"}},
  "vendor": {"hook_event_name": "PostToolUse"}
}
```

## `chamber.finding.v1`

`chamber.finding.v1` is the planned structured output of a deterministic detector or validator. It reports an observable condition, not free-form advice and not a generated repair plan.

Required fields:

- `schema_version`
- `finding_id`
- `session_id`
- `detected_at`
- `code`: bounded stable finding code such as `VERIFICATION_MISSING`
- `category`: `quality`, `safety`, `authority`, or another explicitly versioned category
- `basis`: normally `deterministic`; a future external semantic evaluator must identify a different basis and must not masquerade as deterministic evidence
- `detector_revision`
- `evidence`: bounded structured facts or canonical event references only

Example:

```json
{
  "schema_version": "chamber.finding.v1",
  "finding_id": "finding-123",
  "session_id": "session-123",
  "detected_at": "2026-08-08T00:00:00.000Z",
  "code": "VERIFICATION_MISSING",
  "category": "quality",
  "basis": "deterministic",
  "detector_revision": "verification-freshness-v1",
  "evidence": {
    "last_meaningful_mutation_event_id": "event-42",
    "successful_verification_after_mutation": false
  }
}
```

The persisted projection must not include raw prompts, completion text, command strings, tool output, or arbitrary semantic excerpts merely to justify a finding. Use canonical event identifiers and bounded classifications where possible.

## `chamber.intervention.v1`

`chamber.intervention.v1` records the policy-selected response to a finding. Chamber does not generate unrestricted correction prose; text-bearing interventions select a versioned fixed template and bounded parameters.

Initial intervention types:

- `observe`
- `inject_context`
- `retry_with_context`
- `block`
- `mutate`

Required fields:

- `schema_version`
- `intervention_id`
- `session_id`
- `finding_id`
- `policy_profile`
- `policy_revision`
- `type`
- `template_id` when the intervention returns text
- `parameters`: bounded template parameters, never arbitrary raw transcript content
- `required_capabilities`
- `effective_capabilities`
- `budget`: current use and configured limit for the finding/policy scope
- `result`: `planned`, `shadowed`, `applied`, `degraded`, `blocked`, or `budget_exhausted`

Example:

```json
{
  "schema_version": "chamber.intervention.v1",
  "intervention_id": "intervention-123",
  "session_id": "session-123",
  "finding_id": "finding-123",
  "policy_profile": "verification-correction",
  "policy_revision": "1",
  "type": "retry_with_context",
  "template_id": "verification-required-v1",
  "parameters": {"verification_state": "missing"},
  "required_capabilities": ["can_retry_finish"],
  "effective_capabilities": ["can_retry_finish"],
  "budget": {"used": 1, "limit": 1},
  "result": "applied"
}
```

`mutate` is intentionally narrow. A mutation may normalize a deterministic representation without changing strategy, authority, target selection, or semantic intent. If a correction requires a new decision, Chamber should return context to the native worker rather than silently make that decision itself.

## Derived trajectory state

Trajectory state is derived session state, not a replacement for canonical events. The initial reducer should be able to represent at least:

- `meaningful_mutation_since_verification`
- `last_verification_execution`
- `last_successful_verification_event_id`
- `last_meaningful_mutation_event_id`
- `consecutive_equivalent_failures`
- `completion_attempts`
- intervention counts keyed by finding/policy revision

Verification evidence is fresh only when it proves the relevant state after the latest meaningful mutation. A prior successful check must not satisfy a completion policy after later code-changing evidence invalidates that check.

Raw commands or diff bodies do not need to be persisted merely to preserve reducer state. The implementation should store only the bounded classifications and identifiers needed for deterministic replay or attribution.

## Capability evidence

Policy enforcement must distinguish:

- `native_capabilities`: supported by the installed runtime contract for the current event;
- `adapter_capabilities`: implemented by the current Chamber adapter revision;
- `runtime_verified_capabilities`: demonstrated by current native smoke or equivalent evidence;
- `effective_capabilities`: the supported intersection used by policy enforcement.

The serialized capability evidence records the bounded native, adapter, runtime-verified, and effective capability sets with the selected intervention. Runtime-verified capability is empty by default; enforcement must not infer it from host documentation or adapter intent alone.

## Current `chamber.quality-evidence.v1`

Contains `worker_profile`, `task_class`, execution `outcome`, deterministic verification count, total evidence count, freshness, probability (nullable), uncertainty, and schema/policy provenance. Probability must remain null rather than fabricated while the profile lacks enough evidence.

The accompanying `evaluation` object is `chamber.factorized-evaluation.v1`, not an estimator result. It records that exact worker provenance is available separately, the statistical unit is `session-task-outcome`, selected model/task/policy/native-control factors may be pooled, and an interaction or exact-combination cohort must be evidence-justified. A native control is a namespaced provider value, never a cross-provider semantic level.

The current implementation uses a single bounded outcome status (`accepted`, `rejected`, or `unknown`) and does not yet attribute individual interventions.

## Next quality-evidence revision requirements

Do not silently expand `chamber.quality-evidence.v1`. A later schema revision should add, at minimum:

- separate outcome axes:
  - execution: `completed|aborted|error`
  - verification: `passed|failed|unknown`
  - acceptance: `accepted|rejected|unknown`
- intervention provenance: policy profile/revision, finding code, intervention type, template revision, whether the intervention was shadowed/applied/degraded, and budget result
- cohort/provenance fields sufficient to compare baseline and candidate policies without conflating adapter, model, task-class, config, or policy revisions
- uncertainty suitable for the estimator actually used

It should continue to avoid transcripts and free-form reviewer feedback by default.

## `chamber.trace.v2`

The persisted trace is a safe projection, stamped `persistence_revision: "minimized-v2"` and `persistence.mode: "allowlist-minimized"`. It also records whether raw vendor storage was opted in and that redaction remains a defense-in-depth layer. It stores no prompt, final assistant output, command text, tool output, arbitrary tool input, or raw vendor payload by default. A tool record can retain only `{classification, execution, source, provenance, limitation}` for verification. It may retain only bounded `task_classification` `{value, revision, provenance}` and bounded outcome `{status, outcome_provenance}`. This boundary is intentional: raw data is an in-memory adapter/policy input, not ordinary local telemetry.

Finding/intervention records follow the same data-minimization rule: stable codes, revisions, bounded parameters, canonical event references, capability provenance, and result state are appropriate; prompts, generated text, raw tool output, and arbitrary vendor payload are not.
