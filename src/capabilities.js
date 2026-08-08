import { CAPABILITY_KEYS } from './constants.js';

export function capabilities(values = {}) {
  return Object.fromEntries(CAPABILITY_KEYS.map((key) => [key, values[key] === true]));
}

export function unsupported(required, available) {
  return required.filter((key) => available[key] !== true);
}
