# ADR 0001: use append-only JSONL for the initial local trace store

Status: accepted

Chamber MVP needs no service dependency, deterministic query/export, inspectable schema provenance, and simple fixture tests. JSONL meets those needs with Node built-ins and preserves one redacted trace envelope per line. SQLite remains a compatible future storage adapter when indexed multi-session queries justify its operational cost. JSONL is not treated as an encrypted secret store; redaction is mandatory and operators must keep state directories local.
