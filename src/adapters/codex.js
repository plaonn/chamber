import { createAdapter } from './base.js';
import { createEvent } from '../schema.js';
import { capabilities } from '../capabilities.js';
import { codexPostToolVerification } from '../verification.js';
import { classifyEphemeralTask } from '../task-classification.js';
import { unknownNativeControls } from '../effective-worker.js';
import { classifyMutation } from '../mutation.js';

function lifecycle(name) {
  return ({ SessionStart: 'session.start', UserPromptSubmit: 'prompt.submit', PreToolUse: 'tool.before', PostToolUse: 'tool.after', Stop: 'finish.before', SessionEnd: 'session.end' })[name];
}

export const codexAdapter = createAdapter({
  id: 'codex', revision: 'codex-hook-v2',
  capabilityValues: {},
  eventCapabilities: {
    SessionStart: ['can_inject_context'], UserPromptSubmit: ['can_block', 'can_inject_context'],
    PreToolUse: ['can_block', 'can_mutate_tool_args', 'can_inject_context'],
    PostToolUse: ['can_inject_context', 'can_modify_output'], Stop: ['can_block', 'can_retry_finish']
  },
  capabilitiesFor(event) {
    return capabilities({
      can_block: ['UserPromptSubmit', 'PreToolUse', 'Stop'].includes(event.vendor?.hook_event_name),
      can_mutate_tool_args: event.vendor?.hook_event_name === 'PreToolUse',
      can_inject_context: ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse'].includes(event.vendor?.hook_event_name),
      can_observe_model_io: false,
      can_retry_finish: event.vendor?.hook_event_name === 'Stop',
      can_modify_output: event.vendor?.hook_event_name === 'PostToolUse'
    });
  },
  normalize(raw, context) {
    const mapped = lifecycle(raw.hook_event_name);
    if (!mapped) throw new Error(`unsupported Codex hook event: ${raw.hook_event_name}`);
    return createEvent({
      session_id: raw.session_id ?? context.session_id,
      lifecycle: mapped,
      host: { runtime: 'codex', version: raw.codex_version ?? context.host_version ?? '0.147.0', adapter_revision: 'codex-hook-v2' },
      worker_profile: { ...context.worker_profile, native_controls: context.worker_profile.native_controls ?? unknownNativeControls('adapter-control-not-observed') },
      payload: {
        prompt: raw.prompt,
        completion_output: raw.last_assistant_message,
        stop_hook_active: raw.stop_hook_active,
        tool_name: raw.tool_name,
        command: raw.tool_input?.command,
        tool_response: raw.tool_response,
        verification: codexPostToolVerification({ command: raw.tool_input?.command, toolName: raw.tool_name }),
        mutation: classifyMutation({ lifecycle: mapped, toolName: raw.tool_name }),
        task_classification: classifyEphemeralTask({ prompt: raw.prompt, command: raw.tool_input?.command })
      },
      vendor: { hook_event_name: raw.hook_event_name, tool_use_id: raw.tool_use_id }
    });
  },
  response(decision, event) {
    const reason = decision.decisions?.find((item) => item.verdict === 'deny')?.reason;
    const name = event.vendor?.hook_event_name;
    if (decision.action !== 'deny') return {};
    if (['PreToolUse', 'PostToolUse', 'Stop', 'UserPromptSubmit'].includes(name)) return { decision: 'block', reason };
    return {};
  }
});
