import assert from 'node:assert/strict';
import test from 'node:test';

import { Client, Connection } from '@temporalio/client';
import { NativeConnection } from '@temporalio/worker';

import * as activities from '../activities/index.js';
import { startHelloClaudexWorkflow } from '../client/start-hello-claudex.js';
import type { ClaudexTurnResponse } from '../claudex-turn/index.js';
import { temporalAddress } from '../lib/config.js';
import { createHelloWorldWorker } from '../worker/create-hello-world-worker.js';
import {
  getHelloClaudexStateQueryName,
  submitHumanInputSignalName,
  type HelloClaudexArtifactRef,
  type HelloClaudexInput,
  type HelloClaudexSessionRef,
  type HelloClaudexState
} from '../workflows/index.js';

const fakeHelloClaudexInput: HelloClaudexInput = {
  objective: 'Complete one fake bounded turn.',
  provider: 'auto',
  workingDirectory: '/tmp/workflow-temporal'
};
const fakeHelloClaudexText = 'Completed one fake hello Claudex turn.';
const fakeHelloClaudexSessionRef: HelloClaudexSessionRef = {
  provider: 'codex',
  sessionId: 'fake-codex-session'
};
const fakeHelloClaudexArtifactRefs: HelloClaudexArtifactRef[] = [
  {
    artifactId: 'fake-turn-1-result',
    kind: 'result',
    path: '/tmp/workflow-temporal/fake-turn-1-result.json',
    createdAt: '2026-04-27T23:47:00.000Z'
  }
];
const fakeHelloClaudexWaitingArtifactRefs: HelloClaudexArtifactRef[] = [
  {
    artifactId: 'fake-turn-1-waiting',
    kind: 'result',
    path: '/tmp/workflow-temporal/fake-turn-1-waiting.json',
    createdAt: '2026-04-27T23:47:00.000Z'
  }
];
const fakeHelloClaudexAllArtifactRefs = [
  ...fakeHelloClaudexWaitingArtifactRefs,
  ...fakeHelloClaudexArtifactRefs
];

test('bundled hello Claudex workflow uses input queued during a fake turn', { timeout: 30_000 }, async () => {
  const taskQueue = `hello-claudex-smoke-${globalThis.crypto.randomUUID()}`;
  const workflowId = `hello-claudex-smoke-${globalThis.crypto.randomUUID()}`;
  let turnCount = 0;
  let markFirstTurnStarted: (() => void) | undefined;
  let releaseFirstTurn: (() => void) | undefined;
  const firstTurnStarted = new Promise<void>((resolve) => {
    markFirstTurnStarted = resolve;
  });
  const firstTurnCanFinish = new Promise<void>((resolve) => {
    releaseFirstTurn = resolve;
  });
  const workerConnection = await NativeConnection.connect({ address: temporalAddress });
  const clientConnection = await Connection.connect({ address: temporalAddress });
  const client = new Client({ connection: clientConnection });
  const worker = await createHelloWorldWorker({
    connection: workerConnection,
    taskQueue,
    activities: {
      ...activities,
      runClaudexTurn: async (request): Promise<ClaudexTurnResponse> => {
        turnCount += 1;

        if (turnCount === 1) {
          assert.equal(request.turnNumber, 1);
          assert.equal(request.humanInput, undefined);

          markFirstTurnStarted?.();
          await firstTurnCanFinish;

          return {
            requestedProvider: request.provider,
            provider: 'codex',
            outcome: 'needs_input',
            text: 'Need operator input before completing.',
            sessionRef: fakeHelloClaudexSessionRef,
            artifactRefs: fakeHelloClaudexWaitingArtifactRefs,
            waitingReason: 'Operator input required.'
          };
        }

        assert.equal(request.turnNumber, 2);
        assert.equal(request.humanInput, 'Proceed with the fake smoke path.');
        assert.deepEqual(request.priorSessionRef, fakeHelloClaudexSessionRef);

        return {
          requestedProvider: request.provider,
          provider: 'codex',
          outcome: 'completed',
          text: fakeHelloClaudexText,
          sessionRef: fakeHelloClaudexSessionRef,
          artifactRefs: fakeHelloClaudexArtifactRefs
        };
      }
    }
  });

  try {
    const result = await worker.runUntil(
      async () => {
        const started = await startHelloClaudexWorkflow({
          input: fakeHelloClaudexInput,
          address: temporalAddress,
          taskQueue,
          workflowId
        });
        const handle = client.workflow.getHandle(started.workflowId, started.runId);

        await firstTurnStarted;
        await handle.signal(submitHumanInputSignalName, {
          text: 'Proceed with the fake smoke path.'
        });
        const queuedState = await handle.query<HelloClaudexState>(getHelloClaudexStateQueryName);

        assert.equal(queuedState.status, 'running');
        assert.deepEqual(queuedState.pendingHumanInput, {
          text: 'Proceed with the fake smoke path.'
        });

        releaseFirstTurn?.();

        const workflowResult = await handle.result();
        const finalState = await handle.query(getHelloClaudexStateQueryName);

        return { workflowResult, finalState };
      },
      { promiseCompletionTimeout: '5 seconds' }
    );

    const expectedWorkflowResult = {
      workflowId,
      status: 'completed',
      objective: fakeHelloClaudexInput.objective,
      requestedProvider: fakeHelloClaudexInput.provider,
      provider: 'codex',
      workingDirectory: fakeHelloClaudexInput.workingDirectory,
      turnCount: 2,
      latestText: fakeHelloClaudexText,
      sessionRef: fakeHelloClaudexSessionRef,
      artifactRefs: fakeHelloClaudexAllArtifactRefs
    } as const;

    assert.deepEqual(result.workflowResult, expectedWorkflowResult);
    assert.deepEqual(result.finalState, {
      ...expectedWorkflowResult,
      humanInputCount: 1
    });
  } finally {
    await clientConnection.close();
    await workerConnection.close();
  }
});
