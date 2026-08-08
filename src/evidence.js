import { QUALITY_EVIDENCE_SCHEMA_VERSION } from './constants.js';
import { isSuccessfulVerification } from './verification.js';
import { persistedTaskClass } from './task-classification.js';
import { factorizedEvaluation } from './effective-worker.js';

export function qualityEvidence(events, workerProfile) {
  const outcomes = events.filter((event) => event.lifecycle === 'outcome');
  const verified = events.filter(isSuccessfulVerification).length;
  const taskClassification = persistedTaskClass(events);
  return {
    schema_version: QUALITY_EVIDENCE_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    worker_profile: workerProfile,
    task_class: taskClassification.value,
    outcome: outcomes.at(-1)?.payload.status ?? 'unknown',
    verification_evidence_count: verified,
    evidence_count: events.length,
    freshness: events.length ? 'current-session' : 'none',
    success_probability: null,
    uncertainty: events.length < 20 ? 'insufficient_evidence' : 'not_estimated_in_mvp',
    provenance: { event_schema: 'chamber.event.v1', policy_revision: workerProfile.policy_revision, task_classification: taskClassification },
    evaluation: factorizedEvaluation(workerProfile, taskClassification.value)
  };
}

export function evidenceSelection(records, sessionId) {
  const events = records.map((record) => record.event).filter(Boolean);
  if (sessionId) return qualityEvidence(events, events[0]?.worker_profile ?? { host: 'unknown', policy_revision: 'unknown' });
  const sessions = [...new Set(events.map((event) => event.session_id))];
  if (sessions.length > 1) return { status: 'selection_required', distinct_session_count: sessions.length, session_ids: sessions };
  return qualityEvidence(events, events[0]?.worker_profile ?? { host: 'unknown', policy_revision: 'unknown' });
}

export function traceSummary(records) {
  const events = records.map((record) => record.event).filter(Boolean);
  const count = (values) => Object.fromEntries([...values].sort().map((value) => [value, values.filter((item) => item === value).length]));
  const sessions = [...new Map(events.map((event) => [event.session_id, events.filter((candidate) => candidate.session_id === event.session_id)]))].map(([sessionId, sessionEvents]) => ({
    session_id: sessionId,
    worker_profile: sessionEvents.at(-1)?.worker_profile,
    task_class: persistedTaskClass(sessionEvents).value,
    outcome: sessionEvents.filter((event) => event.lifecycle === 'outcome').at(-1)?.payload?.status ?? 'unknown'
  }));
  return {
    trace_records: records.length,
    distinct_session_count: sessions.length,
    session_task_sample_count: sessions.length,
    outcome_counts: count(sessions.map((session) => session.outcome)),
    worker_session_counts: count(sessions.map((session) => session.worker_profile?.host ?? 'unknown')),
    task_class_session_counts: count(sessions.map((session) => session.task_class)),
    verification_event_counts: count(events.map((event) => event.payload?.verification?.execution ?? 'none')),
    success_probability: null,
    uncertainty: 'not_estimated_in_mvp'
  };
}
