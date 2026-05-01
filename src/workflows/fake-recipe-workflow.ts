import {
  condition,
  defineQuery,
  defineUpdate,
  proxyActivities,
  setHandler,
  workflowInfo
} from '@temporalio/workflow';

import type * as fakeRecipeActivities from '../activities/index.js';
import {
  getFakeRecipeGateStateQueryName,
  submitFakeRecipeDecisionUpdateName,
  type FakeRecipeDecisionInput,
  type FakeRecipeDecisionResult,
  type FakeRecipeGateWorkflow,
  type FakeRecipeInput,
  type FakeRecipeResult,
  type FakeRecipeState
} from './fake-recipe-contract.js';
import {
  applyFakeRecipeDecision
} from './fake-recipe-decision.js';
import {
  applyFakeRecipeActivityResult,
  buildFakeRecipeActivityRequest,
  buildFakeRecipeResult,
  completeFakeRecipeRun,
  createInitialFakeRecipeState,
  failFakeRecipeRun,
  getCurrentFakeRecipeStep,
  isTerminalFakeRecipeStatus,
  normalizeFakeRecipeDecisionInput,
  openFakeRecipeGate
} from './fake-recipe-state.js';

const { runFakeRecipeStep } = proxyActivities<typeof fakeRecipeActivities>({
  startToCloseTimeout: '1 minute',
  retry: {
    maximumAttempts: 1
  }
});

const getFakeRecipeGateStateQuery = defineQuery<FakeRecipeState>(
  getFakeRecipeGateStateQueryName
);
const submitFakeRecipeDecisionUpdate = defineUpdate<
  FakeRecipeDecisionResult,
  [FakeRecipeDecisionInput]
>(submitFakeRecipeDecisionUpdateName);

export async function fakeRecipeGateWorkflow(
  input: FakeRecipeInput
): Promise<FakeRecipeResult> {
  const info = workflowInfo();
  const state = createInitialFakeRecipeState(input, info.workflowId, info.runId);

  setHandler(getFakeRecipeGateStateQuery, () => state);
  setHandler(
    submitFakeRecipeDecisionUpdate,
    (decision) => applyFakeRecipeDecision(state, decision),
    {
      validator: (decision) => {
        normalizeFakeRecipeDecisionInput(decision);
      }
    }
  );

  while (!isTerminalFakeRecipeStatus(state.status)) {
    const step = getCurrentFakeRecipeStep(state);

    if (step === undefined) {
      completeFakeRecipeRun(state);
      break;
    }

    if (step.kind === 'activity') {
      const response = await runFakeRecipeStep(buildFakeRecipeActivityRequest(state, step));
      applyFakeRecipeActivityResult(state, response);
      continue;
    }

    if (state.activeQueueItem === undefined) {
      openFakeRecipeGate(state, step);
    }

    await condition(
      () => state.status !== 'blocked' || isTerminalFakeRecipeStatus(state.status)
    );
  }

  if (!isTerminalFakeRecipeStatus(state.status)) {
    failFakeRecipeRun(state, 'Fake recipe workflow stopped before terminal state.');
  }

  return buildFakeRecipeResult(state);
}

export { fakeRecipeGateWorkflow as 'agent.fakeRecipeGate' };

const typeCheckWorkflow: FakeRecipeGateWorkflow = fakeRecipeGateWorkflow;
void typeCheckWorkflow;
