import { isSuccessfulVerification } from './verification.js';

export const TRAJECTORY_REVISION = 'verification-freshness-v1';

function mutation(event) {
  return event.payload?.mutation?.classification === 'meaningful';
}

export function reduceTrajectory(events = []) {
  const state = {
    revision: TRAJECTORY_REVISION,
    meaningful_mutation_since_verification: false,
    last_meaningful_mutation_event_id: null,
    last_successful_verification_event_id: null,
    last_verification_execution: 'unknown',
    completion_attempts: 0
  };
  for (const event of events) {
    if (mutation(event)) {
      state.meaningful_mutation_since_verification = true;
      state.last_meaningful_mutation_event_id = event.event_id;
    }
    if (event.lifecycle === 'tool.after' && event.payload?.verification) state.last_verification_execution = event.payload.verification.execution;
    if (isSuccessfulVerification(event)) {
      state.last_successful_verification_event_id = event.event_id;
      state.meaningful_mutation_since_verification = false;
    }
    if (event.lifecycle === 'finish.before') state.completion_attempts += 1;
  }
  return state;
}

export function verificationFreshnessFinding(event, trajectory) {
  if (event.lifecycle !== 'finish.before' || !trajectory.meaningful_mutation_since_verification) return null;
  return {
    schema_version: 'chamber.finding.v1',
    finding_id: `verification-missing:${event.session_id}:${event.event_id}`,
    session_id: event.session_id,
    detected_at: event.occurred_at,
    code: 'VERIFICATION_MISSING',
    category: 'quality',
    basis: 'deterministic',
    detector_revision: TRAJECTORY_REVISION,
    evidence: {
      last_meaningful_mutation_event_id: trajectory.last_meaningful_mutation_event_id,
      successful_verification_after_mutation: false,
      last_verification_execution: trajectory.last_verification_execution
    }
  };
}
