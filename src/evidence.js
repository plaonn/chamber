import { QUALITY_EVIDENCE_SCHEMA_VERSION } from './constants.js';
import { isSuccessfulVerification } from './verification.js';
import { persistedTaskClass } from './task-classification.js';
import { factorizedEvaluation } from './effective-worker.js';

export function qualityEvidence(events, workerProfile) {
  const outcomes = events.filter((event) => event.lifecycle === 'outcome');
  const acceptance = outcomes.at(-1)?.payload.status ?? 'unknown';
  const verified = events.filter(isSuccessfulVerification).length;
  const taskClassification = persistedTaskClass(events);
  return {
    schema_version: QUALITY_EVIDENCE_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    worker_profile: workerProfile,
    task_class: taskClassification.value,
    // `outcome` is retained for v1 consumers; it is explicit acceptance only.
    outcome: acceptance,
    acceptance: { status: acceptance, provenance: outcomes.at(-1)?.payload.outcome_provenance ?? null },
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
    acceptance: sessionEvents.filter((event) => event.lifecycle === 'outcome').at(-1)?.payload?.status ?? 'unknown',
    verification: sessionEvents.some(isSuccessfulVerification) ? 'passed' : sessionEvents.some((event) => event.payload?.verification?.execution === 'failed') ? 'failed' : 'unknown',
    execution: sessionEvents.some((event) => event.lifecycle === 'finish.before' || event.lifecycle === 'finish.after') ? 'completed' : 'unknown',
    finding_codes: records.filter((record) => record.event?.session_id === sessionId).map((record) => record.policy_decision?.finding?.code).filter(Boolean),
    intervention_results: records.filter((record) => record.event?.session_id === sessionId).map((record) => record.policy_decision?.intervention?.result).filter(Boolean),
    degraded: records.filter((record) => record.event?.session_id === sessionId).flatMap((record) => record.policy_decision?.degraded ?? [])
  }));
  const flatten = (field) => sessions.flatMap((session) => session[field]);
  return {
    trace_records: records.length,
    distinct_session_count: sessions.length,
    session_task_sample_count: sessions.length,
    outcome_counts: count(sessions.map((session) => session.acceptance)),
    acceptance_counts: count(sessions.map((session) => session.acceptance)),
    acceptance_labeled_session_count: sessions.filter((session) => session.acceptance !== 'unknown').length,
    acceptance_unknown_session_count: sessions.filter((session) => session.acceptance === 'unknown').length,
    execution_session_counts: count(sessions.map((session) => session.execution)),
    verification_session_counts: count(sessions.map((session) => session.verification)),
    worker_session_counts: count(sessions.map((session) => session.worker_profile?.host ?? 'unknown')),
    task_class_session_counts: count(sessions.map((session) => session.task_class)),
    verification_event_counts: count(events.map((event) => event.payload?.verification?.execution ?? 'none')),
    finding_counts: count(flatten('finding_codes')),
    intervention_result_counts: count(flatten('intervention_results')),
    budget_exhaustion_count: flatten('intervention_results').filter((result) => result === 'budget_exhausted').length,
    capability_gap_counts: count(flatten('degraded')),
    recent_unlabeled_session_ids: sessions.filter((session) => session.acceptance === 'unknown').slice(-10).map((session) => session.session_id),
    success_probability: null,
    uncertainty: 'not_estimated_in_mvp'
  };
}
