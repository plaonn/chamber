import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TRACE_PERSISTENCE_REVISION, TRACE_SCHEMA_VERSION } from './constants.js';
import { redact } from './redaction.js';

function persistedEvent(event) {
  const verification = event.payload?.verification;
  return {
    schema_version: event.schema_version,
    event_id: event.event_id,
    occurred_at: event.occurred_at,
    session_id: event.session_id,
    lifecycle: event.lifecycle,
    host: event.host,
    worker_profile: event.worker_profile,
    payload: {
      tool_name: event.payload?.tool_name,
      stop_hook_active: event.payload?.stop_hook_active,
      verification: verification ? {
        classification: verification.classification,
        execution: verification.execution,
        source: verification.source,
        provenance: verification.provenance,
        limitation: verification.limitation
      } : undefined,
      task_classification: event.payload?.task_classification,
      status: event.payload?.status,
      outcome_provenance: event.payload?.outcome_provenance
    },
    vendor: { hook_event_name: event.vendor?.hook_event_name }
  };
}

export class TraceStore {
  constructor(stateDir = '.chamber', { recordRawVendor = false } = {}) {
    this.stateDir = stateDir; this.file = join(stateDir, 'trace.jsonl'); this.recordRawVendor = recordRawVendor;
  }
  async append(record, { recordRawVendor = this.recordRawVendor } = {}) {
    await mkdir(this.stateDir, { recursive: true });
    const envelope = {
      trace_schema_version: TRACE_SCHEMA_VERSION,
      persistence_revision: TRACE_PERSISTENCE_REVISION,
      persistence: { mode: 'allowlist-minimized', raw_vendor_recorded: recordRawVendor, redaction: 'defense-in-depth' },
      recorded_at: new Date().toISOString(),
      kind: record.kind,
      event: persistedEvent(record.event),
      policy_decision: record.policy_decision
    };
    if (recordRawVendor && record.raw_vendor_event) envelope.raw_vendor_event = redact(record.raw_vendor_event);
    await appendFile(this.file, `${JSON.stringify(envelope)}\n`, 'utf8');
    return envelope;
  }
  async query({ sessionId, limit = 100 } = {}) {
    try {
      const lines = (await readFile(this.file, 'utf8')).trim().split('\n').filter(Boolean);
      const records = lines.map((line) => JSON.parse(line)).filter((record) => !sessionId || record.event?.session_id === sessionId);
      return records.slice(-limit);
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }
}
