import assert from 'node:assert/strict';
import test from 'node:test';

import {
  runFakeRecipeStep
} from '../activities/index.js';
import {
  applyFakeRecipeActivityResult,
  applyFakeRecipeDecision,
  buildFakeRecipeActivityRequest,
  buildFakeRecipeResult,
  buildFakeRecipeWorkflowExecutionId,
  buildFakeRecipeWorkflowId,
  completeFakeRecipeRun,
  createInitialFakeRecipeState,
  fakeRecipeSingleGateSnapshot,
  getCurrentFakeRecipeStep,
  normalizeFakeRecipeDecisionInput,
  openFakeRecipeGate,
  resolveFakeRecipeInput,
  type FakeRecipeDecisionInput,
  type FakeRecipeQueueItem,
  type FakeRecipeState
} from '../workflows/index.js';

test('fake recipe input resolution preserves a pinned workflow-local snapshot', () => {
  const input = resolveFakeRecipeInput({
    recipeSnapshot: fakeRecipeSingleGateSnapshot,
    runLabel: '  proof run  '
  });

  assert.equal(input.runLabel, 'proof run');
  assert.equal(input.recipeSnapshot.snapshotId, 'fake-recipe-single-gate-snapshot@b866fc4');
  assert.equal(input.recipeSnapshot.source.kind, 'workflow-local-fixture');
  assert.equal(
    input.recipeSnapshot.source.commit,
    'b866fc4d27b863f12e43be2ce9f0748dbd6ce3c9'
  );
  assert.equal(input.recipeSnapshot.source.digest, 'sha256:fake-single-gate-wp1');
  assert.equal(input.recipeSnapshot.executionProfileId, 'fake-execution-profile.readwrite-local@wp1');
});

test('fake recipe workflow IDs include snapshot context plus a collision-resistant suffix', () => {
  const workflowId = buildFakeRecipeWorkflowId(
    {
      recipeSnapshot: fakeRecipeSingleGateSnapshot,
      runLabel: 'Run A'
    },
    {
      randomId: () => '123E4567-E89B-12D3-A456-426614174000'
    }
  );

  assert.match(
    workflowId,
    /^fake-recipe-gate-fake-recipe-single-gate-snapshot-b866fc4-run-a-123e4567-e89b-12d3-a456-426614174000$/
  );
});

test('fake recipe queue items contain the VAL-1 durable gate payload fields', async () => {
  const { state, queueItem } = await createBlockedFakeRecipeState();

  assert.equal(queueItem.workflowExecutionId, buildFakeRecipeWorkflowExecutionId('workflow-1', 'run-1'));
  assert.equal(queueItem.workflowId, 'workflow-1');
  assert.equal(queueItem.runId, 'run-1');
  assert.equal(queueItem.queueItemId, 'workflow-1:operator-approval:r1');
  assert.equal(queueItem.stepId, 'operator-approval');
  assert.equal(queueItem.gateRevision, 1);
  assert.equal(queueItem.status, 'open');
  assert.deepEqual(
    queueItem.decisionOptions.map((option) => option.id),
    ['approve', 'reject']
  );
  assert.deepEqual(queueItem.artifactRefs, [
    {
      artifactId: 'operator-approval-packet',
      kind: 'review-packet',
      path: 'fake://artifacts/operator-approval-packet.json',
      createdAt: '2026-04-30T20:50:00.000Z'
    }
  ]);
  assert.equal(queueItem.compactContext.fields?.scope, 'fake-only');
  assert.equal(state.status, 'blocked');
});

test('fake recipe decisions reject stale and mismatched targets without resuming work', async () => {
  const { state, queueItem } = await createBlockedFakeRecipeState();

  const wrongWorkflow = applyFakeRecipeDecision(state, {
    ...approvalDecision(queueItem),
    workflowExecutionId: 'other-workflow/other-run'
  });
  assert.equal(wrongWorkflow.status, 'invalid');
  assert.equal(wrongWorkflow.applied, false);
  assertBlockedOnSameQueueItem(state, queueItem);

  const wrongQueueItem = applyFakeRecipeDecision(state, {
    ...approvalDecision(queueItem),
    queueItemId: 'other-queue-item'
  });
  assert.equal(wrongQueueItem.status, 'invalid');
  assert.equal(wrongQueueItem.applied, false);
  assertBlockedOnSameQueueItem(state, queueItem);

  const staleRevision = applyFakeRecipeDecision(state, {
    ...approvalDecision(queueItem),
    gateRevision: queueItem.gateRevision + 1
  });
  assert.equal(staleRevision.status, 'stale');
  assert.equal(staleRevision.applied, false);
  assertBlockedOnSameQueueItem(state, queueItem);
});

test('fake recipe matching approvals resume the current gate and terminal result is compact', async () => {
  const { state, queueItem } = await createBlockedFakeRecipeState();

  const approval = applyFakeRecipeDecision(state, approvalDecision(queueItem));

  assert.equal(approval.status, 'accepted');
  assert.equal(approval.applied, true);
  assert.equal(state.status, 'running');
  assert.equal(state.nextStepIndex, 2);
  assert.equal(state.activeQueueItem, undefined);
  assert.equal(state.queueItems[0]?.status, 'accepted');
  assert.equal(state.completedSteps.at(-1)?.outcome, 'approved');

  const completionStep = getCurrentFakeRecipeStep(state);
  assert.equal(completionStep?.kind, 'activity');

  if (completionStep?.kind !== 'activity') {
    throw new TypeError('Expected final fake recipe step to be an activity.');
  }

  applyFakeRecipeActivityResult(
    state,
    await runFakeRecipeStep(buildFakeRecipeActivityRequest(state, completionStep))
  );
  completeFakeRecipeRun(state);

  assert.deepEqual(buildFakeRecipeResult(state), {
    workflowExecutionId: 'workflow-1/run-1',
    workflowId: 'workflow-1',
    runId: 'run-1',
    status: 'completed',
    recipeSnapshotId: 'fake-recipe-single-gate-snapshot@b866fc4',
    executionProfileId: 'fake-execution-profile.readwrite-local@wp1',
    queueItems: [
      {
        ...queueItem,
        status: 'accepted'
      }
    ],
    completedSteps: state.completedSteps,
    artifactRefs: state.artifactRefs,
    lastDecisionResult: approval
  });
});

test('fake recipe matching rejection returns a typed rejected decision result', async () => {
  const { state, queueItem } = await createBlockedFakeRecipeState();

  const rejection = applyFakeRecipeDecision(state, {
    ...approvalDecision(queueItem),
    decision: 'reject',
    reason: 'operator found a fake blocker'
  });

  assert.equal(rejection.status, 'rejected');
  assert.equal(rejection.applied, true);
  assert.equal(state.status, 'failed');
  assert.equal(state.queueItems[0]?.status, 'rejected');
  assert.match(state.lastError ?? '', /operator-approval/);
});

test('fake recipe decision payload validation rejects malformed transport input', () => {
  assert.throws(
    () =>
      normalizeFakeRecipeDecisionInput({
        workflowExecutionId: 'workflow-1/run-1',
        queueItemId: 'queue-1',
        gateRevision: 0,
        decision: 'approve',
        decidedBy: 'operator'
      }),
    /decision.gateRevision must be a positive integer/
  );
});

async function createBlockedFakeRecipeState(): Promise<{
  state: FakeRecipeState;
  queueItem: FakeRecipeQueueItem;
}> {
  const state = createInitialFakeRecipeState(
    {
      recipeSnapshot: fakeRecipeSingleGateSnapshot,
      runLabel: 'contract-test'
    },
    'workflow-1',
    'run-1'
  );
  const firstStep = getCurrentFakeRecipeStep(state);

  if (firstStep?.kind !== 'activity') {
    throw new TypeError('Expected first fake recipe step to be an activity.');
  }

  applyFakeRecipeActivityResult(
    state,
    await runFakeRecipeStep(buildFakeRecipeActivityRequest(state, firstStep))
  );

  const gateStep = getCurrentFakeRecipeStep(state);

  if (gateStep?.kind !== 'gate') {
    throw new TypeError('Expected second fake recipe step to be a gate.');
  }

  return {
    state,
    queueItem: openFakeRecipeGate(state, gateStep)
  };
}

function approvalDecision(queueItem: FakeRecipeQueueItem): FakeRecipeDecisionInput {
  return {
    workflowExecutionId: queueItem.workflowExecutionId,
    queueItemId: queueItem.queueItemId,
    gateRevision: queueItem.gateRevision,
    decision: 'approve',
    decidedBy: 'contract-test'
  };
}

function assertBlockedOnSameQueueItem(
  state: FakeRecipeState,
  queueItem: FakeRecipeQueueItem
): void {
  assert.equal(state.status, 'blocked');
  assert.equal(state.nextStepIndex, 1);
  assert.equal(state.activeQueueItem?.queueItemId, queueItem.queueItemId);
  assert.equal(state.activeQueueItem?.gateRevision, queueItem.gateRevision);
  assert.equal(state.queueItems[0]?.status, 'open');
}
