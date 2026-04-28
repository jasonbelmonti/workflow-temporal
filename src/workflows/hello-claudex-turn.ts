import type {
  ClaudexTurnRequest,
  ClaudexTurnResponse
} from '../claudex-turn/turn-contract.js';
import type {
  HelloClaudexPendingHumanInput,
  HelloClaudexState
} from './hello-claudex-contract.js';

export function buildHelloClaudexTurnRequest(
  state: HelloClaudexState
): ClaudexTurnRequest {
  const request: ClaudexTurnRequest = {
    objective: state.objective,
    provider: state.requestedProvider,
    workingDirectory: state.workingDirectory,
    turnNumber: state.turnCount + 1
  };

  if (state.sessionRef !== undefined) {
    request.priorSessionRef = state.sessionRef;
  }

  if (state.latestSummary !== undefined) {
    request.priorSummary = state.latestSummary;
  }

  if (state.pendingHumanInput !== undefined) {
    request.humanInput = state.pendingHumanInput.text;
  }

  return request;
}

export function applyHelloClaudexTurnResponse(
  state: HelloClaudexState,
  response: ClaudexTurnResponse,
  options: ApplyHelloClaudexTurnResponseOptions = {}
): void {
  state.turnCount += 1;
  state.latestText = response.text;
  state.artifactRefs = [...state.artifactRefs, ...response.artifactRefs];
  clearConsumedPendingHumanInput(state, options.consumedPendingHumanInput);

  if (response.provider !== undefined) {
    state.provider = response.provider;
  }

  if (response.sessionRef !== undefined) {
    state.sessionRef = response.sessionRef;
  }

  if (response.outcome === 'completed') {
    state.status = 'completed';
    delete state.pendingHumanInput;
    delete state.waitingReason;
    delete state.lastError;
    return;
  }

  if (response.outcome === 'failed') {
    state.status = 'failed';
    state.lastError = response.errorMessage;
    delete state.pendingHumanInput;
    delete state.waitingReason;
    return;
  }

  if (state.pendingHumanInput !== undefined) {
    state.status = 'running';
    delete state.waitingReason;
    delete state.lastError;
    return;
  }

  state.status = 'waiting_for_input';
  state.waitingReason = response.waitingReason;
  delete state.lastError;
}

export function failHelloClaudexTurn(state: HelloClaudexState, error: unknown): void {
  state.status = 'failed';
  state.lastError = getErrorMessage(error);
  delete state.pendingHumanInput;
  delete state.waitingReason;
}

export function cancelHelloClaudexTurn(state: HelloClaudexState): void {
  state.status = 'cancelled';
  delete state.pendingHumanInput;
  delete state.lastError;
  delete state.waitingReason;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface ApplyHelloClaudexTurnResponseOptions {
  consumedPendingHumanInput?: HelloClaudexPendingHumanInput;
}

function clearConsumedPendingHumanInput(
  state: HelloClaudexState,
  consumedPendingHumanInput: HelloClaudexPendingHumanInput | undefined
): void {
  if (
    consumedPendingHumanInput !== undefined &&
    state.pendingHumanInput === consumedPendingHumanInput
  ) {
    delete state.pendingHumanInput;
  }
}
