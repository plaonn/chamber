import { QUALITY_EVIDENCE_SCHEMA_VERSION } from './constants.js';
import { isSuccessfulVerification } from './verification.js';

export function classifyTask(events) {
  const text = events.map((event) => JSON.stringify(event.payload)).join(' ').toLowerCase();
  if (/test|error|bug|fail/.test(text)) return 'debugging';
  if (/refactor|rename|migrate/.test(text)) return 'refactoring';
  if (/implement|feature|build/.test(text)) return 'implementation';
  return 'unknown';
}

export function qualityEvidence(events, workerProfile) {
  const outcomes = events.filter((event) => event.lifecycle === 'outcome');
  const verified = events.filter(isSuccessfulVerification).length;
  return {
    schema_version: QUALITY_EVIDENCE_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    worker_profile: workerProfile,
    task_class: classifyTask(events),
    outcome: outcomes.at(-1)?.payload.status ?? 'unknown',
    verification_evidence_count: verified,
    evidence_count: events.length,
    freshness: events.length ? 'current-session' : 'none',
    success_probability: null,
    uncertainty: events.length < 20 ? 'insufficient_evidence' : 'not_estimated_in_mvp',
    provenance: { event_schema: 'chamber.event.v1', policy_revision: workerProfile.policy_revision }
  };
}
