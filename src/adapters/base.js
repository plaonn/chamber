import { capabilities } from '../capabilities.js';

export function createAdapter({ id, revision, capabilityValues, normalize, response }) {
  return {
    id,
    revision,
    capabilities: capabilities(capabilityValues),
    normalize,
    toHostResponse: response
  };
}
