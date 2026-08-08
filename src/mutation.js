const MEANINGFUL_TOOLS = new Set(['apply_patch', 'edit_file', 'write_file', 'replace_file_contents']);

export function classifyMutation({ lifecycle, toolName } = {}) {
  if (!['tool.before', 'tool.after'].includes(lifecycle)) return { classification: 'none', provenance: 'canonical.lifecycle-v1' };
  if (MEANINGFUL_TOOLS.has(String(toolName ?? '').toLowerCase())) return { classification: 'meaningful', provenance: 'canonical.tool-name-v1' };
  return { classification: 'unknown', provenance: 'canonical.tool-name-v1' };
}
