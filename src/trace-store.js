import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TRACE_SCHEMA_VERSION } from './constants.js';
import { redact } from './redaction.js';

export class TraceStore {
  constructor(stateDir = '.chamber') { this.stateDir = stateDir; this.file = join(stateDir, 'trace.jsonl'); }
  async append(record) {
    await mkdir(this.stateDir, { recursive: true });
    const envelope = { trace_schema_version: TRACE_SCHEMA_VERSION, recorded_at: new Date().toISOString(), ...redact(record) };
    await appendFile(this.file, `${JSON.stringify(envelope)}\n`, 'utf8');
    return envelope;
  }
  async query({ sessionId, limit = 100 } = {}) {
    try {
      const lines = (await readFile(this.file, 'utf8')).trim().split('\n').filter(Boolean);
      const records = lines.map((line) => JSON.parse(line)).filter((record) => !sessionId || record.event?.session_id === sessionId);
      return records.slice(-limit);
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }
}
