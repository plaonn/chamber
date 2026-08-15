#!/usr/bin/env node
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { getAdapter, listAdapters } from '../src/adapters/index.js';
import { TraceStore } from '../src/trace-store.js';
import { DEFAULT_POLICY_PROFILE, evaluatePolicy } from '../src/policy.js';
import { evidenceSelection, traceSummary } from '../src/evidence.js';
import { createEvent } from '../src/schema.js';
import { persistedTaskClass } from '../src/task-classification.js';
import { inspectCodexHookRegistration } from '../src/operator.js';
import { resolveStateDir } from '../src/state.js';
import { unknownNativeControls } from '../src/effective-worker.js';
import { checkClassification } from '../src/verification.js';
import {
  MAX_SESSION_CORRELATIONS,
  correlationFromEnvironment,
  correlationKey,
  correlationsFromEvents,
  correlationMatches,
  createOutcomeSource,
  normalizeCorrelation,
  normalizeProducer,
  outcomeProvenance,
  sameCorrelation,
  sameOutcomeSource
} from '../src/correlation.js';

const args = process.argv.slice(2);
const MAX_SELECTION_CANDIDATES = 10;
const option = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1]; };
const has = (name) => args.includes(name);
const output = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
const usage = () => console.log(`Usage: chamber <hosts|doctor|trace|evidence|summary|dogfood|correlate|outcome|migrate|normalize|install|uninstall|demo> [options]

Commands:
  hosts                         list adapter capability matrices
  doctor [--state-dir DIR]      inspect local state and adapters
  trace [--state-dir DIR]       query redacted trace records
  evidence [--state-dir DIR]    export session quality evidence
  summary [--state-dir DIR]     aggregate minimized trace counts
  dogfood [--state-dir DIR]     compact session-level outcome and policy coverage
  correlate --session-id ID --source-kind KIND --source-id ID [--source-revision REV]
                                attach one bounded external source reference
  migrate --from DIR [--state-dir DIR]
                                non-destructively import minimized trace records
  outcome (--session-id ID|--latest-unlabeled|--correlation-id ID) --status accepted|rejected|unknown
                                record explicit, transcript-free outcome feedback
           [--producer operator|user-approval|independent-verifier|benchmark|oracle]
           [--source-kind KIND --source-id ID [--source-revision REV]]
  normalize --host H --input F  normalize a host fixture/event and record audit
  hook --host H                  stdin/stdout native-hook entrypoint
  verify --session-id ID --encoded-command BASE64
                                execute one recognized check and record its exit status
  install --host H [--config-dir DIR] [--dry-run]
  uninstall --host H [--config-dir DIR] [--dry-run]
  demo [--state-dir DIR]        reproducible audit-only flow`);

function profile(adapter, overrides = {}) {
  return {
    host: adapter.id, agent_runtime: adapter.id === 'gemini' ? 'gemini-cli' : 'codex-cli', model: overrides.model ?? 'unknown',
    host_version: overrides.host_version ?? 'unknown', adapter_revision: adapter.revision,
    policy_profile: DEFAULT_POLICY_PROFILE.id, policy_revision: DEFAULT_POLICY_PROFILE.revision,
    config_revision: overrides.config_revision ?? 'unknown',
    native_controls: overrides.native_controls ?? unknownNativeControls()
  };
}

async function configPath(host) { return join(resolve(option('--config-dir', '.chamber')), `${host}.hooks.json`); }
async function exists(path) { try { await stat(path); return true; } catch { return false; } }
const stateDir = () => resolveStateDir({ explicitStateDir: option('--state-dir') });
const shellQuote = (value) => `'${String(value).replaceAll("'", "'\\\"'\\\"'")}'`;

function eventCorrelations(history) {
  return correlationsFromEvents(history.map((record) => record.event).filter(Boolean));
}

function attachCorrelation(event, correlation) {
  return createEvent({ ...event, payload: { ...event.payload, correlation } });
}

function correlatedSessionIds(records, { sourceKind, sourceId }) {
  return [...new Set(records
    .filter((record) => correlationMatches(record.event?.payload?.correlation, { sourceKind, sourceId })
      || correlationMatches(record.event?.payload?.outcome_source?.correlation, { sourceKind, sourceId }))
    .map((record) => record.event?.session_id)
    .filter(Boolean))].sort();
}

function codexVerificationResponse(raw) {
  if (process.env.CHAMBER_CAPTURE_VERIFICATION !== '1'
    || raw.hook_event_name !== 'PreToolUse'
    || raw.tool_name !== 'Bash'
    || checkClassification(raw.tool_input?.command) !== 'recognized-check'
    || !raw.session_id) return {};
  const encoded = Buffer.from(raw.tool_input.command, 'utf8').toString('base64');
  const entrypoint = fileURLToPath(import.meta.url);
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse', permissionDecision: 'allow',
      updatedInput: { command: `${shellQuote(process.execPath)} ${shellQuote(entrypoint)} verify --session-id ${shellQuote(raw.session_id)} --encoded-command ${encoded}` }
    }
  };
}

async function normalize() {
  const adapter = getAdapter(option('--host'));
  const raw = JSON.parse(await readFile(resolve(option('--input')), 'utf8'));
  const workerProfile = profile(adapter, { host_version: raw.codex_version ?? raw.gemini_version });
  const event = adapter.normalize(raw, { session_id: option('--session-id', 'standalone'), worker_profile: workerProfile });
  const store = new TraceStore(stateDir());
  const history = await store.query({ sessionId: event.session_id });
  const decision = evaluatePolicy(event, history, DEFAULT_POLICY_PROFILE, adapter.capabilitiesFor(event), { adapterCapabilities: adapter.adapterCapabilitiesFor(event) });
  await store.append({ kind: 'canonical_event', event, policy_decision: decision, raw_vendor_event: raw }, { recordRawVendor: has('--record-raw-vendor') });
  output({ event, decision, host_response: adapter.toHostResponse(decision, event) });
}

async function hook() {
  const adapter = getAdapter(option('--host'));
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const workerProfile = profile(adapter, { model: raw.model, host_version: raw.codex_version ?? raw.gemini_version });
  let event = adapter.normalize(raw, { session_id: raw.session_id, worker_profile: workerProfile });
  const store = new TraceStore(stateDir());
  const history = await store.query({ sessionId: event.session_id });
  const existingCorrelations = eventCorrelations(history);
  const correlation = correlationFromEnvironment();
  if (correlation && !existingCorrelations.some((existing) => correlationKey(existing) === correlationKey(correlation))
    && existingCorrelations.length < MAX_SESSION_CORRELATIONS) event = attachCorrelation(event, correlation);
  const policy = { ...DEFAULT_POLICY_PROFILE, mode: process.env.CHAMBER_MODE ?? DEFAULT_POLICY_PROFILE.mode };
  const decision = evaluatePolicy(event, history, policy, adapter.capabilitiesFor(event), { adapterCapabilities: adapter.adapterCapabilitiesFor(event) });
  await store.append({ kind: 'canonical_event', event, policy_decision: decision, raw_vendor_event: raw }, { recordRawVendor: process.env.CHAMBER_RECORD_RAW_VENDOR === '1' });
  output({ ...adapter.toHostResponse(decision, event), ...codexVerificationResponse(raw) });
}

async function verify() {
  const sessionId = option('--session-id'); const encoded = option('--encoded-command');
  if (!sessionId || !encoded) throw new Error('verify requires --session-id and --encoded-command');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 === 1) throw new Error('verify requires valid base64 command input');
  const command = Buffer.from(encoded, 'base64').toString('utf8');
  if (checkClassification(command) !== 'recognized-check') throw new Error('verify accepts recognized check commands only');
  const store = new TraceStore(stateDir()); const history = await store.query({ sessionId }); const exemplar = history.at(-1)?.event;
  if (!exemplar) throw new Error('verify requires an existing session trace');
  const result = await new Promise((resolve, reject) => {
    const child = spawn('/bin/sh', ['-lc', command], { stdio: 'inherit' });
    child.on('error', reject); child.on('close', (code, signal) => resolve({ code, signal }));
  });
  const execution = result.code === 0 ? 'passed' : 'failed';
  const event = createEvent({
    session_id: sessionId, lifecycle: 'tool.after', host: exemplar.host, worker_profile: exemplar.worker_profile,
    payload: {
      tool_name: 'Bash',
      verification: {
        classification: 'recognized-check', execution, source: 'command-wrapper',
        provenance: 'chamber.verify.exit-status-v1', limitation: result.signal ? 'terminated-by-signal' : undefined
      },
      task_classification: persistedTaskClass(history)
    },
    vendor: { hook_event_name: 'ChamberVerify' }
  });
  await store.append({ kind: 'verification', event, policy_decision: { action: 'observe' } });
  process.exitCode = result.code ?? 1;
}

async function correlate() {
  const sessionId = option('--session-id');
  if (!sessionId) throw new Error('correlate requires --session-id');
  const correlation = normalizeCorrelation({ source_kind: option('--source-kind'), source_id: option('--source-id'), source_revision: option('--source-revision') }, { defaultProvenance: 'operator.correlate-v1' });
  const store = new TraceStore(stateDir()); const history = await store.query({ sessionId }); const exemplar = history.at(-1)?.event;
  if (!exemplar) throw new Error('correlate requires an existing session trace');
  const existing = eventCorrelations(history).find((candidate) => correlationKey(candidate) === correlationKey(correlation));
  if (existing) {
    if (!sameCorrelation(existing, correlation)) throw new Error('conflicting_correlation: source revision differs for the existing source');
    return output({ recorded: false, idempotent: true, session_id: sessionId, correlation: existing });
  }
  if (eventCorrelations(history).length >= MAX_SESSION_CORRELATIONS) throw new Error('correlation_limit_reached: session correlation capacity is bounded');
  const event = createEvent({
    session_id: sessionId, lifecycle: 'session.link', host: exemplar.host, worker_profile: exemplar.worker_profile,
    payload: { correlation }, vendor: { hook_event_name: 'ChamberCorrelation' }
  });
  await store.append({ kind: 'correlation', event, policy_decision: { action: 'observe' } });
  output({ recorded: true, session_id: sessionId, correlation });
}

async function outcome() {
  let sessionId = option('--session-id'); const status = option('--status');
  const correlationId = option('--correlation-id'); const correlationKind = option('--correlation-kind');
  const selectors = [Boolean(sessionId), has('--latest-unlabeled'), correlationId !== undefined].filter(Boolean).length;
  if (selectors > 1) throw new Error('outcome accepts one session selector');
  if (correlationKind !== undefined && correlationId === undefined) throw new Error('outcome --correlation-kind requires --correlation-id');
  if (!['accepted', 'rejected', 'unknown'].includes(status)) throw new Error('outcome status must be accepted, rejected, or unknown');
  const producer = normalizeProducer(option('--producer', 'operator'));
  const source = createOutcomeSource({
    producer,
    sourceKind: option('--source-kind'), sourceId: option('--source-id'), sourceRevision: option('--source-revision')
  });
  if (!['operator', 'user-approval'].includes(producer) && !source) throw new Error('external outcome producer requires --source-kind and --source-id');
  const provenance = outcomeProvenance(producer);
  const store = new TraceStore(stateDir());
  const all = await store.query({ limit: Infinity });
  if (has('--latest-unlabeled')) {
    const bySession = new Map();
    for (const record of all) bySession.set(record.event?.session_id, [...(bySession.get(record.event?.session_id) ?? []), record]);
    const candidates = [...bySession.entries()]
      .filter(([id, records]) => id && !records.some((record) => record.event?.lifecycle === 'outcome'))
      .map(([id, records]) => ({ id, timestamps: records.map((record) => Date.parse(record.event?.occurred_at)) }));
    if (!candidates.length) return output({ status: 'no_unlabeled_sessions', session_ids: [] });
    if (candidates.some((candidate) => candidate.timestamps.some((timestamp) => !Number.isFinite(timestamp)))) {
      return output({ status: 'selection_required', session_ids: candidates.map((candidate) => candidate.id).sort().slice(0, MAX_SELECTION_CANDIDATES) });
    }
    const latest = candidates.map((candidate) => ({ ...candidate, timestamp: Math.max(...candidate.timestamps) }));
    const maximum = Math.max(...latest.map((candidate) => candidate.timestamp));
    const newest = latest.filter((candidate) => candidate.timestamp === maximum);
    if (newest.length !== 1) return output({ status: 'selection_required', session_ids: newest.map((candidate) => candidate.id).sort().slice(0, MAX_SELECTION_CANDIDATES) });
    sessionId = newest[0].id;
  }
  if (correlationId !== undefined) {
    const matches = correlatedSessionIds(all, { sourceKind: correlationKind, sourceId: correlationId });
    if (!matches.length) return output({ status: 'no_correlated_sessions', source_id: correlationId, source_kind: correlationKind ?? null, session_ids: [] });
    if (matches.length > 1) return output({ status: 'selection_required', session_ids: matches.slice(0, MAX_SELECTION_CANDIDATES) });
    sessionId = matches[0];
  }
  if (!sessionId) throw new Error('outcome requires --session-id, --latest-unlabeled, or --correlation-id');
  const history = await store.query({ sessionId }); const exemplar = history.at(-1)?.event;
  if (!exemplar) throw new Error('outcome requires an existing session trace');
  const prior = history.filter((record) => record.event?.lifecycle === 'outcome').map((record) => record.event);
  if (prior.length) {
    const previous = prior.at(-1);
    if (previous.payload?.status === status && previous.payload?.outcome_provenance === provenance
      && sameOutcomeSource(previous.payload?.outcome_source, source)) {
      const response = { recorded: false, idempotent: true, session_id: sessionId, status, provenance };
      if (source) response.source = source.correlation;
      return output(response);
    }
    throw new Error('conflicting_acceptance_evidence: use an explicit future replacement contract');
  }
  const payload = {
    status, outcome_provenance: provenance, task_classification: persistedTaskClass(history)
  };
  if (source) payload.outcome_source = source;
  const event = createEvent({
    session_id: sessionId, lifecycle: 'outcome', host: exemplar.host, worker_profile: exemplar.worker_profile,
    payload,
    vendor: { hook_event_name: 'ChamberOutcome' }
  });
  await store.append({ kind: 'outcome', event, policy_decision: { action: 'observe' } });
  const response = { recorded: true, session_id: sessionId, status, provenance };
  if (source) response.source = source.correlation;
  output(response);
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

async function doctor() {
  const store = new TraceStore(stateDir()); const records = await store.query({ limit: Infinity });
  return output({ state_dir: store.stateDir, trace_records: records.length, distinct_session_count: new Set(records.map((record) => record.event?.session_id).filter(Boolean)).size, policy_mode: process.env.CHAMBER_MODE ?? DEFAULT_POLICY_PROFILE.mode, codex_hook: await inspectCodexHookRegistration({ configDir: option('--config-dir') }), adapters: listAdapters().map((adapter) => adapter.id) });
}

async function migrate() {
  const from = option('--from'); if (!from) throw new Error('migrate requires --from');
  return output(await new TraceStore(stateDir()).migrateFrom(resolve(from)));
}

async function main() {
  const command = args[0];
  if (!command || has('--help')) return usage();
  if (command === 'hosts') return output(listAdapters().map((adapter) => ({ id: adapter.id, revision: adapter.revision, capabilities: 'event-conditioned; use event_capabilities', event_capabilities: adapter.eventCapabilities })));
  if (command === 'doctor') return doctor();
  if (command === 'trace') return output(await new TraceStore(stateDir()).query({ sessionId: option('--session-id'), limit: Number(option('--limit', '100')) }));
  if (command === 'evidence') { const store = new TraceStore(stateDir()); return output(evidenceSelection(await store.query({ sessionId: option('--session-id'), limit: Infinity }), option('--session-id'))); }
  if (command === 'summary' || command === 'dogfood') return output(traceSummary(await new TraceStore(stateDir()).query({ limit: Infinity })));
  if (command === 'correlate') return correlate();
  if (command === 'migrate') return migrate();
  if (command === 'outcome') return outcome();
  if (command === 'verify') return verify();
  if (command === 'normalize') return normalize();
  if (command === 'hook') return hook();
  if (command === 'install') return install(false);
  if (command === 'uninstall') return install(true);
  if (command === 'demo') return demo();
  usage(); process.exitCode = 1;
}
main().catch((error) => { console.error(`chamber: ${error.message}`); process.exitCode = 1; });
