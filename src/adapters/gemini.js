import { createAdapter } from './base.js';
import { createEvent } from '../schema.js';

function lifecycle(name) {
  return ({ SessionStart: 'session.start', SessionEnd: 'session.end', BeforeTool: 'tool.before', AfterTool: 'tool.after', BeforeAgent: 'finish.before', AfterAgent: 'finish.after' })[name];
}

export const geminiAdapter = createAdapter({
  id: 'gemini', revision: 'gemini-hooks-v1',
  capabilityValues: { can_block: true, can_mutate_tool_args: true, can_inject_context: true, can_observe_model_io: false, can_retry_finish: false, can_modify_output: false },
  normalize(raw, context) {
    const mapped = lifecycle(raw.hook_event_name);
    if (!mapped) throw new Error(`unsupported Gemini hook event: ${raw.hook_event_name}`);
    const tool = raw.tool_name ?? raw.tool_input?.command;
    return createEvent({
      session_id: raw.session_id ?? context.session_id,
      lifecycle: mapped,
      host: { runtime: 'gemini-cli', version: raw.gemini_version ?? context.host_version ?? 'unknown', adapter_revision: 'gemini-hooks-v1' },
      worker_profile: context.worker_profile,
      payload: { tool_name: tool, command: raw.tool_input?.command, exit_code: raw.tool_response?.exit_code, output: raw.tool_response?.output },
      vendor: { hook_event_name: raw.hook_event_name, hook_event_id: raw.hook_event_id }
    });
  },
  response(decision) { return decision.action === 'deny' ? { decision: 'deny', reason: decision.decisions[0].reason } : { decision: 'allow' }; }
});
