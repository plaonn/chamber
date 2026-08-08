import { codexAdapter } from './codex.js';
import { geminiAdapter } from './gemini.js';

const adapters = { codex: codexAdapter, gemini: geminiAdapter };
export function getAdapter(id) { if (!adapters[id]) throw new Error(`unsupported host: ${id}`); return adapters[id]; }
export function listAdapters() { return Object.values(adapters); }
