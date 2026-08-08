import { createAdapter } from './base.js';
import { createEvent } from '../schema.js';
import { capabilities } from '../capabilities.js';
import { geminiAfterToolVerification } from '../verification.js';
import { classifyEphemeralTask } from '../task-classification.js';

function lifecycle(name) {
  return ({ SessionStart: 'session.start', SessionEnd: 'session.end', BeforeTool: 'tool.before', AfterTool: 'tool.after', BeforeAgent: 'prompt.submit', AfterAgent: 'finish.before', BeforeModel: 'model.before', AfterModel: 'model.after' })[name];
}

export const geminiAdapter = createAdapter({
  id: 'gemini', revision: 'gemini-hooks-v2',
  capabilityValues: {},
  eventCapabilities: {
    BeforeAgent: ['can_block', 'can_inject_context'], AfterAgent: ['can_block', 'can_retry_finish'],
    BeforeTool: ['can_block', 'can_mutate_tool_args'], AfterTool: ['can_block', 'can_inject_context', 'can_modify_output'],
    BeforeModel: ['can_block', 'can_observe_model_io'], AfterModel: ['can_block', 'can_observe_model_io', 'can_modify_output']
  },
  capabilitiesFor(event) {
    const name = event.vendor?.hook_event_name;
    return capabilities({
      can_block: ['BeforeAgent', 'AfterAgent', 'BeforeModel', 'AfterModel', 'BeforeTool', 'AfterTool'].includes(name),
      can_mutate_tool_args: name === 'BeforeTool',
      can_inject_context: ['SessionStart', 'BeforeAgent', 'AfterTool'].includes(name),
      can_observe_model_io: ['BeforeModel', 'AfterModel'].includes(name),
      can_retry_finish: name === 'AfterAgent',
      can_modify_output: ['AfterTool', 'AfterModel'].includes(name)
    });
  },
  normalize(raw, context) {
    const mapped = lifecycle(raw.hook_event_name);
    if (!mapped) throw new Error(`unsupported Gemini hook event: ${raw.hook_event_name}`);
    const tool = raw.tool_name ?? raw.tool_input?.command;
    return createEvent({
      session_id: raw.session_id ?? context.session_id,
      lifecycle: mapped,
      host: { runtime: 'gemini-cli', version: raw.gemini_version ?? context.host_version ?? '0.37.2', adapter_revision: 'gemini-hooks-v2' },
      worker_profile: context.worker_profile,
      payload: {
        prompt: raw.prompt,
        completion_output: raw.prompt_response,
        stop_hook_active: raw.stop_hook_active,
        tool_name: tool,
        command: raw.tool_input?.command,
        tool_response: raw.tool_response,
        verification: geminiAfterToolVerification({ command: raw.tool_input?.command, toolName: tool, toolInput: raw.tool_input, toolResponse: raw.tool_response }),
        task_classification: classifyEphemeralTask({ prompt: raw.prompt, command: raw.tool_input?.command })
      },
      vendor: { hook_event_name: raw.hook_event_name }
    });
  },
  response(decision) {
    const reason = decision.decisions?.find((item) => item.verdict === 'deny')?.reason;
    return decision.action === 'deny' ? { decision: 'deny', reason } : { decision: 'allow' };
  }
});
