import { capabilities } from '../capabilities.js';

export function createAdapter({ id, revision, capabilityValues, capabilitiesFor, adapterCapabilitiesFor, eventCapabilities, normalize, response }) {
  return {
    id,
    revision,
    capabilities: capabilities(capabilityValues),
    capabilitiesFor: capabilitiesFor ?? (() => capabilities(capabilityValues)),
    adapterCapabilitiesFor: adapterCapabilitiesFor ?? capabilitiesFor ?? (() => capabilities(capabilityValues)),
    eventCapabilities: eventCapabilities ?? {},
    normalize,
    toHostResponse: response
  };
}
