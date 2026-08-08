import { createAdapter } from './base.js';
import { createEvent } from '../schema.js';

function lifecycle(name) {
  return ({ SessionStart: 'session.start', UserPromptSubmit: 'prompt.submit', PreToolUse: 'tool.before', PostToolUse: 'tool.after', Stop: 'finish.before', SessionEnd: 'session.end' })[name];
}

export const codexAdapter = createAdapter({
  id: 'codex', revision: 'codex-hook-v1',
  capabilityValues: { can_block: true, can_mutate_tool_args: false, can_inject_context: false, can_observe_model_io: false, can_retry_finish: false, can_modify_output: false },
  normalize(raw, context) {
    const mapped = lifecycle(raw.hook_event_name);
    if (!mapped) throw new Error(`unsupported Codex hook event: ${raw.hook_event_name}`);
    return createEvent({
      session_id: raw.session_id ?? context.session_id,
      lifecycle: mapped,
      host: { runtime: 'codex', version: raw.codex_version ?? context.host_version ?? 'unknown', adapter_revision: 'codex-hook-v1' },
      worker_profile: context.worker_profile,
      payload: { tool_name: raw.tool_name, command: raw.tool_input?.command, exit_code: raw.tool_response?.exit_code, output: raw.tool_response?.output },
      vendor: { hook_event_name: raw.hook_event_name, hook_event_id: raw.hook_event_id, tool_use_id: raw.tool_use_id }
    });
  },
  response(decision) { return decision.action === 'deny' ? { decision: 'deny', reason: decision.decisions[0].reason } : { decision: 'allow' }; }
});
