import assert from 'node:assert/strict';
import test from 'node:test';

import { Client, Connection, type WorkflowHandle } from '@temporalio/client';
import { NativeConnection } from '@temporalio/worker';

import { temporalAddress } from '../lib/config.js';
import { createHelloWorldWorker } from '../worker/create-hello-world-worker.js';
import {
  buildFakeRecipeWorkflowId,
  fakeRecipeGateWorkflowType,
  fakeRecipeSingleGateSnapshot,
  getFakeRecipeGateStateQueryName,
  submitFakeRecipeDecisionUpdateName,
  type FakeRecipeDecisionInput,
  type FakeRecipeDecisionResult,
  type FakeRecipeGateWorkflow,
  type FakeRecipeQueueItem,
  type FakeRecipeResult,
  type FakeRecipeState
} from '../workflows/index.js';

test('bundled fake recipe workflow isolates queue decisions across multiple runs', { timeout: 30_000 }, async () => {
  const taskQueue = `fake-recipe-gate-smoke-${globalThis.crypto.randomUUID()}`;
  const workerConnection = await NativeConnection.connect({ address: temporalAddress });
  const clientConnection = await Connection.connect({ address: temporalAddress });
  const worker = await createHelloWorldWorker({ connection: workerConnection, taskQueue });
  const client = new Client({ connection: clientConnection });

  try {
    const result = await worker.runUntil(
      async () => {
        const handles = await Promise.all([
          startFakeRecipeRun(client, taskQueue, 'run-a'),
          startFakeRecipeRun(client, taskQueue, 'run-b'),
          startFakeRecipeRun(client, taskQueue, 'run-c')
        ]);
        const blockedStates = await Promise.all(handles.map((handle) => waitForBlockedState(handle)));
        const queueItems = blockedStates.map((state) => state.activeQueueItem);

        assert.equal(queueItems.length, 3);
        assert(queueItems.every((queueItem) => queueItem !== undefined));

        const [handleA, handleB, handleC] = handles;
        const [stateA, stateB, stateC] = blockedStates;
        const itemA = requireQueueItem(stateA);
        const itemB = requireQueueItem(stateB);
        const itemC = requireQueueItem(stateC);

        assert.notEqual(itemA.workflowExecutionId, itemB.workflowExecutionId);
        assert.notEqual(itemA.workflowExecutionId, itemC.workflowExecutionId);
        assertQueueItemHasRequiredPayload(itemA);
        assertQueueItemHasRequiredPayload(itemB);
        assertQueueItemHasRequiredPayload(itemC);

        const wrongWorkflow = await decide(handleA, {
          ...approvalDecision(itemA),
          workflowExecutionId: itemB.workflowExecutionId
        });
        assertUnappliedDecision(wrongWorkflow, 'invalid');
        await assertStillBlockedOn(handleA, itemA);
        await assertStillBlockedOn(handleB, itemB);

        const wrongQueueItem = await decide(handleA, {
          ...approvalDecision(itemA),
          queueItemId: itemB.queueItemId
        });
        assertUnappliedDecision(wrongQueueItem, 'invalid');
        await assertStillBlockedOn(handleA, itemA);
        await assertStillBlockedOn(handleB, itemB);

        const staleDecision = await decide(handleA, {
          ...approvalDecision(itemA),
          gateRevision: itemA.gateRevision + 1
        });
        assertUnappliedDecision(staleDecision, 'stale');
        await assertStillBlockedOn(handleA, itemA);

        const resultAPromise = handleA.result();
        const acceptedA = await decide(handleA, approvalDecision(itemA));
        assert.equal(acceptedA.status, 'accepted');
        assert.equal(acceptedA.applied, true);
        const resultA = await resultAPromise;

        assert.equal(resultA.status, 'completed');
        assert.equal(resultA.queueItems[0]?.status, 'accepted');
        await assertStillBlockedOn(handleB, itemB);
        await assertStillBlockedOn(handleC, itemC);

        const [resultB, resultC] = await Promise.all([
          approveAndComplete(handleB, itemB),
          approveAndComplete(handleC, itemC)
        ]);

        return {
          resultA,
          resultB,
          resultC,
          rejectedDecisions: [wrongWorkflow, wrongQueueItem, staleDecision]
        };
      },
      { promiseCompletionTimeout: '10 seconds' }
    );

    assert.deepEqual(
      result.rejectedDecisions.map((decision) => decision.status),
      ['invalid', 'invalid', 'stale']
    );
    assert.equal(result.resultA.completedSteps.at(-1)?.stepId, 'complete-run');
    assert.equal(result.resultB.completedSteps.at(-1)?.stepId, 'complete-run');
    assert.equal(result.resultC.completedSteps.at(-1)?.stepId, 'complete-run');
    assert.equal(result.resultA.recipeSnapshotId, fakeRecipeSingleGateSnapshot.snapshotId);
    assert.equal(result.resultB.recipeSnapshotId, fakeRecipeSingleGateSnapshot.snapshotId);
    assert.equal(result.resultC.recipeSnapshotId, fakeRecipeSingleGateSnapshot.snapshotId);
  } finally {
    await clientConnection.close();
    await workerConnection.close();
  }
});

async function startFakeRecipeRun(
  client: Client,
  taskQueue: string,
  runLabel: string
): Promise<WorkflowHandle<FakeRecipeGateWorkflow>> {
  return client.workflow.start<FakeRecipeGateWorkflow>(fakeRecipeGateWorkflowType, {
    args: [
      {
        recipeSnapshot: fakeRecipeSingleGateSnapshot,
        runLabel
      }
    ],
    taskQueue,
    workflowId: buildFakeRecipeWorkflowId(
      {
        recipeSnapshot: fakeRecipeSingleGateSnapshot,
        runLabel
      },
      {
        randomId: () => runLabel
      }
    )
  });
}

async function waitForBlockedState(
  handle: WorkflowHandle<FakeRecipeGateWorkflow>
): Promise<FakeRecipeState> {
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    const state = await handle.query<FakeRecipeState>(getFakeRecipeGateStateQueryName);

    if (state.status === 'blocked' && state.activeQueueItem !== undefined) {
      return state;
    }

    await sleep(50);
  }

  throw new Error('Timed out waiting for fake recipe workflow to block on a queue item.');
}

async function decide(
  handle: WorkflowHandle<FakeRecipeGateWorkflow>,
  decision: FakeRecipeDecisionInput
): Promise<FakeRecipeDecisionResult> {
  return handle.executeUpdate<FakeRecipeDecisionResult, [FakeRecipeDecisionInput]>(
    submitFakeRecipeDecisionUpdateName,
    {
      args: [decision]
    }
  );
}

async function approveAndComplete(
  handle: WorkflowHandle<FakeRecipeGateWorkflow>,
  queueItem: FakeRecipeQueueItem
): Promise<FakeRecipeResult> {
  const resultPromise = handle.result();
  const approval = await decide(handle, approvalDecision(queueItem));

  assert.equal(approval.status, 'accepted');
  assert.equal(approval.applied, true);

  return resultPromise;
}

async function assertStillBlockedOn(
  handle: WorkflowHandle<FakeRecipeGateWorkflow>,
  queueItem: FakeRecipeQueueItem
): Promise<void> {
  const state = await handle.query<FakeRecipeState>(getFakeRecipeGateStateQueryName);

  assert.equal(state.status, 'blocked');
  assert.equal(state.activeQueueItem?.queueItemId, queueItem.queueItemId);
  assert.equal(state.activeQueueItem?.gateRevision, queueItem.gateRevision);
  assert.equal(state.queueItems[0]?.status, 'open');
}

function requireQueueItem(state: FakeRecipeState): FakeRecipeQueueItem {
  if (state.activeQueueItem === undefined) {
    throw new TypeError(`Expected workflow ${state.workflowExecutionId} to have an active queue item.`);
  }

  return state.activeQueueItem;
}

function approvalDecision(queueItem: FakeRecipeQueueItem): FakeRecipeDecisionInput {
  return {
    workflowExecutionId: queueItem.workflowExecutionId,
    queueItemId: queueItem.queueItemId,
    gateRevision: queueItem.gateRevision,
    decision: 'approve',
    decidedBy: 'fake-recipe-smoke'
  };
}

function assertQueueItemHasRequiredPayload(queueItem: FakeRecipeQueueItem): void {
  assert.match(queueItem.workflowExecutionId, /^fake-recipe-gate-/);
  assert.match(queueItem.workflowId, /^fake-recipe-gate-/);
  assert.ok(queueItem.runId.length > 0);
  assert.match(queueItem.queueItemId, /:operator-approval:r1$/);
  assert.equal(queueItem.stepId, 'operator-approval');
  assert.equal(queueItem.gateRevision, 1);
  assert.equal(queueItem.status, 'open');
  assert.deepEqual(
    queueItem.decisionOptions.map((option) => [option.id, option.effect]),
    [
      ['approve', 'approve'],
      ['reject', 'reject']
    ]
  );
  assert.equal(queueItem.artifactRefs[0]?.artifactId, 'operator-approval-packet');
  assert.equal(queueItem.artifactRefs[0]?.path, 'fake://artifacts/operator-approval-packet.json');
  assert.equal(queueItem.compactContext.title, 'Fake approval gate');
  assert.equal(queueItem.compactContext.fields?.scope, 'fake-only');
}

function assertUnappliedDecision(
  result: FakeRecipeDecisionResult,
  status: Extract<FakeRecipeDecisionResult['status'], 'invalid' | 'stale'>
): void {
  assert.equal(result.status, status);
  assert.equal(result.applied, false);
}

async function sleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}
