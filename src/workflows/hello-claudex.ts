import {
  CancellationScope,
  condition,
  defineQuery,
  defineSignal,
  isCancellation,
  log,
  proxyActivities,
  setHandler,
  workflowInfo
} from '@temporalio/workflow';

import type * as helloClaudexActivities from '../activities/index.js';
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
import {
  applyHelloClaudexTurnResponse,
  buildHelloClaudexTurnRequest,
  cancelHelloClaudexTurn,
  failHelloClaudexTurn
} from './hello-claudex-turn.js';

const { runClaudexTurn } = proxyActivities<typeof helloClaudexActivities>({
  startToCloseTimeout: '15 minutes',
  heartbeatTimeout: '30 seconds',
  retry: {
    maximumAttempts: 1
  }
});

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
  let activeTurnScope: CancellationScope | undefined;
  let cancelRunRequested = false;

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

    cancelRunRequested = true;
    cancelHelloClaudexTurn(state);
    state.cancelReason = cancellation.value.reason;
    activeTurnScope?.cancel();
  });

  while (!isTerminalHelloClaudexStatus(state.status)) {
    try {
      if (state.status !== 'running') {
        await condition(
          () => state.status === 'running' || isTerminalHelloClaudexStatus(state.status)
        );
        continue;
      }

      const turnScope = new CancellationScope();
      activeTurnScope = turnScope;
      const request = buildHelloClaudexTurnRequest(state);
      // Clear only the input captured in this request; later signals remain queued.
      const consumedPendingHumanInput = state.pendingHumanInput;
      const response = await turnScope.run(() =>
        runClaudexTurn(request)
      );

      if (turnScope.consideredCancelled) {
        if (!cancelRunRequested) {
          await turnScope.cancelRequested;
        }
        continue;
      }

      if (!isTerminalHelloClaudexStatus(state.status)) {
        applyHelloClaudexTurnResponse(state, response, {
          consumedPendingHumanInput
        });
      }
    } catch (error: unknown) {
      if (isCancellation(error)) {
        if (!cancelRunRequested) {
          throw error;
        }
      } else if (!isTerminalHelloClaudexStatus(state.status)) {
        failHelloClaudexTurn(state, error);
      }
    } finally {
      activeTurnScope = undefined;
    }
  }

  return buildHelloClaudexResult(state);
}

export { helloClaudexWorkflow as 'agent.helloClaudex' };

function logInvalidSignalPayload(signalName: string, errorMessage: string): void {
  log.warn('Ignored invalid hello Claudex signal payload', {
    signalName,
    errorMessage
  });
}
