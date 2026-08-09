#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = new URL('..', import.meta.url).pathname;
const chamber = new URL('../bin/chamber.js', import.meta.url).pathname;
const project = await mkdtemp(join(tmpdir(), 'chamber-codex-native-smoke-'));
const codexHome = join(project, 'codex-home');
const stateDir = join(project, 'state');
const hookCommand = `${JSON.stringify(process.execPath)} ${JSON.stringify(chamber)} hook --host codex`;
const settings = {
  hooks: Object.fromEntries(['PreToolUse', 'PostToolUse', 'Stop'].map((event) => [event, [{ hooks: [{ type: 'command', command: hookCommand, timeout: 30 }] }]]))
};

try {
  await mkdir(codexHome, { recursive: true });
  await writeFile(join(codexHome, 'hooks.json'), `${JSON.stringify(settings, null, 2)}\n`);
  await writeFile(join(project, 'package.json'), JSON.stringify({ scripts: { test: 'exit 0' } }));
  await exec('codex', [
    'exec', '--skip-git-repo-check', '--ephemeral', '--sandbox', 'workspace-write', '--dangerously-bypass-hook-trust',
    'Run exactly `npm test` using the Bash tool in the current directory. Do not edit files. After it exits, stop.'
  ], {
    cwd: project,
    env: { ...process.env, CODEX_HOME: codexHome, CHAMBER_STATE_DIR: stateDir, CHAMBER_CAPTURE_VERIFICATION: '1' },
    timeout: 120000,
    maxBuffer: 1024 * 1024
  });
  const records = (await readFile(join(stateDir, 'trace.jsonl'), 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
  const captured = records.find((record) => record.event?.vendor?.hook_event_name === 'ChamberVerify');
  if (captured?.event?.payload?.verification?.execution !== 'passed') throw new Error('missing passed ChamberVerify event');
  const persisted = JSON.stringify(records);
  if (persisted.includes('Run exactly') || persisted.includes('npm test')) throw new Error('prompt or command leaked to persisted trace');
  process.stdout.write(`${JSON.stringify({ result: 'passed', verification: 'passed', global_config_modified: false }, null, 2)}\n`);
} finally {
  await rm(project, { recursive: true, force: true });
}
