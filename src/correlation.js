import { CORRELATION_SCHEMA_VERSION, OUTCOME_SOURCE_SCHEMA_VERSION } from './constants.js';

const MAX_SOURCE_KIND_LENGTH = 32;
const MAX_SOURCE_VALUE_LENGTH = 256;
const MAX_CORRELATIONS_PER_SESSION = 8;
const SOURCE_KIND_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;
const SOURCE_VALUE_PATTERN = /^[^\s\u0000-\u001f\u007f]+$/;
const PROVENANCE_PATTERN = /^[a-z][a-z0-9._-]{0,63}$/;
const PRIVATE_PATH_PATTERN = /^(?:~(?:[\\/]|$)|\/(?:Users|home|private|var\/folders)(?:[\\/]|$)|[a-z]:[\\/]|file:(?:\/\/)?)/i;
const SECRET_PATTERN = /(?:bearer\s+|(?:^|[^a-z0-9])(?:sk|ghp|github_pat|xox[baprs])[-_][a-z0-9]|(?:^|[^a-z0-9])AIza[a-z0-9_-]+|(?:^|[^a-z0-9])-----begin [^-]+ private key-----|(?:api[_-]?key|access[_-]?token|secret|password)=)/i;

export const MAX_SESSION_CORRELATIONS = MAX_CORRELATIONS_PER_SESSION;

const boundedValue = (value, name, { pattern = SOURCE_VALUE_PATTERN, maxLength = MAX_SOURCE_VALUE_LENGTH, rejectSecret = true } = {}) => {
  if (typeof value !== 'string') throw new Error(`${name} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || !pattern.test(normalized)) throw new Error(`${name} is not bounded`);
  if (rejectSecret && (PRIVATE_PATH_PATTERN.test(normalized) || SECRET_PATTERN.test(normalized))) throw new Error(`${name} is not safe to persist`);
  return normalized;
};

export function normalizeCorrelation(input, { defaultProvenance } = {}) {
  if (!input || typeof input !== 'object') throw new Error('correlation must be an object');
  if (input.schema_version !== undefined && input.schema_version !== CORRELATION_SCHEMA_VERSION) throw new Error(`unsupported correlation schema: ${input.schema_version}`);
  const sourceKindValue = input.source_kind ?? input.sourceKind;
  if (typeof sourceKindValue !== 'string') throw new Error('correlation source_kind must be a string');
  const sourceKind = boundedValue(sourceKindValue.toLowerCase(), 'correlation source_kind', {
    pattern: SOURCE_KIND_PATTERN, maxLength: MAX_SOURCE_KIND_LENGTH, rejectSecret: false
  }).toLowerCase();
  const sourceId = boundedValue(input.source_id ?? input.sourceId, 'correlation source_id');
  const sourceRevisionValue = input.source_revision ?? input.sourceRevision;
  const provenance = boundedValue(input.provenance ?? defaultProvenance, 'correlation provenance', {
    pattern: PROVENANCE_PATTERN, maxLength: 64, rejectSecret: false
  });
  const correlation = {
    schema_version: CORRELATION_SCHEMA_VERSION,
    source_kind: sourceKind,
    source_id: sourceId,
    provenance
  };
  if (sourceRevisionValue !== undefined && sourceRevisionValue !== null && sourceRevisionValue !== '') {
    correlation.source_revision = boundedValue(sourceRevisionValue, 'correlation source_revision');
  }
  return correlation;
}

export function correlationKey(correlation) {
  const normalized = normalizeCorrelation(correlation, { defaultProvenance: 'derived.v1' });
  return `${normalized.source_kind}\u0000${normalized.source_id}`;
}

export function sameCorrelation(left, right) {
  const a = normalizeCorrelation(left, { defaultProvenance: 'derived.v1' });
  const b = normalizeCorrelation(right, { defaultProvenance: 'derived.v1' });
  return a.source_kind === b.source_kind
    && a.source_id === b.source_id
    && (a.source_revision ?? null) === (b.source_revision ?? null);
}

export function correlationFromEnvironment(environment = process.env) {
  const sourceKind = environment.CHAMBER_CORRELATION_KIND;
  const sourceId = environment.CHAMBER_CORRELATION_ID;
  const sourceRevision = environment.CHAMBER_CORRELATION_REVISION;
  if (sourceKind === undefined && sourceId === undefined && sourceRevision === undefined) return null;
  if (sourceKind === undefined || sourceId === undefined) return null;
  try {
    return normalizeCorrelation({ source_kind: sourceKind, source_id: sourceId, source_revision: sourceRevision }, { defaultProvenance: 'hook.environment-v1' });
  } catch {
    return null;
  }
}

export function correlationsFromEvents(events = []) {
  const found = [];
  for (const event of events) {
    const candidates = [event?.payload?.correlation, event?.payload?.outcome_source?.correlation];
    for (const candidate of candidates) {
      if (!candidate) continue;
      try {
        const normalized = normalizeCorrelation(candidate, { defaultProvenance: 'derived.v1' });
        if (!found.some((existing) => sameCorrelation(existing, normalized))) found.push(normalized);
      } catch {
        // Older or externally imported traces may contain no usable correlation.
      }
    }
  }
  return found;
}

export function correlationMatches(correlation, { sourceKind, sourceId } = {}) {
  let normalized;
  try { normalized = normalizeCorrelation(correlation, { defaultProvenance: 'derived.v1' }); } catch { return false; }
  return (sourceKind === undefined || normalized.source_kind === String(sourceKind).trim().toLowerCase())
    && normalized.source_id === sourceId;
}

const PRODUCER_ALIASES = new Map([
  ['operator', 'operator'],
  ['user', 'user-approval'],
  ['user-approval', 'user-approval'],
  ['independent-verifier', 'independent-verifier'],
  ['external-verifier', 'independent-verifier'],
  ['benchmark', 'benchmark'],
  ['external-benchmark', 'benchmark'],
  ['oracle', 'oracle'],
  ['external-oracle', 'oracle'],
  ['controller', 'execution-controller'],
  ['execution-controller', 'execution-controller']
]);

export const OUTCOME_PRODUCERS = Object.freeze([...new Set(PRODUCER_ALIASES.values())]);

export function normalizeProducer(value = 'operator') {
  if (typeof value !== 'string' || !PRODUCER_ALIASES.has(value.trim().toLowerCase())) throw new Error(`outcome producer must be one of ${OUTCOME_PRODUCERS.join(', ')}`);
  return PRODUCER_ALIASES.get(value.trim().toLowerCase());
}

export function outcomeProvenance(producer) {
  return `${normalizeProducer(producer)}.explicit-v1`;
}

export function createOutcomeSource({ producer = 'operator', sourceKind, sourceId, sourceRevision } = {}) {
  const normalizedProducer = normalizeProducer(producer);
  if (sourceKind === undefined && sourceId === undefined && sourceRevision === undefined) return null;
  if (sourceKind === undefined || sourceId === undefined) throw new Error('outcome source requires --source-kind and --source-id');
  const correlation = normalizeCorrelation({ source_kind: sourceKind, source_id: sourceId, source_revision: sourceRevision }, { defaultProvenance: 'outcome.source-v1' });
  return {
    schema_version: OUTCOME_SOURCE_SCHEMA_VERSION,
    producer: normalizedProducer,
    provenance: outcomeProvenance(normalizedProducer),
    correlation
  };
}

export function normalizeOutcomeSource(input) {
  if (!input || typeof input !== 'object') throw new Error('outcome_source must be an object');
  if (input.schema_version !== undefined && input.schema_version !== OUTCOME_SOURCE_SCHEMA_VERSION) throw new Error(`unsupported outcome_source schema: ${input.schema_version}`);
  const producer = normalizeProducer(input.producer);
  const provenance = boundedValue(input.provenance, 'outcome_source provenance', { pattern: PROVENANCE_PATTERN, maxLength: 64, rejectSecret: false });
  const correlation = normalizeCorrelation(input.correlation, { defaultProvenance: 'outcome.source-v1' });
  return { schema_version: OUTCOME_SOURCE_SCHEMA_VERSION, producer, provenance, correlation };
}

export function sameOutcomeSource(left, right) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  try {
    const a = normalizeOutcomeSource(left);
    const b = normalizeOutcomeSource(right);
    return a.producer === b.producer && a.provenance === b.provenance && sameCorrelation(a.correlation, b.correlation);
  } catch {
    return false;
  }
}
