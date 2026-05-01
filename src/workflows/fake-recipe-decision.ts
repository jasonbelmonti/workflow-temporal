import type {
  FakeRecipeDecisionInput,
  FakeRecipeDecisionResult,
  FakeRecipeQueueItem,
  FakeRecipeState
} from './fake-recipe-contract.js';
import { normalizeFakeRecipeDecisionInput } from './fake-recipe-normalize.js';
import { isTerminalFakeRecipeStatus } from './fake-recipe-state.js';

export function applyFakeRecipeDecision(
  state: FakeRecipeState,
  decision: FakeRecipeDecisionInput
): FakeRecipeDecisionResult {
  const normalizedDecision = normalizeFakeRecipeDecisionInput(decision);
  const activeQueueItem = state.activeQueueItem;

  if (isTerminalFakeRecipeStatus(state.status) || activeQueueItem === undefined) {
    return recordUnappliedDecisionResult(
      state,
      normalizedDecision,
      'no_effect',
      'No active gate is available for this workflow execution.'
    );
  }

  if (normalizedDecision.workflowExecutionId !== state.workflowExecutionId) {
    return recordUnappliedDecisionResult(
      state,
      normalizedDecision,
      'invalid',
      'Decision targets a different workflow execution.'
    );
  }

  if (normalizedDecision.queueItemId !== activeQueueItem.queueItemId) {
    return recordUnappliedDecisionResult(
      state,
      normalizedDecision,
      'invalid',
      'Decision targets a different queue item.'
    );
  }

  if (normalizedDecision.gateRevision !== activeQueueItem.gateRevision) {
    return recordUnappliedDecisionResult(
      state,
      normalizedDecision,
      'stale',
      'Decision targets a stale gate revision.'
    );
  }

  const selectedOption = activeQueueItem.decisionOptions.find(
    (option) => option.id === normalizedDecision.decision
  );

  if (selectedOption === undefined) {
    return recordUnappliedDecisionResult(
      state,
      normalizedDecision,
      'invalid',
      'Decision option is not available for this queue item.'
    );
  }

  if (selectedOption.effect === 'reject') {
    markActiveQueueItem(state, 'rejected');
    appendGateCompletion(state, activeQueueItem, 'rejected', selectedOption.id);
    state.status = 'failed';
    state.lastError = `Gate "${activeQueueItem.stepId}" was rejected by ${normalizedDecision.decidedBy}.`;
    delete state.activeQueueItem;

    return recordAppliedDecisionResult(
      state,
      activeQueueItem,
      selectedOption.id,
      'rejected',
      'Decision rejected the active gate.'
    );
  }

  markActiveQueueItem(state, 'accepted');
  appendGateCompletion(state, activeQueueItem, 'approved', selectedOption.id);
  state.artifactRefs = [...state.artifactRefs, ...activeQueueItem.artifactRefs];
  state.nextStepIndex += 1;
  state.status = 'running';
  delete state.activeQueueItem;

  return recordAppliedDecisionResult(
    state,
    activeQueueItem,
    selectedOption.id,
    'accepted',
    'Decision accepted the active gate.'
  );
}

function markActiveQueueItem(
  state: FakeRecipeState,
  status: Extract<FakeRecipeQueueItem['status'], 'accepted' | 'rejected'>
): void {
  const activeQueueItem = state.activeQueueItem;

  if (activeQueueItem === undefined) {
    return;
  }

  const updatedQueueItem = {
    ...activeQueueItem,
    status
  };

  state.activeQueueItem = updatedQueueItem;
  state.queueItems = state.queueItems.map((queueItem) =>
    queueItem.queueItemId === activeQueueItem.queueItemId ? updatedQueueItem : queueItem
  );
}

function recordDecisionResult(
  state: FakeRecipeState,
  result: FakeRecipeDecisionResult
): FakeRecipeDecisionResult {
  state.lastDecisionResult = result;
  return result;
}

function recordUnappliedDecisionResult(
  state: FakeRecipeState,
  decision: FakeRecipeDecisionInput,
  status: Extract<FakeRecipeDecisionResult['status'], 'invalid' | 'stale' | 'no_effect'>,
  message: string
): FakeRecipeDecisionResult {
  return recordDecisionResult(state, {
    status,
    applied: false,
    workflowExecutionId: state.workflowExecutionId,
    queueItemId: decision.queueItemId,
    gateRevision: decision.gateRevision,
    decision: decision.decision,
    runStatus: state.status,
    message
  });
}

function recordAppliedDecisionResult(
  state: FakeRecipeState,
  queueItem: FakeRecipeQueueItem,
  decision: string,
  status: Extract<FakeRecipeDecisionResult['status'], 'accepted' | 'rejected'>,
  message: string
): FakeRecipeDecisionResult {
  return recordDecisionResult(state, {
    status,
    applied: true,
    workflowExecutionId: state.workflowExecutionId,
    queueItemId: queueItem.queueItemId,
    gateRevision: queueItem.gateRevision,
    decision,
    runStatus: state.status,
    message
  });
}

function appendGateCompletion(
  state: FakeRecipeState,
  queueItem: FakeRecipeQueueItem,
  outcome: 'approved' | 'rejected',
  decision: string
): void {
  state.completedSteps = [
    ...state.completedSteps,
    {
      stepId: queueItem.stepId,
      kind: 'gate',
      outcome,
      decision,
      artifactRefs: queueItem.artifactRefs
    }
  ];
}
