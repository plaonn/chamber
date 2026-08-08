import { randomUUID } from 'node:crypto';
import { EVENT_SCHEMA_VERSION, LIFECYCLES } from './constants.js';
import { redact } from './redaction.js';

export class SchemaError extends Error {}

export function createEvent(input) {
  const event = {
    schema_version: input.schema_version ?? EVENT_SCHEMA_VERSION,
    event_id: input.event_id ?? randomUUID(),
    occurred_at: input.occurred_at ?? new Date().toISOString(),
    session_id: input.session_id,
    lifecycle: input.lifecycle,
    host: input.host,
    worker_profile: input.worker_profile,
    payload: redact(input.payload ?? {}),
    vendor: redact(input.vendor ?? {})
  };
  validateEvent(event);
  return event;
}

export function validateEvent(event) {
  if (event.schema_version !== EVENT_SCHEMA_VERSION) throw new SchemaError(`unsupported event schema: ${event.schema_version}`);
  for (const key of ['event_id', 'occurred_at', 'session_id', 'lifecycle', 'host', 'worker_profile']) {
    if (!event[key]) throw new SchemaError(`event missing ${key}`);
  }
  if (!LIFECYCLES.has(event.lifecycle)) throw new SchemaError(`unsupported lifecycle: ${event.lifecycle}`);
  for (const key of ['runtime', 'adapter_revision']) if (!event.host[key]) throw new SchemaError(`host missing ${key}`);
  for (const key of ['host', 'agent_runtime', 'adapter_revision', 'policy_profile', 'policy_revision']) {
    if (!event.worker_profile[key]) throw new SchemaError(`worker_profile missing ${key}`);
  }
  return event;
}
