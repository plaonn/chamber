import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { getAdapter } from '../src/adapters/index.js';
import { DEFAULT_POLICY_PROFILE, evaluatePolicy } from '../src/policy.js';
import { TraceStore } from '../src/trace-store.js';
import { qualityEvidence } from '../src/evidence.js';

const profile = (adapter) => ({ host: adapter.id, agent_runtime: adapter.id, model: 'fixture', host_version: 'fixture', adapter_revision: adapter.revision, policy_profile: 'audit-default', policy_revision: '1', config_revision: 'fixture' });
const fixture = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const exec = promisify(execFile);

test('Codex and Gemini fixtures normalize into the canonical schema', async () => {
  for (const [host, name] of [['codex', 'codex-tool-after.json'], ['gemini', 'gemini-before-tool.json']]) {
    const adapter = getAdapter(host); const event = adapter.normalize(await fixture(name), { worker_profile: profile(adapter) });
    assert.equal(event.schema_version, 'chamber.event.v1'); assert.equal(event.lifecycle, host === 'codex' ? 'tool.after' : 'tool.before');
  }
});

test('redaction boundary removes authorization values before storage', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'chamber-')); const adapter = getAdapter('codex'); const event = adapter.normalize(await fixture('codex-tool-after.json'), { worker_profile: profile(adapter) });
  const store = new TraceStore(dir); await store.append({ event, raw_vendor_event: { authorization: 'Bearer hidden' } }); const text = await readFile(join(dir, 'trace.jsonl'), 'utf8');
  assert.match(text, /\[REDACTED\]/); assert.doesNotMatch(text, /secret-value|Bearer hidden/); await rm(dir, { recursive: true });
});

test('audit-only completion validator observes unsupported claims without blocking', () => {
  const adapter = getAdapter('codex'); const event = { lifecycle: 'finish.before', payload: { output: 'tests passed' } };
  const result = evaluatePolicy(event, [], DEFAULT_POLICY_PROFILE, adapter.capabilities);
  assert.equal(result.action, 'audit'); assert.deepEqual(result.degraded, ['audit-only']);
});

test('enforcement deterministically degrades when host cannot block', () => {
  const event = { lifecycle: 'finish.before', payload: { output: 'verified' } };
  const profile = { ...DEFAULT_POLICY_PROFILE, mode: 'enforce' };
  const result = evaluatePolicy(event, [], profile, { can_block: false });
  assert.equal(result.action, 'audit'); assert.deepEqual(result.degraded, ['can_block']);
});

test('adapter response contracts preserve allow and deny decisions', () => {
  for (const host of ['codex', 'gemini']) {
    const adapter = getAdapter(host);
    assert.deepEqual(adapter.toHostResponse({ action: 'allow' }), { decision: 'allow' });
    assert.deepEqual(adapter.toHostResponse({ action: 'deny', decisions: [{ reason: 'policy' }] }), { decision: 'deny', reason: 'policy' });
  }
});

test('trajectory evidence supports a completion claim', () => {
  const event = { lifecycle: 'finish.before', payload: { output: 'tests passed' } };
  const result = evaluatePolicy(event, [{ lifecycle: 'tool.after', payload: { command: 'pnpm test', exit_code: 0 } }], DEFAULT_POLICY_PROFILE, getAdapter('gemini').capabilities);
  assert.equal(result.action, 'allow');
});

test('quality evidence leaves probability unset for insufficient samples', () => {
  const evidence = qualityEvidence([], { host: 'codex', policy_revision: '1' });
  assert.equal(evidence.success_probability, null); assert.equal(evidence.uncertainty, 'insufficient_evidence');
});

test('isolated install and uninstall are reversible without global configuration', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'chamber-config-'));
  const cli = new URL('../bin/chamber.js', import.meta.url).pathname;
  const run = async (...args) => JSON.parse((await exec(process.execPath, [cli, ...args])).stdout);
  const preview = await run('install', '--host', 'gemini', '--config-dir', dir, '--dry-run');
  assert.equal(preview.dry_run, true); assert.equal(preview.before.hooks.length, 0);
  const installed = await run('install', '--host', 'gemini', '--config-dir', dir);
  assert.equal(installed.config.hooks[0].id, 'chamber');
  const removed = await run('uninstall', '--host', 'gemini', '--config-dir', dir);
  assert.equal(removed.config.hooks.length, 0);
  await rm(dir, { recursive: true });
});
