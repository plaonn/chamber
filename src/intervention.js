import { CAPABILITY_KEYS } from './constants.js';

const limitFor = () => 1;
const enabled = (values = {}) => CAPABILITY_KEYS.filter((key) => values[key] === true);
const intersection = (...sets) => sets[0].filter((key) => sets.every((set) => set.includes(key)));

export function capabilityEvidence({ nativeCapabilities = {}, adapterCapabilities = {}, runtimeVerifiedCapabilities = {} } = {}) {
  const native_capabilities = enabled(nativeCapabilities);
  const adapter_capabilities = enabled(adapterCapabilities);
  const runtime_verified_capabilities = enabled(runtimeVerifiedCapabilities);
  return { native_capabilities, adapter_capabilities, runtime_verified_capabilities, effective_capabilities: intersection(native_capabilities, adapter_capabilities, runtime_verified_capabilities) };
}

export function selectVerificationIntervention({ finding, profile, capabilityEvidence: evidence, priorInterventions = [] }) {
  const matching = priorInterventions.filter((item) => item?.finding_code === finding.code && item?.policy_revision === profile.revision);
  const limit = limitFor(); const used = matching.length + 1;
  const base = {
    schema_version: 'chamber.intervention.v1', intervention_id: `verification-correction:${finding.session_id}:${finding.finding_id}`,
    session_id: finding.session_id, finding_id: finding.finding_id, finding_code: finding.code,
    policy_profile: profile.id, policy_revision: profile.revision, type: 'retry_with_context',
    template_id: 'verification-required-v1', parameters: { verification_state: 'missing' },
    required_capabilities: ['can_retry_finish'], effective_capabilities: evidence.effective_capabilities,
    capability_evidence: evidence, budget: { used, limit }
  };
  if (used > limit) return { ...base, result: 'budget_exhausted' };
  if (profile.mode !== 'enforce') return { ...base, result: 'shadowed' };
  if (!evidence.effective_capabilities.includes('can_retry_finish')) return { ...base, result: 'degraded' };
  return { ...base, result: 'applied' };
}
