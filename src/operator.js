import { readFile, realpath, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function hookCommands(value) {
  if (Array.isArray(value)) return value.flatMap(hookCommands);
  if (!value || typeof value !== 'object') return [];
  return [value.command, ...Object.values(value).flatMap(hookCommands)].filter((command) => typeof command === 'string');
}

function executablePath(command, homeDirectory) {
  const match = command.match(/\bnode\s+(['"]?)([^'"\s]+\.js)\1/);
  return match?.[2]?.replace(/^\$HOME(?=\/)/, homeDirectory);
}

async function git(args) {
  try {
    const { stdout } = await execFileAsync('git', args, { encoding: 'utf8' });
    return { ok: true, stdout: stdout.trim() };
  } catch (error) {
    return { ok: false, code: error.code, stdout: error.stdout?.trim() ?? '' };
  }
}

async function runtimeFreshness(entrypoint) {
  let resolvedEntrypoint;
  try {
    resolvedEntrypoint = await realpath(entrypoint);
  } catch {
    return { freshness: 'unverified' };
  }
  const root = await git(['-C', dirname(resolvedEntrypoint), 'rev-parse', '--show-toplevel']);
  if (!root.ok || !root.stdout) return { freshness: 'unverified' };

  const runtimeRevision = await git(['-C', root.stdout, 'rev-parse', 'HEAD']);
  const comparisonRevision = await git(['-C', root.stdout, 'rev-parse', '--verify', 'refs/remotes/origin/main']);
  const identity = relative(root.stdout, resolvedEntrypoint) || 'entrypoint';
  if (!runtimeRevision.ok || !runtimeRevision.stdout) return { entrypoint_identity: identity, freshness: 'unverified' };

  const base = {
    entrypoint_identity: identity,
    runtime_revision: runtimeRevision.stdout,
    ...(comparisonRevision.ok && comparisonRevision.stdout ? { comparison_revision: comparisonRevision.stdout } : {})
  };
  const dirty = await git(['-C', root.stdout, 'status', '--porcelain']);
  if (!dirty.ok) return { ...base, freshness: 'unverified' };
  if (dirty.stdout) return { ...base, freshness: 'dirty' };
  if (!comparisonRevision.ok || !comparisonRevision.stdout) return { ...base, freshness: 'unverified' };
  if (runtimeRevision.stdout === comparisonRevision.stdout) return { ...base, freshness: 'current' };

  const runtimeBehind = await git(['-C', root.stdout, 'merge-base', '--is-ancestor', runtimeRevision.stdout, comparisonRevision.stdout]);
  if (runtimeBehind.ok) return { ...base, freshness: 'behind' };
  const runtimeAhead = await git(['-C', root.stdout, 'merge-base', '--is-ancestor', comparisonRevision.stdout, runtimeRevision.stdout]);
  if (runtimeAhead.ok) return { ...base, freshness: 'ahead' };
  return { ...base, freshness: 'diverged' };
}

export async function inspectCodexHookRegistration({ configDir = join(homedir(), '.codex'), homeDirectory = homedir() } = {}) {
  const path = join(configDir, 'hooks.json');
  let config;
  try {
    config = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    return { registration: error.code === 'ENOENT' ? 'absent' : 'unverified', entrypoint: 'unverified' };
  }
  const command = hookCommands(config).find((candidate) => /\bchamber(?:\s|$)|\/chamber\.js\b/i.test(candidate));
  if (!command) return { registration: 'absent', entrypoint: 'absent' };
  const entrypoint = executablePath(command, homeDirectory);
  if (!entrypoint) return { registration: 'registered', entrypoint: 'unverified' };
  try {
    await stat(entrypoint);
    return { registration: 'registered', entrypoint: 'registered', runtime_freshness: await runtimeFreshness(entrypoint) };
  } catch {
    return { registration: 'registered', entrypoint: 'absent' };
  }
}
