import { EXECUTION_SCHEMA_VERSION } from './constants.js';

const MAX_EXECUTION_ID_LENGTH = 256;
const EXECUTION_ID_PATTERN = /^[^\s\u0000-\u001f\u007f]+$/;
const PROVENANCE_PATTERN = /^[a-z][a-z0-9._-]{0,63}$/;
const PRIVATE_PATH_PATTERN = /^(?:~(?:[\\/]|$)|\/(?:Users|home|private|var\/folders)(?:[\\/]|$)|[a-z]:[\\/]|file:(?:\/\/)?)/i;
const SECRET_PATTERN = /(?:bearer\s+|(?:^|[^a-z0-9])(?:sk|ghp|github_pat|xox[baprs])[-_][a-z0-9]|(?:^|[^a-z0-9])AIza[a-z0-9_-]+|(?:^|[^a-z0-9])-----begin [^-]+ private key-----|(?:api[_-]?key|access[_-]?token|secret|password)=)/i;

function bounded(value, name, { pattern, maxLength, rejectSecret = true } = {}) {
  if (typeof value !== 'string') throw new Error(`${name} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || !pattern.test(normalized)) throw new Error(`${name} is not bounded`);
  if (rejectSecret && (PRIVATE_PATH_PATTERN.test(normalized) || SECRET_PATTERN.test(normalized))) throw new Error(`${name} is not safe to persist`);
  return normalized;
}

export function normalizeExecution(input, { defaultProvenance = 'derived.v1' } = {}) {
  if (!input || typeof input !== 'object') throw new Error('execution must be an object');
  if (input.schema_version !== undefined && input.schema_version !== EXECUTION_SCHEMA_VERSION) throw new Error(`unsupported execution schema: ${input.schema_version}`);
  const executionId = bounded(input.execution_id ?? input.executionId, 'execution execution_id', {
    pattern: EXECUTION_ID_PATTERN, maxLength: MAX_EXECUTION_ID_LENGTH
  });
  const provenance = bounded(input.provenance ?? defaultProvenance, 'execution provenance', {
    pattern: PROVENANCE_PATTERN, maxLength: 64, rejectSecret: false
  });
  return { schema_version: EXECUTION_SCHEMA_VERSION, execution_id: executionId, provenance };
}

export function executionFromEnvironment(environment = process.env) {
  const executionId = environment.CHAMBER_EXECUTION_ID;
  if (executionId === undefined) return null;
  try {
    return normalizeExecution({ execution_id: executionId }, { defaultProvenance: 'hook.execution-context-v1' });
  } catch {
    return null;
  }
}

export function executionKey(execution) {
  return normalizeExecution(execution, { defaultProvenance: 'derived.v1' }).execution_id;
}

export function executionsFromEvents(events = []) {
  const found = [];
  for (const event of events) {
    if (!event?.payload?.execution) continue;
    try {
      const normalized = normalizeExecution(event.payload.execution, { defaultProvenance: 'derived.v1' });
      if (!found.some((existing) => executionKey(existing) === executionKey(normalized))) found.push(normalized);
    } catch {
      // Older or externally imported traces may contain no usable execution identity.
    }
  }
  return found;
}

export function executionMatches(execution, executionId) {
  try { return executionKey(execution) === executionId; } catch { return false; }
}
