import {
  claudexProviders,
  claudexRequestedProviders,
  claudexTurnFailureKinds,
  claudexTurnOutcomes,
  type ClaudexArtifactRef,
  type ClaudexProvider,
  type ClaudexRequestedProvider,
  type ClaudexSessionRef,
  type ClaudexTurnFailure,
  type ClaudexTurnFailureKind,
  type ClaudexTurnOutcome,
  type ClaudexTurnRequest,
  type ClaudexTurnResponse
} from './turn-contract.js';

export function serializeClaudexTurnRequest(request: ClaudexTurnRequest): string {
  assertValidClaudexTurnRequest(request);

  return JSON.stringify(request);
}

export function parseClaudexTurnRequest(payload: string): ClaudexTurnRequest {
  const parsed = parseJsonPayload(payload, 'request');
  assertValidClaudexTurnRequest(parsed);

  return parsed;
}

export function parseClaudexTurnResponse(payload: string): ClaudexTurnResponse {
  const parsed = parseJsonPayload(payload, 'response');
  assertValidClaudexTurnResponse(parsed);

  return parsed;
}

function parseJsonPayload(payload: string, label: 'request' | 'response'): unknown {
  const trimmed = payload.trim();

  if (!trimmed) {
    throw new TypeError(`Claudex turn ${label} payload was empty.`);
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch (error: unknown) {
    throw new TypeError(
      `Claudex turn ${label} payload was not valid JSON: ${getErrorMessage(error)}`
    );
  }
}

export function assertValidClaudexTurnRequest(
  value: unknown
): asserts value is ClaudexTurnRequest {
  if (!isRecord(value)) {
    throw new TypeError('Claudex turn request must be a JSON object.');
  }

  assertNonEmptyString(value.objective, 'objective');
  assertRequestedProvider(value.provider, 'provider');
  assertNonEmptyString(value.workingDirectory, 'workingDirectory');

  const turnNumber = value.turnNumber;

  if (typeof turnNumber !== 'number' || !Number.isInteger(turnNumber) || turnNumber < 1) {
    throw new TypeError('turnNumber must be an integer greater than or equal to 1.');
  }

  assertOptionalSessionRef(value.priorSessionRef, 'priorSessionRef');
  assertOptionalString(value.priorSummary, 'priorSummary');
  assertOptionalString(value.humanInput, 'humanInput');
}

function assertValidClaudexTurnResponse(
  value: unknown
): asserts value is ClaudexTurnResponse {
  if (!isRecord(value)) {
    throw new TypeError('Claudex turn response must be a JSON object.');
  }

  assertRequestedProvider(value.requestedProvider, 'requestedProvider');
  assertTurnOutcome(value.outcome, 'outcome');
  assertString(value.text, 'text');
  assertArtifactRefs(value.artifactRefs);
  assertOptionalSessionRef(value.sessionRef, 'sessionRef');

  if (value.outcome === 'needs_input') {
    assertProvider(value.provider, 'provider');
    assertNonEmptyString(value.waitingReason, 'waitingReason');
    return;
  }

  if (value.outcome === 'failed') {
    assertOptionalProvider(value.provider, 'provider');
    assertString(value.errorMessage, 'errorMessage');
    assertTurnFailure(value.failure);
    return;
  }

  assertProvider(value.provider, 'provider');
}

function assertTurnFailure(value: unknown): asserts value is ClaudexTurnFailure {
  if (!isRecord(value)) {
    throw new TypeError('failure must be a JSON object.');
  }

  assertFailureKind(value.kind, 'failure.kind');
  assertString(value.message, 'failure.message');
  assertOptionalString(value.code, 'failure.code');

  const timeoutMs = value.timeoutMs;

  if (timeoutMs !== undefined && timeoutMs !== null) {
    if (typeof timeoutMs !== 'number' || !Number.isInteger(timeoutMs) || timeoutMs < 1) {
      throw new TypeError('failure.timeoutMs must be a positive integer when present.');
    }
  }

  if (timeoutMs === null) {
    throw new TypeError('failure.timeoutMs must be a positive integer when present.');
  }
}

function assertArtifactRefs(value: unknown): asserts value is ClaudexArtifactRef[] {
  if (!Array.isArray(value)) {
    throw new TypeError('artifactRefs must be an array.');
  }

  for (const artifactRef of value) {
    if (!isRecord(artifactRef)) {
      throw new TypeError('artifactRefs entries must be JSON objects.');
    }

    assertNonEmptyString(artifactRef.artifactId, 'artifactRefs[].artifactId');
    assertNonEmptyString(artifactRef.kind, 'artifactRefs[].kind');
    assertNonEmptyString(artifactRef.path, 'artifactRefs[].path');
    assertNonEmptyString(artifactRef.createdAt, 'artifactRefs[].createdAt');
  }
}

function assertOptionalSessionRef(
  value: unknown,
  fieldName: string
): asserts value is ClaudexSessionRef | undefined {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    throw new TypeError(`${fieldName} must be a JSON object when present.`);
  }

  assertProvider(value.provider, `${fieldName}.provider`);
  assertNonEmptyString(value.sessionId, `${fieldName}.sessionId`);
}

function assertRequestedProvider(
  value: unknown,
  fieldName: string
): asserts value is ClaudexRequestedProvider {
  if (
    typeof value !== 'string' ||
    !claudexRequestedProviders.includes(value as ClaudexRequestedProvider)
  ) {
    throw new TypeError(
      `${fieldName} must be one of ${claudexRequestedProviders.join(', ')}.`
    );
  }
}

function assertProvider(value: unknown, fieldName: string): asserts value is ClaudexProvider {
  if (typeof value !== 'string' || !claudexProviders.includes(value as ClaudexProvider)) {
    throw new TypeError(`${fieldName} must be one of ${claudexProviders.join(', ')}.`);
  }
}

function assertOptionalProvider(
  value: unknown,
  fieldName: string
): asserts value is ClaudexProvider | undefined {
  if (value === undefined) {
    return;
  }

  assertProvider(value, fieldName);
}

function assertTurnOutcome(value: unknown, fieldName: string): asserts value is ClaudexTurnOutcome {
  if (typeof value !== 'string' || !claudexTurnOutcomes.includes(value as ClaudexTurnOutcome)) {
    throw new TypeError(`${fieldName} must be one of ${claudexTurnOutcomes.join(', ')}.`);
  }
}

function assertFailureKind(
  value: unknown,
  fieldName: string
): asserts value is ClaudexTurnFailureKind {
  if (
    typeof value !== 'string' ||
    !claudexTurnFailureKinds.includes(value as ClaudexTurnFailureKind)
  ) {
    throw new TypeError(
      `${fieldName} must be one of ${claudexTurnFailureKinds.join(', ')}.`
    );
  }
}

function assertString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new TypeError(`${fieldName} must be a string.`);
  }
}

function assertNonEmptyString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string.`);
  }
}

function assertOptionalString(
  value: unknown,
  fieldName: string
): asserts value is string | undefined {
  if (value === undefined) {
    return;
  }

  assertString(value, fieldName);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
