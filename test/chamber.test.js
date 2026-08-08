import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { getAdapter } from '../src/adapters/index.js';
import { evidenceSelection, qualityEvidence, traceSummary } from '../src/evidence.js';
import { DEFAULT_POLICY_PROFILE, evaluatePolicy } from '../src/policy.js';
import { TraceStore } from '../src/trace-store.js';
import { inspectCodexHookRegistration } from '../src/operator.js';
import { resolveStateDir } from '../src/state.js';
import { nativeControlsFromAdapter } from '../src/effective-worker.js';
import { createEvent } from '../src/schema.js';
import { classifyMutation } from '../src/mutation.js';

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

test('native-shaped Codex and Gemini tool fixtures normalize into canonical tool events', async () => {
  const codex = await normalize('codex', 'codex-tool-after.json'); const gemini = await normalize('gemini', 'gemini-after-tool.json');
  assert.equal(codex.lifecycle, 'tool.after'); assert.equal(codex.payload.verification.execution, 'unknown');
  assert.equal(codex.payload.verification.limitation, 'exact-exit-status-unsupported');
  assert.equal((await normalize('gemini', 'gemini-before-tool.json')).lifecycle, 'tool.before');
  assert.equal(gemini.lifecycle, 'tool.after'); assert.equal(gemini.payload.verification.execution, 'passed');
});

test('Codex Stop preserves native final response as canonical completion payload', async () => {
  const event = await normalize('codex', 'codex-stop.json');
  assert.equal(event.lifecycle, 'finish.before');
  assert.equal(event.payload.completion_output, 'Tests passed and the implementation is verified.');
});

test('Codex native controls stay unknown without a contracted session-local source', async () => {
  const adapter = getAdapter('codex');
  const raw = { ...(await fixture('codex-stop.json')), reasoning_effort: 'high' };
  const event = adapter.normalize(raw, { worker_profile: profile(adapter) });
  assert.deepEqual(event.worker_profile.native_controls, {
    schema_version: 'chamber.native-controls.v1', status: 'unknown', reason: 'adapter-control-not-observed', values: {}
  });
});

test('Codex output is event-aware: audit-only uses no-op, enforcement blocks', async () => {
  const adapter = getAdapter('codex');
  const pre = adapter.normalize({ ...(await fixture('codex-tool-after.json')), hook_event_name: 'PreToolUse' }, { worker_profile: profile(adapter) });
  const stop = await normalize('codex', 'codex-stop.json');
  assert.deepEqual(adapter.toHostResponse({ action: 'allow' }, pre), {});
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

test('completion validation consumes normalized native successful-check history', async () => {
  const adapter = getAdapter('gemini'); const event = await normalize('gemini', 'gemini-after-agent.json');
  const history = [await normalize('gemini', 'gemini-after-tool.json')];
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

test('meaningful mutation classifications are bounded and provider-neutral', () => {
  assert.deepEqual(classifyMutation({ lifecycle: 'tool.after', toolName: 'apply_patch' }), { classification: 'meaningful', provenance: 'canonical.tool-name-v1' });
  assert.deepEqual(classifyMutation({ lifecycle: 'tool.after', toolName: 'run_shell_command' }), { classification: 'unknown', provenance: 'canonical.tool-name-v1' });
});

test('verification freshness emits a minimized shadow intervention only after a meaningful mutation', () => {
  const adapter = getAdapter('gemini'); const worker = profile(adapter);
  const event = (id, lifecycle, payload = {}) => createEvent({ event_id: id, occurred_at: `2026-08-09T00:00:0${id.at(-1)}.000Z`, session_id: 'freshness', lifecycle, host: { runtime: 'fixture', adapter_revision: 'fixture' }, worker_profile: worker, payload });
  const mutation = event('event-1', 'tool.after', { mutation: { classification: 'meaningful', provenance: 'fixture' } });
  const verification = event('event-2', 'tool.after', { verification: { classification: 'recognized-check', execution: 'passed' } });
  const finish = event('event-3', 'finish.before');
  assert.equal(evaluatePolicy(finish, [mutation, verification], DEFAULT_POLICY_PROFILE, {}, { adapterCapabilities: {} }).finding, undefined);
  const staleMutation = event('event-4', 'tool.after', { mutation: { classification: 'meaningful', provenance: 'fixture' } });
  const stale = evaluatePolicy(finish, [verification, staleMutation], DEFAULT_POLICY_PROFILE, {}, { adapterCapabilities: {} });
  assert.equal(stale.action, 'audit'); assert.equal(stale.finding.code, 'VERIFICATION_MISSING');
  assert.equal(stale.finding.evidence.last_meaningful_mutation_event_id, 'event-4');
  assert.equal(stale.intervention.result, 'shadowed'); assert.equal(stale.intervention.template_id, 'verification-required-v1');
  assert.deepEqual(stale.intervention.parameters, { verification_state: 'missing' });
});

test('intervention budget exhausts and unverified enforcement degrades without host response', () => {
  const adapter = getAdapter('gemini'); const worker = profile(adapter);
  const event = (id, lifecycle, payload = {}) => createEvent({ event_id: id, occurred_at: `2026-08-09T00:00:0${id.at(-1)}.000Z`, session_id: 'budget', lifecycle, host: { runtime: 'fixture', adapter_revision: 'fixture' }, worker_profile: worker, payload });
  const mutation = event('event-1', 'tool.after', { mutation: { classification: 'meaningful', provenance: 'fixture' } }); const finish = event('event-2', 'finish.before');
  const first = evaluatePolicy(finish, [mutation], { ...DEFAULT_POLICY_PROFILE, mode: 'enforce' }, { can_retry_finish: true }, { adapterCapabilities: { can_retry_finish: true } });
  assert.equal(first.intervention.result, 'degraded'); assert.equal(first.action, 'audit');
  const second = evaluatePolicy(finish, [{ event: mutation }, { event: finish, policy_decision: first }], DEFAULT_POLICY_PROFILE, {}, { adapterCapabilities: {} });
  assert.equal(second.intervention.result, 'budget_exhausted'); assert.equal(second.intervention.budget.used, 2);
});

test('native-shaped failed, cancelled, and signalled Gemini checks are not deterministic success evidence', async () => {
  const profile = { host: 'gemini', policy_revision: '1' };
  const events = [await normalize('codex', 'codex-tool-after.json'), await normalize('gemini', 'gemini-after-tool.json'), await normalize('gemini', 'gemini-after-tool-failed.json'), await normalize('gemini', 'gemini-after-tool-cancelled.json'), await normalize('gemini', 'gemini-after-tool-signal.json')];
  assert.equal(events[2].payload.verification.execution, 'failed'); assert.equal(events[3].payload.verification.execution, 'unknown');
  assert.equal(events[4].payload.verification.execution, 'failed'); assert.equal(events[4].payload.verification.provenance, 'gemini.shell.tool-result.signal');
  assert.equal(qualityEvidence(events, profile).verification_evidence_count, 1);
});

test('persisted session classification retains a prior native prompt class when Stop is unknown', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'chamber-class-')); const adapter = getAdapter('codex'); const store = new TraceStore(dir);
  const prompt = await normalize('codex', 'codex-user-prompt-submit.json'); const stop = await normalize('codex', 'codex-stop.json');
  await store.append({ kind: 'canonical_event', event: prompt, policy_decision: {} }); await store.append({ kind: 'canonical_event', event: stop, policy_decision: {} });
  const events = (await store.query({ sessionId: prompt.session_id })).map((record) => record.event);
  const evidence = qualityEvidence(events, profile(adapter));
  assert.equal(prompt.payload.task_classification.value, 'implementation'); assert.equal(stop.payload.task_classification.value, 'unknown');
  assert.equal(evidence.task_class, 'implementation'); assert.equal(evidence.provenance.task_classification.provenance, 'ephemeral.prompt-and-command'); await rm(dir, { recursive: true });
});

test('trace projection never persists synthetic prompt, command, output, or raw vendor data by default', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'chamber-')); const adapter = getAdapter('gemini');
  const event = adapter.normalize({ hook_event_name: 'AfterAgent', session_id: 's', prompt: 'SECRET_PROMPT_123', prompt_response: 'SECRET_OUTPUT_456' }, { worker_profile: profile(adapter) });
  event.payload.command = 'echo SECRET_COMMAND_789'; event.payload.tool_response = { nested: { token: 'SECRET_VENDOR_ABC' } };
  const store = new TraceStore(dir); await store.append({ kind: 'canonical_event', event, policy_decision: {}, raw_vendor_event: { secret: 'SECRET_RAW_DEF', nested: { token: 'SECRET_NESTED_GHI' } } });
  const text = await readFile(join(dir, 'trace.jsonl'), 'utf8');
  for (const secret of ['SECRET_PROMPT_123', 'SECRET_OUTPUT_456', 'SECRET_COMMAND_789', 'SECRET_VENDOR_ABC', 'SECRET_RAW_DEF', 'SECRET_NESTED_GHI']) assert.doesNotMatch(text, new RegExp(secret));
  assert.doesNotMatch(text, /raw_vendor_event/); assert.match(text, /"raw_vendor_recorded":false/); assert.match(text, /minimized-v2/); assert.match(text, /task_classification/); await rm(dir, { recursive: true });
});

test('trace projection persists only bounded finding and intervention evidence', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'chamber-intervention-')); const adapter = getAdapter('gemini'); const store = new TraceStore(dir);
  const mutation = createEvent({ session_id: 'persist', lifecycle: 'tool.after', host: { runtime: 'fixture', adapter_revision: 'fixture' }, worker_profile: profile(adapter), payload: { mutation: { classification: 'meaningful', provenance: 'fixture' } } });
  const finish = createEvent({ session_id: 'persist', lifecycle: 'finish.before', host: { runtime: 'fixture', adapter_revision: 'fixture' }, worker_profile: profile(adapter), payload: { completion_output: 'SECRET_COMPLETION' } });
  const decision = evaluatePolicy(finish, [mutation], DEFAULT_POLICY_PROFILE, {}, { adapterCapabilities: {} });
  await store.append({ kind: 'canonical_event', event: finish, policy_decision: decision });
  const text = await readFile(join(dir, 'trace.jsonl'), 'utf8');
  assert.match(text, /VERIFICATION_MISSING/); assert.match(text, /verification-required-v1/); assert.doesNotMatch(text, /SECRET_COMPLETION/); await rm(dir, { recursive: true });
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

test('explicit outcome recording preserves session worker provenance without transcript text', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'chamber-outcome-')); const cli = new URL('../bin/chamber.js', import.meta.url).pathname;
  const raw = JSON.stringify({ hook_event_name: 'AfterAgent', session_id: 'outcome-session', prompt: 'Implement a feature', prompt_response: 'done', stop_hook_active: false });
  await runWithInput(process.execPath, [cli, 'hook', '--host', 'gemini'], raw, { env: { ...process.env, CHAMBER_STATE_DIR: dir } });
  const response = JSON.parse((await exec(process.execPath, [cli, 'outcome', '--state-dir', dir, '--session-id', 'outcome-session', '--status', 'accepted'])).stdout);
  assert.equal(response.recorded, true);
  const records = JSON.parse((await exec(process.execPath, [cli, 'trace', '--state-dir', dir, '--session-id', 'outcome-session'])).stdout);
  const outcome = records.at(-1).event; assert.equal(outcome.lifecycle, 'outcome'); assert.equal(outcome.payload.status, 'accepted');
  const evidence = JSON.parse((await exec(process.execPath, [cli, 'evidence', '--state-dir', dir, '--session-id', 'outcome-session'])).stdout);
  assert.equal(evidence.outcome, 'accepted'); assert.equal(evidence.task_class, 'implementation'); await rm(dir, { recursive: true });
});

test('state resolution is stable outside the repository and CHAMBER_STATE_DIR wins over flags', () => {
  assert.equal(resolveStateDir({ homeDirectory: '/home/operator', operatingSystem: 'linux', environment: {} }), '/home/operator/.local/state/chamber');
  assert.equal(resolveStateDir({ homeDirectory: '/Users/operator', operatingSystem: 'darwin', environment: {} }), '/Users/operator/Library/Application Support/Chamber');
  assert.equal(resolveStateDir({ explicitStateDir: '/flag-state', environment: { CHAMBER_STATE_DIR: '/environment-state' } }), '/environment-state');
});

test('evidence requires a session selection when a store has multiple sessions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'chamber-sessions-')); const adapter = getAdapter('gemini'); const store = new TraceStore(dir);
  for (const sessionId of ['one', 'two']) {
    const event = adapter.normalize({ hook_event_name: 'BeforeAgent', session_id: sessionId, prompt: 'Implement feature' }, { worker_profile: profile(adapter) });
    await store.append({ kind: 'canonical_event', event, policy_decision: {} });
  }
  const records = await store.query({ limit: Infinity });
  assert.deepEqual(evidenceSelection(records).status, 'selection_required');
  assert.equal(evidenceSelection(records).distinct_session_count, 2);
  assert.equal(evidenceSelection(await store.query({ sessionId: 'one' }), 'one').freshness, 'current-session');
  await rm(dir, { recursive: true });
});

test('trace summary keeps aggregate counts descriptive and does not estimate success probability', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'chamber-summary-')); const adapter = getAdapter('gemini'); const store = new TraceStore(dir);
  const event = adapter.normalize({ hook_event_name: 'AfterTool', session_id: 'summary', tool_name: 'run_shell_command', tool_input: { command: 'pnpm test' }, tool_response: { llmContent: 'tests passed', returnDisplay: 'tests passed' } }, { worker_profile: profile(adapter) });
  await store.append({ kind: 'canonical_event', event, policy_decision: {} });
  const summary = traceSummary(await store.query({ limit: Infinity }));
  assert.equal(summary.distinct_session_count, 1); assert.equal(summary.session_task_sample_count, 1); assert.equal(summary.verification_event_counts.passed, 1); assert.equal(summary.worker_session_counts.gemini, 1); assert.equal(summary.success_probability, null);
  await rm(dir, { recursive: true });
});

test('native controls are namespaced exact provenance but factorized evaluation does not create an exact-tuple cohort', async () => {
  const codex = profile(getAdapter('codex'));
  codex.native_controls = nativeControlsFromAdapter({ 'codex.reasoning_effort': 'high' }, { revision: 'codex-controls-v1', source: 'fixture' });
  const gemini = profile(getAdapter('gemini'));
  gemini.native_controls = nativeControlsFromAdapter({ 'gemini.thinking_level': 'high' }, { revision: 'gemini-controls-v1', source: 'fixture' });
  const codexEvidence = qualityEvidence([await normalize('codex', 'codex-user-prompt-submit.json')], codex);
  const geminiEvidence = qualityEvidence([await normalize('gemini', 'gemini-before-agent.json')], gemini);
  assert.deepEqual(codexEvidence.evaluation.selected_factors.native_controls, { 'codex.reasoning_effort': 'high' });
  assert.deepEqual(geminiEvidence.evaluation.selected_factors.native_controls, { 'gemini.thinking_level': 'high' });
  assert.equal(codexEvidence.evaluation.observed_provenance, 'exact');
  assert.equal(codexEvidence.evaluation.estimator_basis, 'factorized-or-pooled');
  assert.equal(codexEvidence.evaluation.interaction_promotion, 'evidence-required');
  assert.throws(() => nativeControlsFromAdapter({ 'codex.config': { token: 'must-not-persist' } }, { revision: 'fixture', source: 'fixture' }), /invalid native control/);
});

test('unknown native controls persist explicitly and summary counts each session once despite many events', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'chamber-session-summary-')); const adapter = getAdapter('gemini'); const store = new TraceStore(dir);
  for (const eventName of ['BeforeAgent', 'AfterTool']) {
    const event = adapter.normalize({ hook_event_name: eventName, session_id: 'one', prompt: 'Implement feature', tool_name: 'run_shell_command', tool_input: { command: 'pnpm test' }, tool_response: { llmContent: 'tests passed', returnDisplay: 'tests passed' } }, { worker_profile: profile(adapter) });
    await store.append({ kind: 'canonical_event', event, policy_decision: {} });
  }
  const records = await store.query({ limit: Infinity }); const evidence = qualityEvidence(records.map((record) => record.event), profile(adapter)); const summary = traceSummary(records);
  assert.equal(evidence.evaluation.native_control_provenance.status, 'unknown');
  assert.equal(summary.trace_records, 2); assert.equal(summary.session_task_sample_count, 1); assert.equal(summary.worker_session_counts.gemini, 1); assert.equal(summary.task_class_session_counts.debugging, 1);
  await rm(dir, { recursive: true });
});

test('migration imports minimized records once and leaves the source trace intact', async () => {
  const source = await mkdtemp(join(tmpdir(), 'chamber-source-')); const destination = await mkdtemp(join(tmpdir(), 'chamber-destination-')); const adapter = getAdapter('gemini'); const sourceStore = new TraceStore(source);
  const event = adapter.normalize({ hook_event_name: 'BeforeAgent', session_id: 'migrate', prompt: 'Implement feature' }, { worker_profile: profile(adapter) });
  await sourceStore.append({ kind: 'canonical_event', event, policy_decision: {} });
  const sourceText = await readFile(join(source, 'trace.jsonl'), 'utf8'); const destinationStore = new TraceStore(destination);
  assert.deepEqual(await destinationStore.migrateFrom(source), { source_records: 1, imported_records: 1, duplicate_records: 0, destination_records: 1, distinct_sessions: 1 });
  assert.equal((await destinationStore.migrateFrom(source)).duplicate_records, 1);
  assert.equal(await readFile(join(source, 'trace.jsonl'), 'utf8'), sourceText);
  await rm(source, { recursive: true }); await rm(destination, { recursive: true });
});

test('doctor reports fixture hook registration without claiming global configuration mutation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'chamber-doctor-')); const configDir = join(dir, 'config'); await mkdir(configDir);
  const entrypoint = join(dir, 'chamber.js'); await writeFile(entrypoint, '');
  await writeFile(join(configDir, 'hooks.json'), JSON.stringify({ SessionStart: [{ hooks: [{ type: 'command', command: `node ${entrypoint} hook --host codex` }] }] }));
  const cli = new URL('../bin/chamber.js', import.meta.url).pathname;
  const doctor = JSON.parse((await exec(process.execPath, [cli, 'doctor', '--state-dir', dir, '--config-dir', configDir])).stdout);
  assert.equal(doctor.codex_hook.registration, 'registered'); assert.equal(doctor.codex_hook.entrypoint, 'registered'); assert.equal('global_config_modified' in doctor, false);
  await rm(dir, { recursive: true });
});

test('hook diagnostics expand HOME in a stable entrypoint command', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'chamber-hook-home-')); const configDir = join(dir, 'config'); await mkdir(configDir);
  const homeDirectory = join(dir, 'home'); await mkdir(homeDirectory); await writeFile(join(homeDirectory, 'chamber.js'), '');
  await writeFile(join(configDir, 'hooks.json'), JSON.stringify({ Stop: [{ hooks: [{ type: 'command', command: 'node $HOME/chamber.js hook --host codex' }] }] }));
  assert.deepEqual(await inspectCodexHookRegistration({ configDir, homeDirectory }), { registration: 'registered', entrypoint: 'registered' });
  await rm(dir, { recursive: true });
});
