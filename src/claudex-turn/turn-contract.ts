export const claudexProviders = ['claude', 'codex'] as const;
export const claudexRequestedProviders = ['claude', 'codex', 'auto'] as const;
export const claudexTurnOutcomes = ['completed', 'needs_input', 'failed'] as const;
export const claudexTurnFailureKinds = [
  'readiness_failed',
  'turn_failed',
  'timeout',
  'aborted',
  'runtime_error'
] as const;

export type ClaudexProvider = (typeof claudexProviders)[number];
export type ClaudexRequestedProvider = (typeof claudexRequestedProviders)[number];
export type ClaudexTurnOutcome = (typeof claudexTurnOutcomes)[number];
export type ClaudexTurnFailureKind = (typeof claudexTurnFailureKinds)[number];

export interface ClaudexSessionRef {
  provider: ClaudexProvider;
  sessionId: string;
}

export interface ClaudexArtifactRef {
  artifactId: string;
  kind: string;
  path: string;
  createdAt: string;
}

export interface ClaudexTurnRequest {
  objective: string;
  provider: ClaudexRequestedProvider;
  workingDirectory: string;
  turnNumber: number;
  priorSessionRef?: ClaudexSessionRef;
  priorSummary?: string;
  humanInput?: string;
}

export interface ClaudexTurnFailure {
  kind: ClaudexTurnFailureKind;
  message: string;
  code?: string;
  timeoutMs?: number;
}

interface ClaudexTurnResponseBase {
  requestedProvider: ClaudexRequestedProvider;
  text: string;
  artifactRefs: ClaudexArtifactRef[];
  sessionRef?: ClaudexSessionRef;
}

interface ClaudexTurnSuccessfulResponseBase extends ClaudexTurnResponseBase {
  provider: ClaudexProvider;
}

interface ClaudexTurnFailedResponseBase extends ClaudexTurnResponseBase {
  provider?: ClaudexProvider;
}

export interface ClaudexTurnCompletedResponse extends ClaudexTurnSuccessfulResponseBase {
  outcome: 'completed';
}

export interface ClaudexTurnNeedsInputResponse extends ClaudexTurnSuccessfulResponseBase {
  outcome: 'needs_input';
  waitingReason: string;
}

export interface ClaudexTurnFailedResponse extends ClaudexTurnFailedResponseBase {
  outcome: 'failed';
  errorMessage: string;
  failure: ClaudexTurnFailure;
}

export type ClaudexTurnResponse =
  | ClaudexTurnCompletedResponse
  | ClaudexTurnNeedsInputResponse
  | ClaudexTurnFailedResponse;

export interface BuildFailedTurnResponseOptions {
  requestedProvider: ClaudexRequestedProvider;
  errorMessage: string;
  failure: ClaudexTurnFailure;
  provider?: ClaudexProvider;
  sessionRef?: ClaudexSessionRef;
  artifactRefs?: ClaudexArtifactRef[];
  text?: string;
}

export function buildFailedTurnResponse({
  requestedProvider,
  errorMessage,
  failure,
  provider,
  sessionRef,
  artifactRefs = [],
  text = ''
}: BuildFailedTurnResponseOptions): ClaudexTurnFailedResponse {
  return {
    requestedProvider,
    provider,
    outcome: 'failed',
    text,
    artifactRefs,
    sessionRef,
    errorMessage,
    failure
  };
}

export function resolveProviderHint(
  requestedProvider: ClaudexRequestedProvider
): ClaudexProvider | undefined {
  return requestedProvider === 'auto' ? undefined : requestedProvider;
}
