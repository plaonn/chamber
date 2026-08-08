const CHECK_COMMAND = /(?:^|\s)(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:test|check|lint|typecheck)|(?:^|\s)(?:pytest|vitest|jest|mocha|cargo\s+test|go\s+test|dotnet\s+test|mvn\s+test|gradle\s+test)\b/i;

export function checkClassification(command) {
  return typeof command === 'string' && CHECK_COMMAND.test(command) ? 'recognized-check' : 'unclassified';
}

export function unknownVerification(command, provenance, limitation) {
  return {
    classification: checkClassification(command), execution: 'unknown', source: 'native-hook', provenance, limitation
  };
}

export function codexPostToolVerification({ command, toolName } = {}) {
  if (checkClassification(command) !== 'recognized-check') return unknownVerification(command, 'none');
  return unknownVerification(command, 'codex.post-tool-use.output-only', toolName === 'Bash'
    ? 'exact-exit-status-unsupported'
    : 'non-shell-or-exit-status-unsupported');
}

function textContains(value, expression) {
  return typeof value === 'string' && expression.test(value);
}

export function geminiAfterToolVerification({ command, toolName, toolInput, toolResponse } = {}) {
  if (checkClassification(command) !== 'recognized-check') return unknownVerification(command, 'none');
  if (toolName !== 'run_shell_command') return unknownVerification(command, 'gemini.after-tool.non-shell', 'non-shell-tool');
  if (!toolResponse || typeof toolResponse !== 'object') return unknownVerification(command, 'gemini.after-tool.missing-tool-result', 'tool-result-unavailable');

  const data = toolResponse.data;
  const cancelled = textContains(toolResponse.llmContent, /\bcancelled\b/i) || textContains(toolResponse.returnDisplay, /\bcancelled\b/i);
  const signalled = textContains(toolResponse.llmContent, /\bsignal:\s*\S+/i) || textContains(toolResponse.returnDisplay, /\bterminated by signal\b/i);
  const background = toolInput?.is_background === true || (data && typeof data === 'object' && Number.isInteger(data.pid));
  if (cancelled) return unknownVerification(command, 'gemini.shell.tool-result.cancelled', 'cancelled');
  if (signalled) return { classification: 'recognized-check', execution: 'failed', source: 'native-hook', provenance: 'gemini.shell.tool-result.signal' };
  if (background) return unknownVerification(command, 'gemini.shell.tool-result.background', 'background-or-incomplete');
  if (toolResponse.error || data?.isError === true || (Number.isInteger(data?.exitCode) && data.exitCode !== 0)) {
    return { classification: 'recognized-check', execution: 'failed', source: 'native-hook', provenance: 'gemini.shell.tool-result.error-or-nonzero' };
  }
  if (data !== undefined || typeof toolResponse.llmContent !== 'string' || typeof toolResponse.returnDisplay !== 'string') {
    return unknownVerification(command, 'gemini.shell.tool-result.ambiguous', 'ambiguous-tool-result');
  }
  return { classification: 'recognized-check', execution: 'passed', source: 'native-hook', provenance: 'gemini.shell.tool-result.implicit-zero' };
}

export function isSuccessfulVerification(event) {
  return event.lifecycle === 'tool.after'
    && event.payload?.verification?.classification === 'recognized-check'
    && event.payload.verification.execution === 'passed';
}
