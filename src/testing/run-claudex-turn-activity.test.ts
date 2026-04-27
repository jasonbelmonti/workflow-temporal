import assert from 'node:assert/strict';
import test from 'node:test';

import {
  runClaudexTurnWithActivityContext,
  type RunClaudexTurnActivityContext,
  type RunClaudexTurnHeartbeatDetails
} from '../activities/run-claudex-turn.js';
import {
  buildFailedTurnResponse,
  type ClaudexTurnRequest,
  type ClaudexTurnResponse
} from '../claudex-turn/index.js';

const turnRequest: ClaudexTurnRequest = {
  objective: 'Expose a Temporal activity boundary for Claudex.',
  provider: 'auto',
  workingDirectory: process.cwd(),
  turnNumber: 1
};

test('Claudex turn activity passes Temporal cancellation signal into the runner', async () => {
  const abortController = new AbortController();
  let observedSignal: AbortSignal | undefined;

  await runClaudexTurnWithActivityContext(turnRequest, {
    context: createFakeActivityContext({
      signal: abortController.signal
    }),
    runner: async (_request, options) => {
      observedSignal = options.signal;
      return completedResponse;
    }
  });

  assert.equal(observedSignal, abortController.signal);
});

test('Claudex turn activity emits configured heartbeat diagnostics while the turn is running', async () => {
  const heartbeats: RunClaudexTurnHeartbeatDetails[] = [];
  let observedRequest: ClaudexTurnRequest | undefined;

  const response = await runClaudexTurnWithActivityContext(turnRequest, {
    context: createFakeActivityContext({
      heartbeatTimeoutMs: 1_000,
      heartbeats
    }),
    heartbeatIntervalMs: 5,
    runner: async (request) => {
      observedRequest = request;
      await delay(25);
      return completedResponse;
    }
  });

  assert.equal(observedRequest, turnRequest);
  assert.deepEqual(response, completedResponse);
  assert.equal(heartbeats[0]?.phase, 'started');
  assert.ok(heartbeats.some((heartbeat) => heartbeat.phase === 'running'));

  const finalHeartbeat = heartbeats.at(-1);
  assert.equal(finalHeartbeat?.phase, 'finished');
  assert.equal(finalHeartbeat?.outcome, 'completed');
  assert.equal(finalHeartbeat?.provider, 'claude');
});

test('Claudex turn activity leaves heartbeats disabled when no heartbeat timeout is configured', async () => {
  const heartbeats: RunClaudexTurnHeartbeatDetails[] = [];

  const response = await runClaudexTurnWithActivityContext(turnRequest, {
    context: createFakeActivityContext({
      heartbeats
    }),
    runner: async () => readinessFailureResponse
  });

  assert.deepEqual(response, readinessFailureResponse);
  assert.equal(heartbeats.length, 0);
});

function createFakeActivityContext({
  heartbeatTimeoutMs,
  heartbeats = [],
  signal = new AbortController().signal
}: {
  heartbeatTimeoutMs?: number;
  heartbeats?: RunClaudexTurnHeartbeatDetails[];
  signal?: AbortSignal;
}): RunClaudexTurnActivityContext {
  return {
    info: {
      heartbeatTimeoutMs
    },
    cancellationSignal: signal,
    heartbeat: (details?: unknown) => {
      heartbeats.push(details as RunClaudexTurnHeartbeatDetails);
    }
  };
}

const completedResponse: ClaudexTurnResponse = {
  requestedProvider: 'auto',
  provider: 'claude',
  outcome: 'completed',
  text: 'Completed one fake Claudex turn.',
  artifactRefs: [],
  sessionRef: {
    provider: 'claude',
    sessionId: 'fake-claude-session'
  }
};

const readinessFailureResponse = buildFailedTurnResponse({
  requestedProvider: 'auto',
  provider: 'claude',
  errorMessage: 'Claude provider needs authentication.',
  failure: {
    kind: 'readiness_failed',
    code: 'needs_auth',
    message: 'Claude provider needs authentication.'
  }
});

function delay(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
