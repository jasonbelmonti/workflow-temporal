import {
  type ClaudexProvider,
  type ClaudexRequestedProvider,
  type ClaudexSessionRef,
  type ClaudexTurnFailureKind,
  type ClaudexTurnRequest,
  type ClaudexTurnResponse
} from '../claudex-turn/index.js';

const activityName = 'runClaudexTurn';
const maxHeartbeatIntervalMs = 5_000;

export type RunClaudexTurnHeartbeatPhase = 'started' | 'running' | 'finished' | 'failed';

export interface RunClaudexTurnHeartbeatDetails {
  activityName: typeof activityName;
  phase: RunClaudexTurnHeartbeatPhase;
  requestedProvider: ClaudexRequestedProvider;
  turnNumber: number;
  workingDirectory: string;
  hasPriorSession: boolean;
  provider?: ClaudexProvider;
  sessionRef?: ClaudexSessionRef;
  outcome?: ClaudexTurnResponse['outcome'];
  failureKind?: ClaudexTurnFailureKind;
  errorMessage?: string;
}

export interface RunClaudexTurnHeartbeatContext {
  readonly info: {
    readonly heartbeatTimeoutMs?: number;
  };
  readonly heartbeat: (details?: unknown) => void;
}

export interface RunClaudexTurnHeartbeater {
  started: () => void;
  finished: (response: ClaudexTurnResponse) => void;
  failed: (error: unknown) => void;
  stop: () => void;
}

export function createRunClaudexTurnHeartbeater(
  context: RunClaudexTurnHeartbeatContext,
  request: ClaudexTurnRequest,
  heartbeatIntervalMs = resolveHeartbeatIntervalMs(context.info.heartbeatTimeoutMs)
): RunClaudexTurnHeartbeater {
  const heartbeat = createHeartbeatEmitter(context, request);
  const runningHeartbeat = startRunningHeartbeat(heartbeat, heartbeatIntervalMs);

  return {
    started: () => heartbeat('started'),
    finished: (response) => heartbeat('finished', response),
    failed: (error) => heartbeat('failed', undefined, error),
    stop: runningHeartbeat.stop
  };
}

function createHeartbeatEmitter(
  context: RunClaudexTurnHeartbeatContext,
  request: ClaudexTurnRequest
): (
  phase: RunClaudexTurnHeartbeatPhase,
  response?: ClaudexTurnResponse,
  error?: unknown
) => void {
  if (context.info.heartbeatTimeoutMs === undefined) {
    return () => undefined;
  }

  return (phase, response, error): void => {
    context.heartbeat(buildHeartbeatDetails(request, phase, response, error));
  };
}

function startRunningHeartbeat(
  heartbeat: (phase: RunClaudexTurnHeartbeatPhase) => void,
  heartbeatIntervalMs: number | undefined
): { stop: () => void } {
  if (heartbeatIntervalMs === undefined) {
    return { stop: () => undefined };
  }

  const interval = setInterval(() => heartbeat('running'), heartbeatIntervalMs);
  interval.unref();

  return {
    stop: () => clearInterval(interval)
  };
}

function resolveHeartbeatIntervalMs(heartbeatTimeoutMs: number | undefined): number | undefined {
  if (heartbeatTimeoutMs === undefined) {
    return undefined;
  }

  return Math.max(1, Math.min(maxHeartbeatIntervalMs, Math.floor(heartbeatTimeoutMs / 2)));
}

function buildHeartbeatDetails(
  request: ClaudexTurnRequest,
  phase: RunClaudexTurnHeartbeatPhase,
  response: ClaudexTurnResponse | undefined,
  error: unknown
): RunClaudexTurnHeartbeatDetails {
  return {
    activityName,
    phase,
    requestedProvider: request.provider,
    turnNumber: request.turnNumber,
    workingDirectory: request.workingDirectory,
    hasPriorSession: request.priorSessionRef !== undefined,
    provider: response?.provider,
    sessionRef: response?.sessionRef,
    outcome: response?.outcome,
    failureKind: getHeartbeatFailureKind(response),
    errorMessage: getHeartbeatErrorMessage(response, error)
  };
}

function getHeartbeatFailureKind(
  response: ClaudexTurnResponse | undefined
): ClaudexTurnFailureKind | undefined {
  if (response?.outcome !== 'failed') {
    return undefined;
  }

  return response.failure.kind;
}

function getHeartbeatErrorMessage(
  response: ClaudexTurnResponse | undefined,
  error: unknown
): string | undefined {
  if (response?.outcome === 'failed') {
    return response.errorMessage;
  }

  if (error === undefined) {
    return undefined;
  }

  return getErrorMessage(error);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
