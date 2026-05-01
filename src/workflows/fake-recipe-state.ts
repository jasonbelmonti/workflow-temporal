import {
  type FakeRecipeActivityRequest,
  type FakeRecipeActivityResult,
  type FakeRecipeActivityStep,
  type FakeRecipeGateStep,
  type FakeRecipeInput,
  type FakeRecipeQueueItem,
  type FakeRecipeResult,
  type FakeRecipeRunStatus,
  type FakeRecipeState,
  type FakeRecipeStep
} from './fake-recipe-contract.js';
import {
  normalizeFakeRecipeDecisionInput,
  resolveFakeRecipeInput,
  trimRequiredString
} from './fake-recipe-normalize.js';

export {
  normalizeFakeRecipeDecisionInput,
  resolveFakeRecipeInput
};

export function buildFakeRecipeWorkflowExecutionId(
  workflowId: string,
  runId: string
): string {
  return `${trimRequiredString(workflowId, 'workflowId')}/${trimRequiredString(runId, 'runId')}`;
}

export function createInitialFakeRecipeState(
  input: FakeRecipeInput,
  workflowId: string,
  runId: string
): FakeRecipeState {
  const resolvedInput = resolveFakeRecipeInput(input);
  const workflowExecutionId = buildFakeRecipeWorkflowExecutionId(workflowId, runId);
  const state: FakeRecipeState = {
    workflowExecutionId,
    workflowId: trimRequiredString(workflowId, 'workflowId'),
    runId: trimRequiredString(runId, 'runId'),
    status: 'running',
    recipeSnapshot: resolvedInput.recipeSnapshot,
    executionProfileId: resolvedInput.recipeSnapshot.executionProfileId,
    nextStepIndex: 0,
    nextGateRevision: 1,
    queueItems: [],
    completedSteps: [],
    artifactRefs: []
  };

  if (resolvedInput.runLabel !== undefined) {
    state.runLabel = resolvedInput.runLabel;
  }

  return state;
}

export function isTerminalFakeRecipeStatus(
  status: FakeRecipeRunStatus
): status is Extract<FakeRecipeRunStatus, 'completed' | 'failed'> {
  return status === 'completed' || status === 'failed';
}

export function getCurrentFakeRecipeStep(
  state: FakeRecipeState
): FakeRecipeStep | undefined {
  return state.recipeSnapshot.steps[state.nextStepIndex];
}

export function buildFakeRecipeActivityRequest(
  state: FakeRecipeState,
  step: FakeRecipeActivityStep
): FakeRecipeActivityRequest {
  return {
    workflowExecutionId: state.workflowExecutionId,
    snapshotId: state.recipeSnapshot.snapshotId,
    stepId: step.stepId,
    input: step.input,
    artifactRefs: step.artifactRefs
  };
}

export function applyFakeRecipeActivityResult(
  state: FakeRecipeState,
  result: FakeRecipeActivityResult
): void {
  const step = getCurrentFakeRecipeStep(state);

  if (step === undefined || step.kind !== 'activity' || step.stepId !== result.stepId) {
    failFakeRecipeRun(state, `Unexpected fake activity result for step "${result.stepId}".`);
    return;
  }

  state.completedSteps = [
    ...state.completedSteps,
    {
      stepId: step.stepId,
      kind: 'activity',
      outcome: 'completed',
      text: result.text,
      artifactRefs: result.artifactRefs
    }
  ];
  state.artifactRefs = [...state.artifactRefs, ...result.artifactRefs];
  state.nextStepIndex += 1;
}

export function openFakeRecipeGate(
  state: FakeRecipeState,
  step: FakeRecipeGateStep
): FakeRecipeQueueItem {
  const queueItem: FakeRecipeQueueItem = {
    workflowExecutionId: state.workflowExecutionId,
    workflowId: state.workflowId,
    runId: state.runId,
    queueItemId: buildFakeRecipeQueueItemId(state.workflowId, step.stepId, state.nextGateRevision),
    stepId: step.stepId,
    gateRevision: state.nextGateRevision,
    status: 'open',
    decisionOptions: step.decisionOptions,
    artifactRefs: step.artifactRefs,
    compactContext: step.compactContext
  };

  state.nextGateRevision += 1;
  state.activeQueueItem = queueItem;
  state.queueItems = [...state.queueItems, queueItem];
  state.status = 'blocked';

  return queueItem;
}

export function completeFakeRecipeRun(state: FakeRecipeState): void {
  state.status = 'completed';
}

export function failFakeRecipeRun(state: FakeRecipeState, message: string): void {
  state.status = 'failed';
  state.lastError = message;
}

export function buildFakeRecipeResult(state: FakeRecipeState): FakeRecipeResult {
  if (!isTerminalFakeRecipeStatus(state.status)) {
    throw new TypeError(`Cannot build fake recipe result for non-terminal status "${state.status}".`);
  }

  const result: FakeRecipeResult = {
    workflowExecutionId: state.workflowExecutionId,
    workflowId: state.workflowId,
    runId: state.runId,
    status: state.status,
    recipeSnapshotId: state.recipeSnapshot.snapshotId,
    executionProfileId: state.executionProfileId,
    queueItems: state.queueItems,
    completedSteps: state.completedSteps,
    artifactRefs: state.artifactRefs
  };

  if (state.lastDecisionResult !== undefined) {
    result.lastDecisionResult = state.lastDecisionResult;
  }

  if (state.lastError !== undefined) {
    result.lastError = state.lastError;
  }

  return result;
}

function buildFakeRecipeQueueItemId(
  workflowId: string,
  stepId: string,
  gateRevision: number
): string {
  return `${workflowId}:${stepId}:r${gateRevision}`;
}
