export const EVENT_SCHEMA_VERSION = 'chamber.event.v1';
export const QUALITY_EVIDENCE_SCHEMA_VERSION = 'chamber.quality-evidence.v1';
export const TRACE_SCHEMA_VERSION = 'chamber.trace.v2';
export const TRACE_PERSISTENCE_REVISION = 'minimized-v2';
export const CORRELATION_SCHEMA_VERSION = 'chamber.correlation.v1';
export const OUTCOME_SOURCE_SCHEMA_VERSION = 'chamber.outcome-source.v1';
export const EXECUTION_SCHEMA_VERSION = 'chamber.execution.v1';

export const LIFECYCLES = new Set([
  'session.start', 'session.end', 'prompt.submit', 'model.before', 'model.after',
  'tool.before', 'tool.after', 'finish.before', 'finish.after', 'session.link', 'outcome'
]);

export const CAPABILITY_KEYS = [
  'can_block', 'can_mutate_tool_args', 'can_inject_context', 'can_observe_model_io',
  'can_retry_finish', 'can_modify_output'
];
