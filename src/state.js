import { homedir, platform } from 'node:os';
import { resolve, join } from 'node:path';

export function defaultStateDir({ homeDirectory = homedir(), operatingSystem = platform(), environment = process.env } = {}) {
  if (operatingSystem === 'darwin') return join(homeDirectory, 'Library', 'Application Support', 'Chamber');
  if (operatingSystem === 'win32') return join(environment.APPDATA ?? join(homeDirectory, 'AppData', 'Roaming'), 'Chamber');
  return join(environment.XDG_STATE_HOME ?? join(homeDirectory, '.local', 'state'), 'chamber');
}

export function resolveStateDir({ explicitStateDir, environment = process.env, ...options } = {}) {
  return resolve(environment.CHAMBER_STATE_DIR ?? explicitStateDir ?? defaultStateDir({ environment, ...options }));
}
