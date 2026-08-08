#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = new URL('..', import.meta.url).pathname;
const chamber = new URL('../bin/chamber.js', import.meta.url).pathname;
const project = await mkdtemp(join(tmpdir(), 'chamber-gemini-native-smoke-'));
const stateDir = join(project, 'state');
const hookCommand = `${JSON.stringify(process.execPath)} ${JSON.stringify(chamber)} hook --host gemini`;
const settings = {
  hooks: {
    BeforeAgent: [{ matcher: '*', hooks: [{ name: 'chamber-audit-before', type: 'command', command: hookCommand }] }],
    AfterAgent: [{ matcher: '*', hooks: [{ name: 'chamber-audit-after', type: 'command', command: hookCommand }] }]
  }
};

try {
  await mkdir(join(project, '.gemini'), { recursive: true });
  await writeFile(join(project, '.gemini', 'settings.json'), `${JSON.stringify(settings, null, 2)}\n`);
  await writeFile(join(project, 'README.md'), '# disposable Chamber Gemini smoke\n');
  await exec('gemini', ['--yolo', '--output-format', 'json', '--prompt', 'Reply exactly: Chamber native smoke.'], {
    cwd: project,
    env: { ...process.env, CHAMBER_STATE_DIR: stateDir, CHAMBER_MODE: 'audit' },
    timeout: 120000,
    maxBuffer: 1024 * 1024
  });
  const trace = JSON.parse((await exec(process.execPath, [chamber, 'trace', '--state-dir', stateDir])).stdout);
  const evidence = JSON.parse((await exec(process.execPath, [chamber, 'evidence', '--state-dir', stateDir])).stdout);
  const names = trace.map((entry) => entry.event.vendor.hook_event_name);
  if (!names.includes('BeforeAgent') || !names.includes('AfterAgent')) throw new Error(`missing expected events: ${names.join(', ')}`);
  const persisted = await readFile(join(stateDir, 'trace.jsonl'), 'utf8');
  if (persisted.includes('Chamber native smoke')) throw new Error('prompt leaked to persisted trace');
  process.stdout.write(`${JSON.stringify({ result: 'passed', native_events: names, evidence, global_config_modified: false }, null, 2)}\n`);
} finally {
  await rm(project, { recursive: true, force: true });
}
