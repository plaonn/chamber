const CLASSIFICATION_REVISION = 'heuristic-v1';

function valueFor(text) {
  if (/\b(test|error|bug|fail|fix)\b/i.test(text)) return 'debugging';
  if (/\b(refactor|rename|migrate)\b/i.test(text)) return 'refactoring';
  if (/\b(implement|feature|build|create)\b/i.test(text)) return 'implementation';
  return 'unknown';
}

export function classifyEphemeralTask({ prompt, command } = {}) {
  const text = [prompt, command].filter((value) => typeof value === 'string').join('\n');
  return {
    value: valueFor(text), revision: CLASSIFICATION_REVISION,
    provenance: text ? 'ephemeral.prompt-and-command' : 'no-classifiable-input'
  };
}

export function persistedTaskClass(events) {
  const classifications = [...events].reverse().map((event) => event.payload?.task_classification).filter(Boolean);
  return classifications.find((classification) => classification.value !== 'unknown') ?? classifications[0] ?? {
    value: 'unknown', revision: CLASSIFICATION_REVISION, provenance: 'no-persisted-classification'
  };
}
