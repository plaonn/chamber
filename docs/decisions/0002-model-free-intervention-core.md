# ADR 0002: keep the Chamber intervention core model-free

Status: accepted

## Context

Chamber needs to improve the reliability of native AI coding workers without replacing their agent loops. The tempting design is to add another LLM inside Chamber as a supervisor that reads the trajectory, generates critique, and tells the worker what to do next. That would make Chamber depend on another model, duplicate reasoning already owned by the native worker, complicate attribution, and blur the boundary between a policy/evaluation layer and a second agent runtime.

Coding agents already expose useful structured signals: lifecycle events, tool calls, execution status, verification results, mutation boundaries, repeated failures, completion attempts, and explicit acceptance outcomes. Many high-value failure patterns can therefore be detected by ordinary deterministic logic.

## Decision

Chamber core remains model-free.

The core uses deterministic reducers, detectors/validators, policy tables, bounded intervention primitives, fixed versioned correction templates, and ordinary statistical estimation. The correction loop is:

```text
canonical event
  -> trajectory state
  -> structured finding
  -> policy-selected bounded intervention
  -> native host response
  -> native worker reasons again
```

Chamber does not generate an open-ended repair plan for the worker. A detector reports an observable condition. Policy chooses a predefined intervention such as observe, inject context, retry with context, block, or narrowly mutate. Text-bearing interventions use fixed versioned templates and bounded parameters.

The native worker remains responsible for semantic reasoning and for choosing the next coding action after receiving correction feedback.

## Deterministic scope

Examples of core-suitable findings include:

- completion claims without fresh verification evidence;
- a failed verification followed by an unsupported success claim;
- meaningful mutation after the last successful verification;
- repeated equivalent failed actions or stagnation;
- deterministic path, authority, or destructive-operation guards;
- machine-checkable contract or schema violations.

These findings may be enforced when the required effective capability is implemented and verified for the current native runtime.

## Semantic scope

Judgments such as architectural overengineering, subtle requirement misunderstanding, or whether a design is conceptually elegant are not generally derivable from structured execution state alone.

If a future use case needs semantic evaluation, it may use an optional external evaluator. That evaluator must:

- remain outside the Chamber core;
- emit a structured finding with explicit non-deterministic/semantic provenance;
- not masquerade as deterministic evidence;
- default to advisory, audit, or shadow use until independently validated;
- not create a required dependency for ordinary Chamber operation.

The external evaluator may itself be an LLM, a human review process, a benchmark oracle, or another service. Chamber consumes the bounded finding; it does not become that evaluator.

## Policy learning

Model-free does not mean static. Chamber can learn which predefined policy works better from outcomes using ordinary statistics.

Candidate policy revisions should move through audit, shadow, bounded canary, comparison, and promote/retire stages. Evidence is conditioned on the effective worker profile, task class, adapter/config/policy revisions, and intervention provenance. Success probability or other estimates may use simple rates, Bayesian methods, regression, or contextual-bandit techniques when justified by data.

This learning chooses among policy/intervention variants; it does not train or modify native model weights.

## Safety and loop control

Every intervention that can trigger additional native work needs a bounded budget. Quality corrections normally degrade or fail open when reliable capability is unavailable or their budget is exhausted; hard safety/authority policies may fail closed when their explicit contract requires it.

Automatic mutation remains narrow and deterministic. Chamber must not silently change strategy, authority, target, or semantic intent merely because the host supports tool-argument mutation. Decisions of that kind are returned to the native worker for reconsideration.

## Consequences

Benefits:

- Chamber remains portable across native runtimes and usable without another model provider.
- Corrections are deterministic, testable, versionable, and attributable.
- Outcome improvements can be measured against concrete policy revisions.
- Native agent reasoning is reused instead of duplicated.
- The project avoids becoming a second orchestrator or opaque AI supervisor.

Costs and limits:

- Chamber cannot independently understand every semantic failure.
- High-level qualitative review needs external evidence or an optional evaluator.
- Useful correction templates and detectors must be designed and tested deliberately.
- Runtime capability verification becomes important because policy cannot assume a host response path works merely from documentation.

## Revisit conditions

Reconsider this decision only if real dogfood shows that a high-value class of failures cannot be addressed with deterministic evidence, native-worker self-correction, external validation, or optional advisory evaluators, and that embedding a model in the core provides material benefit that cannot be obtained while preserving the current boundary.
