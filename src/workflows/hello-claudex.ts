import {
  condition,
  defineQuery,
  defineSignal,
  log,
  setHandler,
  workflowInfo
} from '@temporalio/workflow';

import {
  cancelRunSignalName,
  getHelloClaudexStateQueryName,
  submitHumanInputSignalName,
  type CancelRunSignal,
  type HelloClaudexInput,
  type HelloClaudexResult,
  type HelloClaudexState,
  type SubmitHumanInputSignal
} from './hello-claudex-contract.js';
import {
  buildHelloClaudexResult,
  createInitialHelloClaudexState,
  isTerminalHelloClaudexStatus,
  tryNormalizeCancelRunSignal,
  tryNormalizeSubmitHumanInputSignal
} from './hello-claudex-state.js';

const getHelloClaudexStateQuery = defineQuery<HelloClaudexState>(
  getHelloClaudexStateQueryName
);
const submitHumanInputSignal = defineSignal<[SubmitHumanInputSignal]>(
  submitHumanInputSignalName
);
const cancelRunSignal = defineSignal<[CancelRunSignal?]>(cancelRunSignalName);

export async function helloClaudexWorkflow(
  input: HelloClaudexInput
): Promise<HelloClaudexResult> {
  const state = createInitialHelloClaudexState(input, workflowInfo().workflowId);

  setHandler(getHelloClaudexStateQuery, () => state);
  setHandler(submitHumanInputSignal, (signal) => {
    if (isTerminalHelloClaudexStatus(state.status)) {
      return;
    }

    const pendingHumanInput = tryNormalizeSubmitHumanInputSignal(signal);

    if (!pendingHumanInput.valid) {
      logInvalidSignalPayload(submitHumanInputSignalName, pendingHumanInput.errorMessage);
      return;
    }

    state.pendingHumanInput = pendingHumanInput.value;
    state.humanInputCount += 1;

    if (state.status === 'waiting_for_input') {
      state.status = 'running';
      delete state.waitingReason;
    }
  });
  setHandler(cancelRunSignal, (signal) => {
    if (isTerminalHelloClaudexStatus(state.status)) {
      return;
    }

    const cancellation = tryNormalizeCancelRunSignal(signal);

    if (!cancellation.valid) {
      logInvalidSignalPayload(cancelRunSignalName, cancellation.errorMessage);
      return;
    }

    state.status = 'cancelled';
    state.cancelReason = cancellation.value.reason;
  });

  await condition(() => isTerminalHelloClaudexStatus(state.status));

  return buildHelloClaudexResult(state);
}

export { helloClaudexWorkflow as 'agent.helloClaudex' };

function logInvalidSignalPayload(signalName: string, errorMessage: string): void {
  log.warn('Ignored invalid hello Claudex signal payload', {
    signalName,
    errorMessage
  });
}
