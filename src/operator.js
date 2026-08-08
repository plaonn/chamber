import { readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

function hookCommands(value) {
  if (Array.isArray(value)) return value.flatMap(hookCommands);
  if (!value || typeof value !== 'object') return [];
  return [value.command, ...Object.values(value).flatMap(hookCommands)].filter((command) => typeof command === 'string');
}

function executablePath(command, homeDirectory) {
  const match = command.match(/\bnode\s+(['"]?)([^'"\s]+\.js)\1/);
  return match?.[2]?.replace(/^\$HOME(?=\/)/, homeDirectory);
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
    return { registration: 'registered', entrypoint: 'registered' };
  } catch {
    return { registration: 'registered', entrypoint: 'absent' };
  }
}
