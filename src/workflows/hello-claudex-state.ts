import {
  defaultHelloClaudexProvider,
  helloClaudexRequestedProviders,
  type CancelRunSignal,
  type HelloClaudexInput,
  type HelloClaudexInputCandidate,
  type HelloClaudexPendingHumanInput,
  type HelloClaudexRequestedProvider,
  type HelloClaudexResult,
  type HelloClaudexState,
  type HelloClaudexStatus,
  type HelloClaudexTerminalStatus,
  type ResolveHelloClaudexInputOptions,
  type SubmitHumanInputSignal
} from './hello-claudex-contract.js';

export function resolveHelloClaudexInput(
  input: HelloClaudexInputCandidate,
  {
    defaultProvider = defaultHelloClaudexProvider,
    defaultWorkingDirectory
  }: ResolveHelloClaudexInputOptions = {}
): HelloClaudexInput {
  const objective = trimRequiredString(input.objective, 'objective');
  const provider = input.provider ?? defaultProvider;
  const workingDirectory = trimRequiredString(
    input.workingDirectory ?? defaultWorkingDirectory,
    'workingDirectory'
  );

  assertRequestedProvider(provider, 'provider');

  return {
    objective,
    provider,
    workingDirectory
  };
}

export function createInitialHelloClaudexState(
  input: HelloClaudexInput,
  workflowId: string
): HelloClaudexState {
  const resolvedInput = resolveHelloClaudexInput(input);

  return {
    workflowId: trimRequiredString(workflowId, 'workflowId'),
    status: 'running',
    objective: resolvedInput.objective,
    requestedProvider: resolvedInput.provider,
    workingDirectory: resolvedInput.workingDirectory,
    turnCount: 0,
    humanInputCount: 0,
    artifactRefs: []
  };
}

export function normalizeSubmitHumanInputSignal(
  signal: unknown
): HelloClaudexPendingHumanInput {
  if (!isRecord(signal)) {
    throw new TypeError('submitHumanInput signal must be a JSON object.');
  }

  const text = trimRequiredString(signal.text, 'submitHumanInput.text');
  const correlationId = trimOptionalString(
    signal.correlationId,
    'submitHumanInput.correlationId'
  );

  return correlationId === undefined ? { text } : { text, correlationId };
}

export function normalizeCancelRunSignal(signal: unknown = {}): CancelRunSignal {
  if (!isRecord(signal)) {
    throw new TypeError('cancelRun signal must be a JSON object when present.');
  }

  const reason = trimOptionalString(signal.reason, 'cancelRun.reason');

  return reason === undefined ? {} : { reason };
}

export function tryNormalizeSubmitHumanInputSignal(
  signal: unknown
): HelloClaudexSignalPayloadResult<HelloClaudexPendingHumanInput> {
  return tryNormalizeSignalPayload(() => normalizeSubmitHumanInputSignal(signal));
}

export function tryNormalizeCancelRunSignal(
  signal: unknown
): HelloClaudexSignalPayloadResult<CancelRunSignal> {
  return tryNormalizeSignalPayload(() => normalizeCancelRunSignal(signal));
}

export function isTerminalHelloClaudexStatus(
  status: HelloClaudexStatus
): status is HelloClaudexTerminalStatus {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

export function buildHelloClaudexResult(state: HelloClaudexState): HelloClaudexResult {
  if (!isTerminalHelloClaudexStatus(state.status)) {
    throw new TypeError(
      `Cannot build hello Claudex result for non-terminal status "${state.status}".`
    );
  }

  const result: HelloClaudexResult = {
    workflowId: state.workflowId,
    status: state.status,
    objective: state.objective,
    requestedProvider: state.requestedProvider,
    workingDirectory: state.workingDirectory,
    turnCount: state.turnCount,
    artifactRefs: state.artifactRefs
  };

  if (state.provider !== undefined) {
    result.provider = state.provider;
  }

  if (state.latestText !== undefined) {
    result.latestText = state.latestText;
  }

  if (state.latestSummary !== undefined) {
    result.latestSummary = state.latestSummary;
  }

  if (state.sessionRef !== undefined) {
    result.sessionRef = state.sessionRef;
  }

  if (state.lastError !== undefined) {
    result.lastError = state.lastError;
  }

  if (state.cancelReason !== undefined) {
    result.cancelReason = state.cancelReason;
  }

  return result;
}

export function trimRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new TypeError(`${fieldName} must be a non-empty string.`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new TypeError(`${fieldName} must be a non-empty string.`);
  }

  return trimmed;
}

function assertRequestedProvider(
  value: unknown,
  fieldName: string
): asserts value is HelloClaudexRequestedProvider {
  if (
    typeof value !== 'string' ||
    !helloClaudexRequestedProviders.includes(value as HelloClaudexRequestedProvider)
  ) {
    throw new TypeError(
      `${fieldName} must be one of ${helloClaudexRequestedProviders.join(', ')}.`
    );
  }
}

function trimOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return trimRequiredString(value, fieldName);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export type HelloClaudexSignalPayloadResult<T> =
  | {
      valid: true;
      value: T;
    }
  | {
      valid: false;
      errorMessage: string;
    };

function tryNormalizeSignalPayload<T>(normalize: () => T): HelloClaudexSignalPayloadResult<T> {
  try {
    return {
      valid: true,
      value: normalize()
    };
  } catch (error: unknown) {
    return {
      valid: false,
      errorMessage: getErrorMessage(error)
    };
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
