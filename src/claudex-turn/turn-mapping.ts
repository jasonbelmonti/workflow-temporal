import {
  type ProviderReadiness,
  type SessionOptions,
  type SessionReference,
  type TurnInput,
  type TurnResult
} from '@jasonbelmonti/claudex';

import {
  buildFailedTurnResponse,
  claudexProviders,
  type ClaudexArtifactRef,
  type ClaudexProvider,
  type ClaudexSessionRef,
  type ClaudexTurnRequest,
  type ClaudexTurnResponse
} from './turn-contract.js';

const needsInputStopReasons = new Set([
  'needs_input',
  'input_required',
  'approval_required',
  'waiting_for_input'
]);

export function buildSessionOptions(
  request: ClaudexTurnRequest,
  sessionOptions: Omit<SessionOptions, 'workingDirectory'> | undefined
): SessionOptions {
  return {
    executionMode: 'plan',
    approvalMode: 'deny',
    ...sessionOptions,
    workingDirectory: request.workingDirectory,
    metadata: {
      ...sessionOptions?.metadata,
      requestedProvider: request.provider,
      turnNumber: request.turnNumber
    }
  };
}

export function buildTurnInput(request: ClaudexTurnRequest): TurnInput {
  const promptSections = [
    `Objective:\n${request.objective}`,
    `Turn number:\n${request.turnNumber}`
  ];

  if (request.priorSummary) {
    promptSections.push(`Prior summary:\n${request.priorSummary}`);
  }

  if (request.humanInput) {
    promptSections.push(`Human input:\n${request.humanInput}`);
  }

  return {
    prompt: promptSections.join('\n\n'),
    metadata: {
      requestedProvider: request.provider,
      turnNumber: request.turnNumber
    }
  };
}

export function normalizeTurnResult(
  request: ClaudexTurnRequest,
  result: TurnResult,
  sessionReference: SessionReference | null
): ClaudexTurnResponse {
  const provider = normalizeProvider(result.provider, 'result.provider');
  const sessionRef = normalizeClaudexSessionRef(result.session ?? sessionReference, provider);
  const text = normalizeResultText(result.text);
  const artifactRefs = normalizeArtifactRefs(result.extensions?.artifactRefs);
  const waitingReason = resolveWaitingReason(result);

  if (waitingReason) {
    return {
      requestedProvider: request.provider,
      provider,
      outcome: 'needs_input',
      text,
      artifactRefs,
      sessionRef,
      waitingReason
    };
  }

  return {
    requestedProvider: request.provider,
    provider,
    outcome: 'completed',
    text,
    artifactRefs,
    sessionRef
  };
}

export function buildReadinessFailureResponse(
  request: ClaudexTurnRequest,
  readiness: ProviderReadiness
): ClaudexTurnResponse {
  return buildFailedTurnResponse({
    requestedProvider: request.provider,
    provider: readiness.provider,
    errorMessage: `Claudex provider ${readiness.provider} is not ready: ${readiness.status}.`,
    failure: {
      kind: 'readiness_failed',
      code: readiness.status,
      message: formatReadinessFailure(readiness)
    }
  });
}

function resolveWaitingReason(result: TurnResult): string | undefined {
  const extensionReason = getStringExtension(result.extensions, 'waitingReason');

  if (getBooleanExtension(result.extensions, 'needsInput')) {
    return extensionReason ?? 'Claudex turn is waiting for human input.';
  }

  const stopReason = result.stopReason?.toLowerCase();

  if (stopReason && needsInputStopReasons.has(stopReason)) {
    return extensionReason ?? `Claudex turn stopped for ${stopReason}.`;
  }

  return undefined;
}

export function normalizeClaudexSessionRef(
  reference: SessionReference | null | undefined,
  expectedProvider?: ClaudexProvider
): ClaudexSessionRef | undefined {
  if (!reference) {
    return undefined;
  }

  const provider = normalizeProvider(reference.provider, 'sessionRef.provider');

  if (expectedProvider && provider !== expectedProvider) {
    throw new TypeError(`sessionRef.provider must match expected provider ${expectedProvider}.`);
  }

  if (typeof reference.sessionId !== 'string' || reference.sessionId.trim().length === 0) {
    throw new TypeError('sessionRef.sessionId must be a non-empty string.');
  }

  return {
    provider,
    sessionId: reference.sessionId
  };
}

function normalizeResultText(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TypeError('result.text must be a string.');
  }

  return value;
}

function normalizeArtifactRefs(value: unknown): ClaudexArtifactRef[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new TypeError('result.extensions.artifactRefs must be an array when present.');
  }

  return value.map(normalizeArtifactRef);
}

function normalizeArtifactRef(value: unknown): ClaudexArtifactRef {
  if (!isRecord(value)) {
    throw new TypeError('result.extensions.artifactRefs entries must be JSON objects.');
  }

  return {
    artifactId: normalizeNonEmptyString(
      value.artifactId,
      'result.extensions.artifactRefs[].artifactId'
    ),
    kind: normalizeNonEmptyString(value.kind, 'result.extensions.artifactRefs[].kind'),
    path: normalizeNonEmptyString(value.path, 'result.extensions.artifactRefs[].path'),
    createdAt: normalizeNonEmptyString(
      value.createdAt,
      'result.extensions.artifactRefs[].createdAt'
    )
  };
}

function formatReadinessFailure(readiness: ProviderReadiness): string {
  const failedChecks = readiness.checks
    .filter((check) => check.status === 'fail')
    .map((check) => check.summary);

  if (failedChecks.length === 0) {
    return `Provider status was ${readiness.status}.`;
  }

  return failedChecks.join('; ');
}

function getBooleanExtension(
  extensions: Record<string, unknown> | undefined,
  key: string
): boolean {
  return extensions?.[key] === true;
}

function getStringExtension(
  extensions: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  const value = extensions?.[key];

  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeProvider(value: unknown, fieldName: string): ClaudexProvider {
  if (typeof value !== 'string' || !claudexProviders.includes(value as ClaudexProvider)) {
    throw new TypeError(`${fieldName} must be one of ${claudexProviders.join(', ')}.`);
  }

  return value as ClaudexProvider;
}

function normalizeNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string.`);
  }

  return value;
}
