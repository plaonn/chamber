# ADR 0001: use append-only JSONL for the initial local trace store

Status: amended

Chamber MVP needs no service dependency, deterministic query/export, inspectable schema provenance, and simple fixture tests. JSONL meets those needs with Node built-ins. The first revision stored a redacted raw envelope; this was replaced by the `minimized-v2` persistence projection after recognizing that prompts, commands, tool outputs, and unknown vendor fields can carry credentials despite regex redaction. Raw native payload is now ephemeral by default. Explicit debug raw recording is opt-in and still redacted, but is not a replacement for a dedicated encrypted debugging surface. SQLite remains a compatible future storage adapter when indexed multi-session queries justify its operational cost.
