import { Context } from '@temporalio/activity';

import {
  runClaudexTurn as runClaudexTurnInNode,
  type RunClaudexTurnOptions,
  type ClaudexTurnRequest,
  type ClaudexTurnResponse
} from '../claudex-turn/index.js';
import {
  readClaudexTurnSessionOptions,
  readClaudexTurnTimeoutMs
} from '../claudex-turn/turn-runtime-config.js';
import {
  createRunClaudexTurnHeartbeater,
  type RunClaudexTurnHeartbeatContext
} from './run-claudex-turn-heartbeat.js';

export type {
  RunClaudexTurnHeartbeatDetails,
  RunClaudexTurnHeartbeatPhase
} from './run-claudex-turn-heartbeat.js';

export interface RunClaudexTurnActivityContext extends RunClaudexTurnHeartbeatContext {
  readonly cancellationSignal: AbortSignal;
}

export type RunClaudexTurnActivityRunner = (
  request: ClaudexTurnRequest,
  options: {
    signal: AbortSignal;
    timeoutMs?: number;
    sessionOptions?: RunClaudexTurnOptions['sessionOptions'];
  }
) => Promise<ClaudexTurnResponse>;

export interface RunClaudexTurnActivityOptions {
  context: RunClaudexTurnActivityContext;
  runner?: RunClaudexTurnActivityRunner;
  heartbeatIntervalMs?: number;
  env?: NodeJS.ProcessEnv;
}

/**
 * Temporal activity boundary for one bounded Claudex turn.
 *
 * Normal Temporal activities only receive cancellation after heartbeats. This
 * activity heartbeats when the scheduled activity has a heartbeat timeout; the
 * workflow that schedules cancellable turns must set that timeout.
 */
export async function runClaudexTurn(
  request: ClaudexTurnRequest
): Promise<ClaudexTurnResponse> {
  return runClaudexTurnWithActivityContext(request, {
    context: Context.current()
  });
}

export async function runClaudexTurnWithActivityContext(
  request: ClaudexTurnRequest,
  {
    context,
    runner = runClaudexTurnInNode,
    heartbeatIntervalMs,
    env = process.env
  }: RunClaudexTurnActivityOptions
): Promise<ClaudexTurnResponse> {
  const heartbeater = createRunClaudexTurnHeartbeater(context, request, heartbeatIntervalMs);

  try {
    const timeoutMs = readClaudexTurnTimeoutMs(env);
    const sessionOptions = readClaudexTurnSessionOptions(env);
    heartbeater.started();

    const response = await runner(request, {
      signal: context.cancellationSignal,
      timeoutMs,
      sessionOptions
    });

    heartbeater.finished(response);

    return response;
  } catch (error: unknown) {
    heartbeater.failed(error);
    throw error;
  } finally {
    heartbeater.stop();
  }
}
