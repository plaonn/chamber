import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TRACE_PERSISTENCE_REVISION, TRACE_SCHEMA_VERSION } from './constants.js';
import { redact } from './redaction.js';
import { normalizeCorrelation, normalizeOutcomeSource } from './correlation.js';
import { normalizeExecution } from './execution.js';

function safeCorrelation(value) {
  if (!value) return undefined;
  try { return normalizeCorrelation(value, { defaultProvenance: 'derived.v1' }); } catch { return undefined; }
}

function safeOutcomeSource(value) {
  if (!value) return undefined;
  try { return normalizeOutcomeSource(value); } catch { return undefined; }
}

function safeExecution(value) {
  if (!value) return undefined;
  try { return normalizeExecution(value, { defaultProvenance: 'derived.v1' }); } catch { return undefined; }
}

function persistedEvent(event) {
  const verification = event.payload?.verification;
  const correlation = safeCorrelation(event.payload?.correlation);
  const outcomeSource = safeOutcomeSource(event.payload?.outcome_source);
  const execution = safeExecution(event.payload?.execution);
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
      mutation: event.payload?.mutation ? {
        classification: event.payload.mutation.classification,
        provenance: event.payload.mutation.provenance
      } : undefined,
      task_classification: event.payload?.task_classification,
      status: event.payload?.status,
      outcome_provenance: event.payload?.outcome_provenance,
      correlation,
      outcome_source: outcomeSource,
      execution
    },
    vendor: { hook_event_name: event.vendor?.hook_event_name }
  };
}

function persistedDecision(decision = {}) {
  const finding = decision.finding;
  const intervention = decision.intervention;
  return {
    action: decision.action,
    mode: decision.mode,
    degraded: decision.degraded,
    finding: finding ? {
      schema_version: finding.schema_version, finding_id: finding.finding_id, session_id: finding.session_id,
      detected_at: finding.detected_at, code: finding.code, category: finding.category, basis: finding.basis,
      detector_revision: finding.detector_revision, evidence: finding.evidence
    } : undefined,
    intervention: intervention ? {
      schema_version: intervention.schema_version, intervention_id: intervention.intervention_id, session_id: intervention.session_id,
      finding_id: intervention.finding_id, finding_code: intervention.finding_code, policy_profile: intervention.policy_profile,
      policy_revision: intervention.policy_revision, type: intervention.type, template_id: intervention.template_id,
      parameters: intervention.parameters, required_capabilities: intervention.required_capabilities,
      effective_capabilities: intervention.effective_capabilities, capability_evidence: intervention.capability_evidence,
      budget: intervention.budget, result: intervention.result
    } : undefined
  };
}

export class TraceStore {
  constructor(stateDir, { recordRawVendor = false } = {}) {
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
      policy_decision: persistedDecision(record.policy_decision)
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
  async migrateFrom(sourceDir) {
    const sourceFile = join(sourceDir, 'trace.jsonl');
    let sourceRecords;
    try {
      sourceRecords = (await readFile(sourceFile, 'utf8')).trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
    } catch (error) {
      if (error.code === 'ENOENT') return { source_records: 0, imported_records: 0, duplicate_records: 0, distinct_sessions: 0 };
      throw new Error(`cannot safely read migration source: ${error.message}`);
    }
    for (const record of sourceRecords) {
      if (!record?.event?.event_id || record.persistence?.mode !== 'allowlist-minimized' || record.persistence?.raw_vendor_recorded) {
        throw new Error('cannot safely migrate a record without minimized event identity');
      }
    }
    const existing = await this.query({ limit: Infinity });
    const known = new Set(existing.map((record) => record.event?.event_id).filter(Boolean));
    const importable = sourceRecords.filter((record) => !known.has(record.event.event_id));
    if (importable.length) {
      await mkdir(this.stateDir, { recursive: true });
      await appendFile(this.file, `${importable.map((record) => JSON.stringify(record)).join('\n')}\n`, 'utf8');
    }
    const all = [...existing, ...importable];
    return {
      source_records: sourceRecords.length,
      imported_records: importable.length,
      duplicate_records: sourceRecords.length - importable.length,
      destination_records: all.length,
      distinct_sessions: new Set(all.map((record) => record.event?.session_id).filter(Boolean)).size
    };
  }
}
