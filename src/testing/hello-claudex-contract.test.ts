import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { helloClaudexWorkflowType } from '../workflows/hello-claudex-contract.js';
import {
  buildHelloClaudexResult,
  createInitialHelloClaudexState,
  normalizeCancelRunSignal,
  normalizeSubmitHumanInputSignal,
  resolveHelloClaudexInput,
  tryNormalizeCancelRunSignal,
  tryNormalizeSubmitHumanInputSignal
} from '../workflows/hello-claudex-state.js';
import { buildHelloClaudexWorkflowId } from '../workflows/hello-claudex-workflow-id.js';

const input = {
  objective: 'Define the hello Claudex contract.',
  provider: 'auto' as const,
  workingDirectory: '/tmp/workflow-temporal'
};

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

test('hello Claudex workflow source stays on the deterministic side of the boundary', async () => {
  const source = await readFile(
    new URL('../../src/workflows/hello-claudex.ts', import.meta.url),
    'utf8'
  );

  assert.equal(helloClaudexWorkflowType, 'agent.helloClaudex');
  assert.doesNotMatch(source, /@jasonbelmonti\/claudex/);
  assert.doesNotMatch(source, /\.\.\/activities\//);
  assert.doesNotMatch(source, /\.\.\/claudex-turn\/run-claudex-turn/);
});
