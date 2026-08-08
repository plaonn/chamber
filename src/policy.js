import { unsupported } from './capabilities.js';
import { isSuccessfulVerification } from './verification.js';
import { reduceTrajectory, verificationFreshnessFinding } from './trajectory.js';
import { capabilityEvidence, selectVerificationIntervention } from './intervention.js';

export const DEFAULT_POLICY_PROFILE = {
  id: 'audit-default',
  revision: '1',
  mode: 'audit',
  failure_semantics: 'fail-open',
  validators: ['completion-evidence'],
  mutators: []
};

function eventsFrom(history) { return history.map((item) => item?.event ?? item).filter(Boolean); }
function priorInterventions(history) { return history.map((item) => item?.policy_decision?.intervention).filter(Boolean); }

export function completionEvidenceValidator(event, history) {
  if (event.lifecycle !== 'finish.before') return { verdict: 'allow', reason: 'not-applicable' };
  const text = String(event.payload.completion_output ?? '');
  if (!/\b(tests?\s+(passed|pass)|verified|verification succeeded)\b/i.test(text)) return { verdict: 'allow', reason: 'no-verification-claim' };
  const verified = history.some(isSuccessfulVerification);
  return verified
    ? { verdict: 'allow', reason: 'verification-evidence-present' }
    : { verdict: 'deny', reason: 'unsupported-completion-claim', required_capabilities: ['can_block'] };
}

export function evaluatePolicy(event, history, profile, hostCapabilities, options = {}) {
  const events = eventsFrom(history);
  const validators = profile.validators.includes('completion-evidence') ? [completionEvidenceValidator] : [];
  const decisions = validators.map((validator) => validator(event, events));
  const trajectory = reduceTrajectory([...events, event]);
  const finding = verificationFreshnessFinding(event, trajectory);
  const evidence = capabilityEvidence({
    nativeCapabilities: hostCapabilities,
    adapterCapabilities: options.adapterCapabilities ?? hostCapabilities,
    runtimeVerifiedCapabilities: options.runtimeVerifiedCapabilities ?? {}
  });
  const intervention = finding ? selectVerificationIntervention({ finding, profile, capabilityEvidence: evidence, priorInterventions: priorInterventions(history) }) : null;
  const deny = decisions.find((decision) => decision.verdict === 'deny');
  if (!deny && !intervention) return { action: 'allow', mode: profile.mode, decisions, degraded: [], trajectory };
  if (!deny && intervention) return { action: intervention.result === 'applied' ? 'deny' : 'audit', mode: profile.mode, decisions, finding, intervention, trajectory, degraded: intervention.result === 'degraded' ? ['runtime-capability-unverified'] : [] };
  const missing = unsupported(deny.required_capabilities ?? [], hostCapabilities);
  if (profile.mode !== 'enforce') return { action: 'audit', mode: profile.mode, decisions, finding, intervention, trajectory, degraded: ['audit-only'] };
  if (missing.length) return { action: 'audit', mode: profile.mode, decisions, finding, intervention, trajectory, degraded: missing };
  return { action: 'deny', mode: profile.mode, decisions, finding, intervention, trajectory, degraded: [] };
}

export function applyMutators(event, mutators = []) {
  return mutators.reduce((current, mutator) => mutator(current), event);
}
