import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  helloClaudexWorkflowType,
  type HelloClaudexArtifactRef,
  type HelloClaudexSessionRef
} from '../workflows/hello-claudex-contract.js';
import {
  buildHelloClaudexResult,
  createInitialHelloClaudexState,
  normalizeCancelRunSignal,
  normalizeSubmitHumanInputSignal,
  resolveHelloClaudexInput,
  tryNormalizeCancelRunSignal,
  tryNormalizeSubmitHumanInputSignal
} from '../workflows/hello-claudex-state.js';
import {
  applyHelloClaudexTurnResponse,
  buildHelloClaudexTurnRequest,
  cancelHelloClaudexTurn,
  failHelloClaudexTurn
} from '../workflows/hello-claudex-turn.js';
import { buildHelloClaudexWorkflowId } from '../workflows/hello-claudex-workflow-id.js';

const input = {
  objective: 'Define the hello Claudex contract.',
  provider: 'auto' as const,
  workingDirectory: '/tmp/workflow-temporal'
};
const completedSessionRef: HelloClaudexSessionRef = {
  provider: 'codex',
  sessionId: 'session-1'
};
const completedArtifactRefs: HelloClaudexArtifactRef[] = [
  {
    artifactId: 'turn-1-result',
    kind: 'result',
    path: '/tmp/workflow-temporal/var/turn-1-result.json',
    createdAt: '2026-04-27T23:47:00.000Z'
  }
];

test('hello Claudex input resolution keeps the start contract explicit and normalized', () => {
  assert.deepEqual(
    resolveHelloClaudexInput(
      {
        objective: '  Ship contract  ',
        workingDirectory: '  /repo  '
      },
      { defaultWorkingDirectory: '/fallback' }
    ),
    {
      objective: 'Ship contract',
      provider: 'auto',
      workingDirectory: '/repo'
    }
  );

  assert.throws(
    () =>
      resolveHelloClaudexInput({
        objective: 'Ship contract',
        provider: 'local' as never,
        workingDirectory: '/repo'
      }),
    /provider must be one of claude, codex, auto/
  );
});

test('hello Claudex workflow IDs include business context plus a collision-resistant suffix', () => {
  const workflowId = buildHelloClaudexWorkflowId(input, {
    randomId: () => '123E4567-E89B-12D3-A456-426614174000'
  });

  assert.match(
    workflowId,
    /^hello-claudex-auto-define-the-hello-claudex-contract-workflow-temporal-[a-z0-9]+-123e4567-e89b-12d3-a456-426614174000$/
  );
});

test('hello Claudex initial state is compact workflow-owned durable state', () => {
  assert.deepEqual(createInitialHelloClaudexState(input, 'workflow-1'), {
    workflowId: 'workflow-1',
    status: 'running',
    objective: 'Define the hello Claudex contract.',
    requestedProvider: 'auto',
    workingDirectory: '/tmp/workflow-temporal',
    turnCount: 0,
    humanInputCount: 0,
    artifactRefs: []
  });
});

test('hello Claudex signal payloads are explicit JSON-safe objects', () => {
  assert.deepEqual(
    normalizeSubmitHumanInputSignal({
      text: '  Continue with the next bounded turn.  ',
      correlationId: '  human-1  '
    }),
    {
      text: 'Continue with the next bounded turn.',
      correlationId: 'human-1'
    }
  );

  assert.deepEqual(normalizeCancelRunSignal({ reason: '  operator stop  ' }), {
    reason: 'operator stop'
  });
});

test('hello Claudex signal payload validation can reject malformed payloads without throwing', () => {
  assert.deepEqual(tryNormalizeSubmitHumanInputSignal({}), {
    valid: false,
    errorMessage: 'submitHumanInput.text must be a non-empty string.'
  });

  assert.deepEqual(tryNormalizeCancelRunSignal('stop'), {
    valid: false,
    errorMessage: 'cancelRun signal must be a JSON object when present.'
  });

  assert.deepEqual(tryNormalizeSubmitHumanInputSignal([]), {
    valid: false,
    errorMessage: 'submitHumanInput signal must be a JSON object.'
  });

  assert.deepEqual(tryNormalizeCancelRunSignal([]), {
    valid: false,
    errorMessage: 'cancelRun signal must be a JSON object when present.'
  });
});

test('hello Claudex result projection only accepts terminal state', () => {
  const state = createInitialHelloClaudexState(input, 'workflow-1');

  assert.throws(() => buildHelloClaudexResult(state), /non-terminal status "running"/);

  state.status = 'cancelled';
  state.cancelReason = 'operator stop';

  assert.deepEqual(buildHelloClaudexResult(state), {
    workflowId: 'workflow-1',
    status: 'cancelled',
    objective: 'Define the hello Claudex contract.',
    requestedProvider: 'auto',
    workingDirectory: '/tmp/workflow-temporal',
    turnCount: 0,
    artifactRefs: [],
    cancelReason: 'operator stop'
  });
});

test('hello Claudex builds the first bounded turn request from workflow-owned state', () => {
  const state = createInitialHelloClaudexState(input, 'workflow-1');

  assert.deepEqual(buildHelloClaudexTurnRequest(state), {
    objective: 'Define the hello Claudex contract.',
    provider: 'auto',
    workingDirectory: '/tmp/workflow-temporal',
    turnNumber: 1
  });
});

test('hello Claudex maps completed turn responses into terminal workflow state', () => {
  const state = createInitialHelloClaudexState(input, 'workflow-1');

  applyHelloClaudexTurnResponse(state, {
    requestedProvider: 'auto',
    provider: 'codex',
    outcome: 'completed',
    text: 'Completed the first bounded turn.',
    sessionRef: completedSessionRef,
    artifactRefs: completedArtifactRefs
  });

  assert.deepEqual(buildHelloClaudexResult(state), {
    workflowId: 'workflow-1',
    status: 'completed',
    objective: 'Define the hello Claudex contract.',
    requestedProvider: 'auto',
    provider: 'codex',
    workingDirectory: '/tmp/workflow-temporal',
    turnCount: 1,
    latestText: 'Completed the first bounded turn.',
    sessionRef: completedSessionRef,
    artifactRefs: completedArtifactRefs
  });
});

test('hello Claudex maps failed turn responses into terminal workflow state', () => {
  const state = createInitialHelloClaudexState(input, 'workflow-1');

  applyHelloClaudexTurnResponse(state, {
    requestedProvider: 'auto',
    provider: 'claude',
    outcome: 'failed',
    text: 'Readiness check failed.',
    sessionRef: {
      provider: 'claude',
      sessionId: 'session-1'
    },
    artifactRefs: [],
    errorMessage: 'Claudex provider claude is not ready: unavailable.',
    failure: {
      kind: 'readiness_failed',
      code: 'unavailable',
      message: 'Claude CLI was not available.'
    }
  });

  assert.deepEqual(buildHelloClaudexResult(state), {
    workflowId: 'workflow-1',
    status: 'failed',
    objective: 'Define the hello Claudex contract.',
    requestedProvider: 'auto',
    provider: 'claude',
    workingDirectory: '/tmp/workflow-temporal',
    turnCount: 1,
    latestText: 'Readiness check failed.',
    sessionRef: {
      provider: 'claude',
      sessionId: 'session-1'
    },
    artifactRefs: [],
    lastError: 'Claudex provider claude is not ready: unavailable.'
  });
});

test('hello Claudex builds a resumed turn request after human input', () => {
  const state = createInitialHelloClaudexState(input, 'workflow-1');

  applyHelloClaudexTurnResponse(state, {
    requestedProvider: 'auto',
    provider: 'codex',
    outcome: 'needs_input',
    text: 'Need approval before continuing.',
    sessionRef: completedSessionRef,
    artifactRefs: completedArtifactRefs,
    waitingReason: 'Approval required.'
  });

  assert.equal(state.status, 'waiting_for_input');
  assert.equal(state.turnCount, 1);

  state.pendingHumanInput = normalizeSubmitHumanInputSignal({
    text: 'Proceed with the approved plan.'
  });
  state.humanInputCount += 1;
  state.status = 'running';
  delete state.waitingReason;

  assert.deepEqual(buildHelloClaudexTurnRequest(state), {
    objective: 'Define the hello Claudex contract.',
    provider: 'auto',
    workingDirectory: '/tmp/workflow-temporal',
    turnNumber: 2,
    priorSessionRef: completedSessionRef,
    humanInput: 'Proceed with the approved plan.'
  });
});

test('hello Claudex clears consumed human input after a turn requests input again', () => {
  const state = createInitialHelloClaudexState(input, 'workflow-1');
  const consumedPendingHumanInput = normalizeSubmitHumanInputSignal({
    text: 'Proceed with the approved plan.'
  });
  state.pendingHumanInput = consumedPendingHumanInput;

  applyHelloClaudexTurnResponse(
    state,
    {
      requestedProvider: 'auto',
      provider: 'codex',
      outcome: 'needs_input',
      text: 'Need another approval before continuing.',
      sessionRef: completedSessionRef,
      artifactRefs: completedArtifactRefs,
      waitingReason: 'Second approval required.'
    },
    { consumedPendingHumanInput }
  );

  assert.equal(state.status, 'waiting_for_input');
  assert.equal(state.pendingHumanInput, undefined);
  assert.equal(state.waitingReason, 'Second approval required.');
});

test('hello Claudex preserves human input queued during an in-flight turn', () => {
  const state = createInitialHelloClaudexState(input, 'workflow-1');
  state.pendingHumanInput = normalizeSubmitHumanInputSignal({
    text: 'Use this input immediately.'
  });

  applyHelloClaudexTurnResponse(state, {
    requestedProvider: 'auto',
    provider: 'codex',
    outcome: 'needs_input',
    text: 'Need input before continuing.',
    sessionRef: completedSessionRef,
    artifactRefs: completedArtifactRefs,
    waitingReason: 'Input required.'
  });

  assert.equal(state.status, 'running');
  assert.equal(state.waitingReason, undefined);
  assert.deepEqual(buildHelloClaudexTurnRequest(state), {
    objective: 'Define the hello Claudex contract.',
    provider: 'auto',
    workingDirectory: '/tmp/workflow-temporal',
    turnNumber: 2,
    priorSessionRef: completedSessionRef,
    humanInput: 'Use this input immediately.'
  });
});

test('hello Claudex maps cancellation exceptions into cancelled workflow state', () => {
  const state = createInitialHelloClaudexState(input, 'workflow-1');
  state.waitingReason = 'Operator input required.';
  state.lastError = 'Previous transient failure.';
  state.pendingHumanInput = normalizeSubmitHumanInputSignal({
    text: 'Proceed with the approved plan.'
  });

  cancelHelloClaudexTurn(state);

  assert.equal(state.waitingReason, undefined);
  assert.equal(state.lastError, undefined);
  assert.equal(state.pendingHumanInput, undefined);
  assert.deepEqual(buildHelloClaudexResult(state), {
    workflowId: 'workflow-1',
    status: 'cancelled',
    objective: 'Define the hello Claudex contract.',
    requestedProvider: 'auto',
    workingDirectory: '/tmp/workflow-temporal',
    turnCount: 0,
    artifactRefs: []
  });
});

test('hello Claudex clears queued human input when a turn exception fails the workflow', () => {
  const state = createInitialHelloClaudexState(input, 'workflow-1');
  state.waitingReason = 'Operator input required.';
  state.pendingHumanInput = normalizeSubmitHumanInputSignal({
    text: 'Proceed with the approved plan.'
  });

  failHelloClaudexTurn(state, new Error('Activity infrastructure failed.'));

  assert.equal(state.pendingHumanInput, undefined);
  assert.equal(state.waitingReason, undefined);
  assert.deepEqual(buildHelloClaudexResult(state), {
    workflowId: 'workflow-1',
    status: 'failed',
    objective: 'Define the hello Claudex contract.',
    requestedProvider: 'auto',
    workingDirectory: '/tmp/workflow-temporal',
    turnCount: 0,
    artifactRefs: [],
    lastError: 'Activity infrastructure failed.'
  });
});

test('hello Claudex workflow rethrows externally initiated cancellation failures', async () => {
  const source = await readFile(
    new URL('../../src/workflows/hello-claudex.ts', import.meta.url),
    'utf8'
  );

  assert.match(
    source,
    /if \(turnScope\.consideredCancelled\) \{\s+if \(!cancelRunRequested\) \{\s+await turnScope\.cancelRequested;\s+\}\s+continue;\s+\}/
  );
  assert.match(
    source,
    /if \(isCancellation\(error\)\) \{\s+if \(!cancelRunRequested\) \{\s+throw error;\s+\}/
  );
});

test('hello Claudex workflow source stays on the deterministic side of the boundary', async () => {
  const source = await readFile(
    new URL('../../src/workflows/hello-claudex.ts', import.meta.url),
    'utf8'
  );

  assert.equal(helloClaudexWorkflowType, 'agent.helloClaudex');
  assert.doesNotMatch(source, /@jasonbelmonti\/claudex/);
  assert.match(
    source,
    /import type \* as helloClaudexActivities from '\.\.\/activities\/index\.js';/
  );
  assert.doesNotMatch(source, /import\s+(?!type)[^;]+from '\.\.\/activities\//);
  assert.doesNotMatch(source, /\.\.\/claudex-turn\/run-claudex-turn/);
});
