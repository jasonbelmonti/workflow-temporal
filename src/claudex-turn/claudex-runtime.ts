import {
  ClaudexAdapter,
  type AgentSession,
  type ProviderReadiness,
  type SessionOptions,
  type SessionReference
} from '@jasonbelmonti/claudex';

import type { ClaudexTurnRequest } from './turn-contract.js';

export interface ClaudexRuntimeAdapter {
  checkReadiness(): Promise<ProviderReadiness>;
  createSession(options?: SessionOptions): Promise<AgentSession>;
  resumeSession(reference: SessionReference, options?: SessionOptions): Promise<AgentSession>;
}

export function createDefaultClaudexAdapter(
  request: ClaudexTurnRequest
): ClaudexRuntimeAdapter {
  if (request.provider === 'auto' && request.priorSessionRef) {
    return new ClaudexAdapter({
      preferredProviders: [request.priorSessionRef.provider]
    });
  }

  if (request.provider === 'auto') {
    return new ClaudexAdapter();
  }

  return new ClaudexAdapter({ preferredProviders: [request.provider] });
}
