export const NATIVE_CONTROL_PROVENANCE_VERSION = 'chamber.native-controls.v1';
export const FACTORIZED_EVALUATION_CONTRACT_VERSION = 'chamber.factorized-evaluation.v1';

const UNKNOWN = 'unknown';
const CONTROL_NAME = /^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+$/;

function boundedValue(value) {
  return (typeof value === 'string' && value.length <= 128) || typeof value === 'number' || typeof value === 'boolean';
}

export function unknownNativeControls(reason = 'not-observed') {
  return { schema_version: NATIVE_CONTROL_PROVENANCE_VERSION, status: UNKNOWN, reason, values: {} };
}

// Adapters call this only after applying their own versioned, quality-relevant allowlist.
export function nativeControlsFromAdapter(values, { revision, source }) {
  const controls = {};
  for (const [name, value] of Object.entries(values ?? {})) {
    if (!CONTROL_NAME.test(name) || !boundedValue(value)) throw new Error(`invalid native control: ${name}`);
    controls[name] = value;
  }
  if (Object.keys(controls).length && (!revision || !source)) throw new Error('observed native controls require mapping provenance');
  return {
    schema_version: NATIVE_CONTROL_PROVENANCE_VERSION,
    status: Object.keys(controls).length ? 'observed' : UNKNOWN,
    reason: Object.keys(controls).length ? undefined : 'not-observed',
    mapping_revision: revision,
    source,
    values: controls
  };
}

export function normalizedNativeControls(value) {
  if (!value) return unknownNativeControls();
  if (value.schema_version !== NATIVE_CONTROL_PROVENANCE_VERSION || !['observed', UNKNOWN].includes(value.status) || !value.values || typeof value.values !== 'object' || Array.isArray(value.values)) {
    throw new Error('invalid native control provenance');
  }
  const hasControls = Object.keys(value.values).length > 0;
  if ((value.status === 'observed') !== hasControls) throw new Error('native control status does not match values');
  return nativeControlsFromAdapter(value.values, { revision: value.mapping_revision, source: value.source });
}

export function factorizedEvaluation(workerProfile, taskClass) {
  const nativeControls = normalizedNativeControls(workerProfile.native_controls);
  return {
    contract_revision: FACTORIZED_EVALUATION_CONTRACT_VERSION,
    statistical_unit: 'session-task-outcome',
    observed_provenance: 'exact',
    estimator_basis: 'factorized-or-pooled',
    interaction_promotion: 'evidence-required',
    selected_factors: {
      model: workerProfile.model ?? UNKNOWN,
      task_class: taskClass ?? UNKNOWN,
      policy_profile: workerProfile.policy_profile ?? UNKNOWN,
      policy_revision: workerProfile.policy_revision ?? UNKNOWN,
      native_controls: nativeControls.values
    },
    native_control_provenance: nativeControls
  };
}
