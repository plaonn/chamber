#!/usr/bin/env node
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { getAdapter, listAdapters } from '../src/adapters/index.js';
import { TraceStore } from '../src/trace-store.js';
import { DEFAULT_POLICY_PROFILE, evaluatePolicy } from '../src/policy.js';
import { qualityEvidence } from '../src/evidence.js';
import { createEvent } from '../src/schema.js';

const args = process.argv.slice(2);
const option = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1]; };
const has = (name) => args.includes(name);
const output = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
const usage = () => console.log(`Usage: chamber <hosts|doctor|trace|evidence|outcome|normalize|install|uninstall|demo> [options]

Commands:
  hosts                         list adapter capability matrices
  doctor [--state-dir DIR]      inspect local state and adapters
  trace [--state-dir DIR]       query redacted trace records
  evidence [--state-dir DIR]    export session quality evidence
  outcome --session-id ID --status accepted|rejected|unknown
                                record explicit, transcript-free outcome feedback
  normalize --host H --input F  normalize a host fixture/event and record audit
  hook --host H                  stdin/stdout native-hook entrypoint
  install --host H [--config-dir DIR] [--dry-run]
  uninstall --host H [--config-dir DIR] [--dry-run]
  demo [--state-dir DIR]        reproducible audit-only flow`);

function profile(adapter, overrides = {}) {
  return {
    host: adapter.id, agent_runtime: adapter.id === 'gemini' ? 'gemini-cli' : 'codex-cli', model: overrides.model ?? 'unknown',
    host_version: overrides.host_version ?? 'unknown', adapter_revision: adapter.revision,
    policy_profile: DEFAULT_POLICY_PROFILE.id, policy_revision: DEFAULT_POLICY_PROFILE.revision,
    config_revision: overrides.config_revision ?? 'unknown'
  };
}

async function configPath(host) { return join(resolve(option('--config-dir', '.chamber')), `${host}.hooks.json`); }
async function exists(path) { try { await stat(path); return true; } catch { return false; } }

async function normalize() {
  const adapter = getAdapter(option('--host'));
  const raw = JSON.parse(await readFile(resolve(option('--input')), 'utf8'));
  const workerProfile = profile(adapter, { host_version: raw.codex_version ?? raw.gemini_version });
  const event = adapter.normalize(raw, { session_id: option('--session-id', 'standalone'), worker_profile: workerProfile });
  const store = new TraceStore(resolve(option('--state-dir', '.chamber')));
  const history = (await store.query({ sessionId: event.session_id })).map((record) => record.event);
  const decision = evaluatePolicy(event, history, DEFAULT_POLICY_PROFILE, adapter.capabilitiesFor(event));
  await store.append({ kind: 'canonical_event', event, policy_decision: decision, raw_vendor_event: raw }, { recordRawVendor: has('--record-raw-vendor') });
  output({ event, decision, host_response: adapter.toHostResponse(decision, event) });
}

async function hook() {
  const adapter = getAdapter(option('--host'));
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const workerProfile = profile(adapter, { model: raw.model, host_version: raw.codex_version ?? raw.gemini_version });
  const event = adapter.normalize(raw, { session_id: raw.session_id, worker_profile: workerProfile });
  const store = new TraceStore(resolve(process.env.CHAMBER_STATE_DIR ?? option('--state-dir', '.chamber')));
  const history = (await store.query({ sessionId: event.session_id })).map((record) => record.event);
  const policy = { ...DEFAULT_POLICY_PROFILE, mode: process.env.CHAMBER_MODE ?? DEFAULT_POLICY_PROFILE.mode };
  const decision = evaluatePolicy(event, history, policy, adapter.capabilitiesFor(event));
  await store.append({ kind: 'canonical_event', event, policy_decision: decision, raw_vendor_event: raw }, { recordRawVendor: process.env.CHAMBER_RECORD_RAW_VENDOR === '1' });
  output(adapter.toHostResponse(decision, event));
}

async function outcome() {
  const sessionId = option('--session-id'); const status = option('--status');
  if (!sessionId) throw new Error('outcome requires --session-id');
  if (!['accepted', 'rejected', 'unknown'].includes(status)) throw new Error('outcome status must be accepted, rejected, or unknown');
  const store = new TraceStore(resolve(option('--state-dir', '.chamber')));
  const history = await store.query({ sessionId }); const exemplar = history.at(-1)?.event;
  if (!exemplar) throw new Error('outcome requires an existing session trace');
  const event = createEvent({
    session_id: sessionId, lifecycle: 'outcome', host: exemplar.host, worker_profile: exemplar.worker_profile,
    payload: { status, outcome_provenance: 'operator.explicit-v1', task_classification: exemplar.payload?.task_classification },
    vendor: { hook_event_name: 'ChamberOutcome' }
  });
  await store.append({ kind: 'outcome', event, policy_decision: { action: 'observe' } });
  output({ recorded: true, session_id: sessionId, status, provenance: 'operator.explicit-v1' });
}

async function install(remove = false) {
  const host = option('--host'); getAdapter(host);
  const path = await configPath(host); const current = await exists(path) ? JSON.parse(await readFile(path, 'utf8')) : { schema_version: 'chamber.install.v1', hooks: [] };
  const next = { ...current, hooks: remove ? current.hooks.filter((hook) => hook.id !== 'chamber') : [...current.hooks.filter((hook) => hook.id !== 'chamber'), { id: 'chamber', command: 'chamber normalize', mode: 'audit', managed: true }] };
  if (has('--dry-run')) return output({ dry_run: true, path, before: current, after: next });
  await mkdir(resolve(option('--config-dir', '.chamber')), { recursive: true });
  if (await exists(path)) await rename(path, `${path}.bak`);
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  output({ changed: true, path, backup: (await exists(`${path}.bak`)) ? `${path}.bak` : null, config: next });
}

async function demo() {
  const stateDir = resolve(option('--state-dir', '.chamber-demo'));
  const adapter = getAdapter('gemini'); const workerProfile = profile(adapter, { host_version: 'fixture' });
  const store = new TraceStore(stateDir);
  const raw = { hook_event_name: 'AfterAgent', session_id: 'demo-session', prompt: 'run tests', prompt_response: 'tests passed', stop_hook_active: false };
  const event = adapter.normalize(raw, { worker_profile: workerProfile });
  const decision = evaluatePolicy(event, [], DEFAULT_POLICY_PROFILE, adapter.capabilitiesFor(event));
  await store.append({ kind: 'canonical_event', event, policy_decision: decision, raw_vendor_event: raw });
  output({ mode: 'audit', behavior_changed: false, decision, trace_dir: stateDir });
}

async function main() {
  const command = args[0];
  if (!command || has('--help')) return usage();
  if (command === 'hosts') return output(listAdapters().map((adapter) => ({ id: adapter.id, revision: adapter.revision, capabilities: 'event-conditioned; use event_capabilities', event_capabilities: adapter.eventCapabilities })));
  if (command === 'doctor') { const store = new TraceStore(resolve(option('--state-dir', '.chamber'))); return output({ state_dir: store.stateDir, trace_records: (await store.query()).length, adapters: listAdapters().map((adapter) => adapter.id), global_config_modified: false }); }
  if (command === 'trace') { const store = new TraceStore(resolve(option('--state-dir', '.chamber'))); return output(await store.query({ sessionId: option('--session-id'), limit: Number(option('--limit', '100')) })); }
  if (command === 'evidence') { const store = new TraceStore(resolve(option('--state-dir', '.chamber'))); const records = await store.query({ sessionId: option('--session-id') }); const events = records.map((record) => record.event).filter(Boolean); return output(qualityEvidence(events, events[0]?.worker_profile ?? { host: 'unknown', policy_revision: 'unknown' })); }
  if (command === 'outcome') return outcome();
  if (command === 'normalize') return normalize();
  if (command === 'hook') return hook();
  if (command === 'install') return install(false);
  if (command === 'uninstall') return install(true);
  if (command === 'demo') return demo();
  usage(); process.exitCode = 1;
}
main().catch((error) => { console.error(`chamber: ${error.message}`); process.exitCode = 1; });
