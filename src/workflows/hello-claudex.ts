import { condition, defineQuery, defineSignal, setHandler, workflowInfo } from '@temporalio/workflow';

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
  normalizeCancelRunSignal,
  normalizeSubmitHumanInputSignal
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

    state.pendingHumanInput = normalizeSubmitHumanInputSignal(signal);
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

    const cancellation = normalizeCancelRunSignal(signal);
    state.status = 'cancelled';
    state.cancelReason = cancellation.reason;
  });

  await condition(() => isTerminalHelloClaudexStatus(state.status));

  return buildHelloClaudexResult(state);
}

export { helloClaudexWorkflow as 'agent.helloClaudex' };
