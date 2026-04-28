import type {
  ClaudexArtifactRef,
  ClaudexProvider,
  ClaudexRequestedProvider,
  ClaudexSessionRef,
  ClaudexTurnFailure
} from '../claudex-turn/turn-contract.js';

export const helloClaudexWorkflowType = 'agent.helloClaudex';
// BEL-770 shares the existing worker queue; dedicated queue topology belongs with worker rollout.
export const helloClaudexTaskQueue = 'hello-world';
export const getHelloClaudexStateQueryName = 'getHelloClaudexState';
export const submitHumanInputSignalName = 'submitHumanInput';
export const cancelRunSignalName = 'cancelRun';

export const helloClaudexProviders = [
  'claude',
  'codex'
] as const satisfies readonly ClaudexProvider[];
export const helloClaudexRequestedProviders = [
  'claude',
  'codex',
  'auto'
] as const satisfies readonly ClaudexRequestedProvider[];
export const helloClaudexStatuses = [
  'running',
  'waiting_for_input',
  'completed',
  'failed',
  'cancelled'
] as const;

export const defaultHelloClaudexProvider: HelloClaudexRequestedProvider = 'auto';

export type HelloClaudexProvider = ClaudexProvider;
export type HelloClaudexRequestedProvider = ClaudexRequestedProvider;
export type HelloClaudexSessionRef = ClaudexSessionRef;
export type HelloClaudexArtifactRef = ClaudexArtifactRef;
export type HelloClaudexTurnFailure = ClaudexTurnFailure;
export type HelloClaudexStatus = (typeof helloClaudexStatuses)[number];
export type HelloClaudexTerminalStatus = Extract<
  HelloClaudexStatus,
  'completed' | 'failed' | 'cancelled'
>;

export interface HelloClaudexInput {
  objective: string;
  provider: HelloClaudexRequestedProvider;
  workingDirectory: string;
}

export interface HelloClaudexInputCandidate {
  objective?: string;
  provider?: string;
  workingDirectory?: string;
}

export interface SubmitHumanInputSignal {
  text: string;
  correlationId?: string;
}

export interface CancelRunSignal {
  reason?: string;
}

export interface HelloClaudexPendingHumanInput {
  text: string;
  correlationId?: string;
}

export interface HelloClaudexState {
  workflowId: string;
  status: HelloClaudexStatus;
  objective: string;
  requestedProvider: HelloClaudexRequestedProvider;
  provider?: HelloClaudexProvider;
  workingDirectory: string;
  turnCount: number;
  humanInputCount: number;
  waitingReason?: string;
  latestText?: string;
  latestSummary?: string;
  pendingHumanInput?: HelloClaudexPendingHumanInput;
  sessionRef?: HelloClaudexSessionRef;
  artifactRefs: HelloClaudexArtifactRef[];
  lastError?: string;
  lastFailure?: HelloClaudexTurnFailure;
  cancelReason?: string;
}

export interface HelloClaudexResult {
  workflowId: string;
  status: HelloClaudexTerminalStatus;
  objective: string;
  requestedProvider: HelloClaudexRequestedProvider;
  provider?: HelloClaudexProvider;
  workingDirectory: string;
  turnCount: number;
  latestText?: string;
  latestSummary?: string;
  sessionRef?: HelloClaudexSessionRef;
  artifactRefs: HelloClaudexArtifactRef[];
  lastError?: string;
  lastFailure?: HelloClaudexTurnFailure;
  cancelReason?: string;
}

export type HelloClaudexWorkflow = (input: HelloClaudexInput) => Promise<HelloClaudexResult>;

export interface ResolveHelloClaudexInputOptions {
  defaultProvider?: HelloClaudexRequestedProvider;
  defaultWorkingDirectory?: string;
}

export interface BuildHelloClaudexWorkflowIdOptions {
  randomId?: () => string;
}
