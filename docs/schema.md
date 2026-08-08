# Schema contracts

## `chamber.event.v1`

Required fields: `event_id`, `occurred_at`, `session_id`, `lifecycle`, `host`, and `worker_profile`. `host` requires `runtime` and `adapter_revision`. `worker_profile` requires `host`, `agent_runtime`, `adapter_revision`, `policy_profile`, and `policy_revision`; model/version/config revisions may be `unknown` but must be represented.

```json
{
  "schema_version": "chamber.event.v1",
  "session_id": "example-session",
  "lifecycle": "tool.after",
  "host": {"runtime": "codex", "version": "0.147.0", "adapter_revision": "codex-hook-v1"},
  "worker_profile": {"host": "codex", "agent_runtime": "codex-cli", "model": "unknown", "host_version": "0.147.0", "adapter_revision": "codex-hook-v1", "policy_profile": "audit-default", "policy_revision": "1", "config_revision": "unknown"},
  "payload": {"command": "pnpm test", "exit_code": 0},
  "vendor": {"raw_type": "tool.after"}
}
```

## `chamber.quality-evidence.v1`

Contains `worker_profile`, `task_class`, execution `outcome`, deterministic verification count, total evidence count, freshness, probability (nullable), uncertainty, and schema/policy provenance. Probability must remain null rather than fabricated while the profile lacks enough evidence.
