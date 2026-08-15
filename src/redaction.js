const SENSITIVE_KEY = /(?:api[_-]?key|authorization|cookie|credential|password|secret|token|access[_-]?key|private[_-]?key)/i;
const SENSITIVE_VALUE = /(?:bearer\s+|(?:^|[^a-z0-9])(?:sk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9]|(?:^|[^a-z0-9])AIza[A-Za-z0-9_-])/i;

export function redact(value, key = '') {
  if (SENSITIVE_KEY.test(key)) return '[REDACTED]';
  if (typeof value === 'string') return SENSITIVE_VALUE.test(value) ? '[REDACTED]' : value;
  if (Array.isArray(value)) return value.map((entry) => redact(entry));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, redact(entryValue, entryKey)]));
  }
  return value;
}
