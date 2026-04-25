import {
  AgentError,
  isAgentError,
  type ProviderReadiness,
  type SessionOptions
} from '@jasonbelmonti/claudex';

import {
  buildFailedTurnResponse,
  resolveProviderHint,
  type ClaudexProvider,
  type ClaudexSessionRef,
  type ClaudexTurnFailure,
  type ClaudexTurnRequest,
  type ClaudexTurnResponse
} from './turn-contract.js';
import {
  createDefaultClaudexAdapter,
  type ClaudexRuntimeAdapter
} from './claudex-runtime.js';
import {
  RunnerAbortError,
  RunnerTimeoutError,
  runWithControls
} from './runner-controls.js';
import {
  buildReadinessFailureResponse,
  buildSessionOptions,
  buildTurnInput,
  normalizeClaudexSessionRef,
  normalizeTurnResult
} from './turn-mapping.js';
import { assertValidClaudexTurnRequest } from './turn-codec.js';

const defaultTimeoutMs = 10_000;

export interface RunClaudexTurnOptions {
  createAdapter?: (request: ClaudexTurnRequest) => ClaudexRuntimeAdapter;
  sessionOptions?: Omit<SessionOptions, 'workingDirectory'>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export async function runClaudexTurn(
  request: ClaudexTurnRequest,
  {
    createAdapter = createDefaultClaudexAdapter,
    sessionOptions,
    timeoutMs = defaultTimeoutMs,
    signal
  }: RunClaudexTurnOptions = {}
): Promise<ClaudexTurnResponse> {
  assertValidClaudexTurnRequest(request);

  const providerHint = resolveProviderHint(request.provider);
  let selectedProvider = providerHint;
  let selectedSessionRef: ClaudexSessionRef | undefined;

  if (signal?.aborted) {
    return buildRunnerFailureResponse(
      request,
      providerHint,
      undefined,
      'Claudex turn was aborted before it started.',
      {
        kind: 'aborted',
        message: 'Caller aborted before Claudex execution started.'
      }
    );
  }

  try {
    return await runWithControls(
      (turnSignal) =>
        executeClaudexTurn({
          request,
          adapter: createAdapter(request),
          sessionOptions,
          onProviderSelected: (provider) => {
            selectedProvider = provider;
          },
          onSessionStarted: (sessionRef) => {
            selectedSessionRef = sessionRef;
          },
          signal: turnSignal
        }),
      { signal, timeoutMs }
    );
  } catch (error: unknown) {
    if (error instanceof RunnerTimeoutError) {
      return buildRunnerFailureResponse(
        request,
        selectedProvider,
        selectedSessionRef,
        `Claudex turn timed out after ${timeoutMs} ms.`,
        {
          kind: 'timeout',
          message: 'Claudex execution exceeded the configured timeout.',
          timeoutMs
        }
      );
    }

    if (error instanceof RunnerAbortError) {
      return buildRunnerFailureResponse(
        request,
        selectedProvider,
        selectedSessionRef,
        'Claudex turn was aborted.',
        {
          kind: 'aborted',
          message: 'Caller aborted Claudex execution.'
        }
      );
    }

    if (isAgentError(error)) {
      return buildAgentFailureResponse(request, error, selectedSessionRef);
    }

    const message = getErrorMessage(error);

    return buildRunnerFailureResponse(
      request,
      selectedProvider,
      selectedSessionRef,
      `Claudex runtime failed: ${message}`,
      {
        kind: 'runtime_error',
        message
      }
    );
  }
}

async function executeClaudexTurn({
  request,
  adapter,
  sessionOptions,
  onProviderSelected,
  onSessionStarted,
  signal
}: {
  request: ClaudexTurnRequest;
  adapter: ClaudexRuntimeAdapter;
  sessionOptions?: Omit<SessionOptions, 'workingDirectory'>;
  onProviderSelected: (provider: ClaudexProvider) => void;
  onSessionStarted: (sessionRef: ClaudexSessionRef | undefined) => void;
  signal: AbortSignal;
}): Promise<ClaudexTurnResponse> {
  const readiness = await adapter.checkReadiness();

  if (!isRunnableProviderReadiness(readiness)) {
    return buildReadinessFailureResponse(request, readiness);
  }

  onProviderSelected(readiness.provider);

  const effectiveSessionOptions = buildSessionOptions(request, sessionOptions);
  const { session, resumeSessionRef } = await createOrResumeSession({
    adapter,
    request,
    sessionOptions: effectiveSessionOptions
  });
  const sessionRef = normalizeClaudexSessionRef(
    session.reference ?? resumeSessionRef,
    readiness.provider
  );

  onSessionStarted(sessionRef);

  const result = await session.run(buildTurnInput(request), {
    signal,
    metadata: {
      requestedProvider: request.provider,
      turnNumber: request.turnNumber
    }
  });

  return normalizeTurnResult(request, result, session.reference ?? sessionRef ?? null);
}

async function createOrResumeSession({
  adapter,
  request,
  sessionOptions
}: {
  adapter: ClaudexRuntimeAdapter;
  request: ClaudexTurnRequest;
  sessionOptions: SessionOptions;
}): Promise<{
  session: Awaited<ReturnType<ClaudexRuntimeAdapter['createSession']>>;
  resumeSessionRef?: ClaudexSessionRef;
}> {
  if (!request.priorSessionRef) {
    return {
      session: await adapter.createSession(sessionOptions)
    };
  }

  try {
    return {
      session: await adapter.resumeSession(request.priorSessionRef, sessionOptions),
      resumeSessionRef: request.priorSessionRef
    };
  } catch {
    return {
      session: await adapter.createSession(sessionOptions)
    };
  }
}

function buildAgentFailureResponse(
  request: ClaudexTurnRequest,
  error: AgentError,
  sessionRef: ClaudexSessionRef | undefined
): ClaudexTurnResponse {
  const kind = error.code === 'aborted' ? 'aborted' : 'turn_failed';

  return buildRunnerFailureResponse(request, error.provider, sessionRef, error.message, {
    kind,
    code: error.code,
    message: error.message
  });
}

function buildRunnerFailureResponse(
  request: ClaudexTurnRequest,
  provider: ClaudexProvider | undefined,
  sessionRef: ClaudexSessionRef | undefined,
  errorMessage: string,
  failure: ClaudexTurnFailure
): ClaudexTurnResponse {
  return buildFailedTurnResponse({
    requestedProvider: request.provider,
    provider,
    sessionRef,
    errorMessage,
    failure
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRunnableProviderReadiness(readiness: ProviderReadiness): boolean {
  return readiness.status === 'ready' || readiness.status === 'degraded';
}
