const CHECK_COMMAND = /(?:^|\s)(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:test|check|lint|typecheck)|(?:^|\s)(?:pytest|vitest|jest|mocha|cargo\s+test|go\s+test|dotnet\s+test|mvn\s+test|gradle\s+test)\b/i;

export function verificationFromTool({ command, toolName, toolResponse } = {}) {
  const recognized = typeof command === 'string' && CHECK_COMMAND.test(command);
  if (!recognized) return { classification: 'unclassified', execution: 'unknown', provenance: 'none' };
  if (Number.isInteger(toolResponse?.exit_code)) {
    return {
      classification: 'recognized-check',
      execution: toolResponse.exit_code === 0 ? 'passed' : 'failed',
      provenance: 'host.tool_response.exit_code'
    };
  }
  return {
    classification: 'recognized-check',
    execution: 'unknown',
    provenance: toolName ? 'host.tool_response.without_exit_status' : 'missing-tool-response'
  };
}

export function isSuccessfulVerification(event) {
  return event.lifecycle === 'tool.after'
    && event.payload?.verification?.classification === 'recognized-check'
    && event.payload.verification.execution === 'passed';
}
