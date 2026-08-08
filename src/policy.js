import { unsupported } from './capabilities.js';
import { isSuccessfulVerification } from './verification.js';

export const DEFAULT_POLICY_PROFILE = {
  id: 'audit-default',
  revision: '1',
  mode: 'audit',
  failure_semantics: 'fail-open',
  validators: ['completion-evidence'],
  mutators: []
};

export function completionEvidenceValidator(event, history) {
  if (event.lifecycle !== 'finish.before') return { verdict: 'allow', reason: 'not-applicable' };
  const text = String(event.payload.completion_output ?? '');
  if (!/\b(tests?\s+(passed|pass)|verified|verification succeeded)\b/i.test(text)) return { verdict: 'allow', reason: 'no-verification-claim' };
  const verified = history.some(isSuccessfulVerification);
  return verified
    ? { verdict: 'allow', reason: 'verification-evidence-present' }
    : { verdict: 'deny', reason: 'unsupported-completion-claim', required_capabilities: ['can_block'] };
}

export function evaluatePolicy(event, history, profile, hostCapabilities) {
  const validators = profile.validators.includes('completion-evidence') ? [completionEvidenceValidator] : [];
  const decisions = validators.map((validator) => validator(event, history));
  const deny = decisions.find((decision) => decision.verdict === 'deny');
  if (!deny) return { action: 'allow', mode: profile.mode, decisions, degraded: [] };
  const missing = unsupported(deny.required_capabilities ?? [], hostCapabilities);
  if (profile.mode !== 'enforce') return { action: 'audit', mode: profile.mode, decisions, degraded: ['audit-only'] };
  if (missing.length) return { action: 'audit', mode: profile.mode, decisions, degraded: missing };
  return { action: 'deny', mode: profile.mode, decisions, degraded: [] };
}

export function applyMutators(event, mutators = []) {
  return mutators.reduce((current, mutator) => mutator(current), event);
}
