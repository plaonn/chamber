import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { getAdapter } from '../src/adapters/index.js';
import { qualityEvidence } from '../src/evidence.js';
import { DEFAULT_POLICY_PROFILE, evaluatePolicy } from '../src/policy.js';
import { TraceStore } from '../src/trace-store.js';

const exec = promisify(execFile);
const runWithInput = (file, args, input, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(file, args, { ...options, stdio: ['pipe', 'pipe', 'pipe'] }); let stdout = ''; let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; }); child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', reject); child.on('close', (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr || `exit ${code}`)));
  child.stdin.end(input);
});
const fixture = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const profile = (adapter) => ({ host: adapter.id, agent_runtime: adapter.id, model: 'fixture', host_version: 'fixture', adapter_revision: adapter.revision, policy_profile: 'audit-default', policy_revision: '1', config_revision: 'fixture' });
const normalize = async (host, name) => { const adapter = getAdapter(host); return adapter.normalize(await fixture(name), { worker_profile: profile(adapter) }); };

test('Codex PostToolUse and Gemini tool fixtures normalize into canonical tool events', async () => {
  assert.equal((await normalize('codex', 'codex-tool-after.json')).lifecycle, 'tool.after');
  assert.equal((await normalize('gemini', 'gemini-before-tool.json')).lifecycle, 'tool.before');
  assert.equal((await normalize('gemini', 'gemini-after-tool.json')).lifecycle, 'tool.after');
});

test('Codex Stop preserves native final response as canonical completion payload', async () => {
  const event = await normalize('codex', 'codex-stop.json');
  assert.equal(event.lifecycle, 'finish.before');
  assert.equal(event.payload.completion_output, 'Tests passed and the implementation is verified.');
});

test('Codex output is event-aware: PreTool approves, Stop uses no-op or block', async () => {
  const adapter = getAdapter('codex');
  const pre = adapter.normalize({ ...(await fixture('codex-tool-after.json')), hook_event_name: 'PreToolUse' }, { worker_profile: profile(adapter) });
  const stop = await normalize('codex', 'codex-stop.json');
  assert.deepEqual(adapter.toHostResponse({ action: 'allow' }, pre), { decision: 'approve' });
  assert.deepEqual(adapter.toHostResponse({ action: 'deny', decisions: [{ verdict: 'deny', reason: 'policy' }] }, pre), { decision: 'block', reason: 'policy' });
  assert.deepEqual(adapter.toHostResponse({ action: 'allow' }, stop), {});
  assert.deepEqual(adapter.toHostResponse({ action: 'deny', decisions: [{ verdict: 'deny', reason: 'policy' }] }, stop), { decision: 'block', reason: 'policy' });
});

test('Gemini maps BeforeAgent to prompt.submit and AfterAgent to completion interception', async () => {
  const before = await normalize('gemini', 'gemini-before-agent.json');
  const after = await normalize('gemini', 'gemini-after-agent.json');
  assert.equal(before.lifecycle, 'prompt.submit'); assert.equal(before.payload.prompt, 'Implement the feature');
  assert.equal(after.lifecycle, 'finish.before'); assert.equal(after.payload.completion_output, 'Tests passed and verified.');
});

test('audit-only observes unsupported final completion claims without changing behavior', async () => {
  const adapter = getAdapter('gemini'); const event = await normalize('gemini', 'gemini-after-agent.json');
  const result = evaluatePolicy(event, [], DEFAULT_POLICY_PROFILE, adapter.capabilitiesFor(event));
  assert.equal(result.action, 'audit'); assert.deepEqual(result.degraded, ['audit-only']);
});

test('completion validation accepts a native final response after a recognized successful check', async () => {
  const adapter = getAdapter('gemini'); const event = await normalize('gemini', 'gemini-after-agent.json');
  const history = [{ lifecycle: 'tool.after', payload: { verification: { classification: 'recognized-check', execution: 'passed', provenance: 'host.tool_response.exit_code' } } }];
  const result = evaluatePolicy(event, history, { ...DEFAULT_POLICY_PROFILE, mode: 'enforce' }, adapter.capabilitiesFor(event));
  assert.equal(result.action, 'allow');
});

test('enforcement creates Gemini retry and degrades when the event cannot block', async () => {
  const gemini = getAdapter('gemini'); const event = await normalize('gemini', 'gemini-after-agent.json');
  const enforced = evaluatePolicy(event, [], { ...DEFAULT_POLICY_PROFILE, mode: 'enforce' }, gemini.capabilitiesFor(event));
  assert.deepEqual(gemini.toHostResponse(enforced, event), { decision: 'deny', reason: 'unsupported-completion-claim' });
  const codex = getAdapter('codex'); const session = codex.normalize({ hook_event_name: 'SessionStart', session_id: 's', source: 'startup' }, { worker_profile: profile(codex) });
  const degraded = evaluatePolicy({ ...session, lifecycle: 'finish.before', payload: { completion_output: 'tests passed' } }, [], { ...DEFAULT_POLICY_PROFILE, mode: 'enforce' }, codex.capabilitiesFor(session));
  assert.deepEqual(degraded.degraded, ['can_block']);
});

test('only recognized successful checks count as verification evidence', () => {
  const profile = { host: 'gemini', policy_revision: '1' };
  const events = [
    { lifecycle: 'tool.after', payload: { verification: { classification: 'unclassified', execution: 'passed' } } },
    { lifecycle: 'tool.after', payload: { verification: { classification: 'recognized-check', execution: 'unknown' } } },
    { lifecycle: 'tool.after', payload: { verification: { classification: 'recognized-check', execution: 'passed' } } }
  ];
  assert.equal(qualityEvidence(events, profile).verification_evidence_count, 1);
});

test('trace projection never persists synthetic prompt, command, output, or raw vendor data by default', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'chamber-')); const adapter = getAdapter('gemini');
  const event = adapter.normalize({ hook_event_name: 'AfterAgent', session_id: 's', prompt: 'SECRET_PROMPT_123', prompt_response: 'SECRET_OUTPUT_456' }, { worker_profile: profile(adapter) });
  event.payload.command = 'echo SECRET_COMMAND_789'; event.payload.tool_response = { nested: { token: 'SECRET_VENDOR_ABC' } };
  const store = new TraceStore(dir); await store.append({ kind: 'canonical_event', event, policy_decision: {}, raw_vendor_event: { secret: 'SECRET_RAW_DEF', nested: { token: 'SECRET_NESTED_GHI' } } });
  const text = await readFile(join(dir, 'trace.jsonl'), 'utf8');
  for (const secret of ['SECRET_PROMPT_123', 'SECRET_OUTPUT_456', 'SECRET_COMMAND_789', 'SECRET_VENDOR_ABC', 'SECRET_RAW_DEF', 'SECRET_NESTED_GHI']) assert.doesNotMatch(text, new RegExp(secret));
  assert.doesNotMatch(text, /raw_vendor_event/); assert.match(text, /"raw_vendor_recorded":false/); assert.match(text, /minimized-v2/); await rm(dir, { recursive: true });
});

test('raw vendor recording is an explicit debug opt-in and redacts synthetic secret fields', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'chamber-raw-')); const adapter = getAdapter('gemini');
  const event = adapter.normalize({ hook_event_name: 'BeforeAgent', session_id: 's', prompt: 'normal' }, { worker_profile: profile(adapter) });
  const store = new TraceStore(dir);
  await store.append({ kind: 'canonical_event', event, policy_decision: {}, raw_vendor_event: { api_key: 'SYNTHETIC_SECRET_123' } }, { recordRawVendor: true });
  const text = await readFile(join(dir, 'trace.jsonl'), 'utf8');
  assert.match(text, /"raw_vendor_recorded":true/); assert.match(text, /\[REDACTED\]/); assert.doesNotMatch(text, /SYNTHETIC_SECRET_123/); await rm(dir, { recursive: true });
});

test('native hook stdin/stdout entrypoint records an audit event without leaking completion text', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'chamber-hook-')); const cli = new URL('../bin/chamber.js', import.meta.url).pathname;
  const raw = JSON.stringify({ hook_event_name: 'AfterAgent', session_id: 'hook-session', prompt: 'SYNTHETIC_PROMPT', prompt_response: 'tests passed SYNTHETIC_RESPONSE', stop_hook_active: false });
  const result = await runWithInput(process.execPath, [cli, 'hook', '--host', 'gemini'], raw, { env: { ...process.env, CHAMBER_STATE_DIR: dir, CHAMBER_MODE: 'audit' } });
  assert.deepEqual(JSON.parse(result.stdout), { decision: 'allow' });
  const text = await readFile(join(dir, 'trace.jsonl'), 'utf8'); assert.doesNotMatch(text, /SYNTHETIC_PROMPT|SYNTHETIC_RESPONSE/); await rm(dir, { recursive: true });
});

test('isolated install and uninstall are reversible without global configuration', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'chamber-config-')); const cli = new URL('../bin/chamber.js', import.meta.url).pathname;
  const run = async (...args) => JSON.parse((await exec(process.execPath, [cli, ...args])).stdout);
  assert.equal((await run('install', '--host', 'gemini', '--config-dir', dir, '--dry-run')).dry_run, true);
  assert.equal((await run('install', '--host', 'gemini', '--config-dir', dir)).config.hooks[0].id, 'chamber');
  assert.equal((await run('uninstall', '--host', 'gemini', '--config-dir', dir)).config.hooks.length, 0); await rm(dir, { recursive: true });
});
