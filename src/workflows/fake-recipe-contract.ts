export const fakeRecipeGateWorkflowType = 'agent.fakeRecipeGate';
export const fakeRecipeGateTaskQueue = 'hello-world';
export const getFakeRecipeGateStateQueryName = 'getFakeRecipeGateState';
export const submitFakeRecipeDecisionUpdateName = 'submitFakeRecipeDecision';

export const fakeRecipeRunStatuses = [
  'running',
  'blocked',
  'completed',
  'failed'
] as const;
export const fakeRecipeQueueItemStatuses = [
  'open',
  'accepted',
  'rejected'
] as const;
export const fakeRecipeDecisionResultStatuses = [
  'accepted',
  'stale',
  'invalid',
  'rejected',
  'no_effect'
] as const;
export const fakeRecipeDecisionEffects = [
  'approve',
  'reject'
] as const;

export type FakeRecipeRunStatus = (typeof fakeRecipeRunStatuses)[number];
export type FakeRecipeQueueItemStatus = (typeof fakeRecipeQueueItemStatuses)[number];
export type FakeRecipeDecisionResultStatus =
  (typeof fakeRecipeDecisionResultStatuses)[number];
export type FakeRecipeDecisionEffect = (typeof fakeRecipeDecisionEffects)[number];

export interface FakeRecipeArtifactRef {
  artifactId: string;
  kind: string;
  path: string;
  createdAt: string;
}

export interface FakeRecipeCompactContext {
  title: string;
  summary: string;
  fields?: Record<string, string>;
}

export interface FakeRecipeDecisionOption {
  id: string;
  label: string;
  effect: FakeRecipeDecisionEffect;
}

export interface FakeRecipePinnedSource {
  kind: 'workflow-local-fixture';
  commit: string;
  digest: string;
}

export interface FakeRecipeSnapshot {
  recipeId: string;
  recipeVersion: string;
  snapshotId: string;
  source: FakeRecipePinnedSource;
  executionProfileId: string;
  objective: string;
  steps: FakeRecipeStep[];
}

export type FakeRecipeStep = FakeRecipeActivityStep | FakeRecipeGateStep;

export interface FakeRecipeActivityStep {
  stepId: string;
  kind: 'activity';
  label: string;
  input: FakeRecipeActivityInput;
  artifactRefs: FakeRecipeArtifactRef[];
}

export interface FakeRecipeActivityInput {
  text: string;
}

export interface FakeRecipeGateStep {
  stepId: string;
  kind: 'gate';
  label: string;
  prompt: string;
  decisionOptions: FakeRecipeDecisionOption[];
  artifactRefs: FakeRecipeArtifactRef[];
  compactContext: FakeRecipeCompactContext;
}

export interface FakeRecipeInput {
  recipeSnapshot: FakeRecipeSnapshot;
  runLabel?: string;
}

export interface FakeRecipeInputCandidate {
  recipeSnapshot?: unknown;
  runLabel?: unknown;
}

export interface FakeRecipeActivityRequest {
  workflowExecutionId: string;
  snapshotId: string;
  stepId: string;
  input: FakeRecipeActivityInput;
  artifactRefs: FakeRecipeArtifactRef[];
}

export interface FakeRecipeActivityResult {
  stepId: string;
  text: string;
  artifactRefs: FakeRecipeArtifactRef[];
}

export interface FakeRecipeQueueItem {
  workflowExecutionId: string;
  workflowId: string;
  runId: string;
  queueItemId: string;
  stepId: string;
  gateRevision: number;
  status: FakeRecipeQueueItemStatus;
  decisionOptions: FakeRecipeDecisionOption[];
  artifactRefs: FakeRecipeArtifactRef[];
  compactContext: FakeRecipeCompactContext;
}

export interface FakeRecipeDecisionInput {
  workflowExecutionId: string;
  queueItemId: string;
  gateRevision: number;
  decision: string;
  decidedBy: string;
  reason?: string;
}

export interface FakeRecipeDecisionResult {
  status: FakeRecipeDecisionResultStatus;
  applied: boolean;
  workflowExecutionId: string;
  queueItemId?: string;
  gateRevision?: number;
  decision?: string;
  runStatus: FakeRecipeRunStatus;
  message: string;
}

export interface FakeRecipeCompletedStep {
  stepId: string;
  kind: FakeRecipeStep['kind'];
  outcome: string;
  text?: string;
  decision?: string;
  artifactRefs: FakeRecipeArtifactRef[];
}

export interface FakeRecipeState {
  workflowExecutionId: string;
  workflowId: string;
  runId: string;
  status: FakeRecipeRunStatus;
  runLabel?: string;
  recipeSnapshot: FakeRecipeSnapshot;
  executionProfileId: string;
  nextStepIndex: number;
  nextGateRevision: number;
  activeQueueItem?: FakeRecipeQueueItem;
  queueItems: FakeRecipeQueueItem[];
  completedSteps: FakeRecipeCompletedStep[];
  artifactRefs: FakeRecipeArtifactRef[];
  lastDecisionResult?: FakeRecipeDecisionResult;
  lastError?: string;
}

export interface FakeRecipeResult {
  workflowExecutionId: string;
  workflowId: string;
  runId: string;
  status: Extract<FakeRecipeRunStatus, 'completed' | 'failed'>;
  recipeSnapshotId: string;
  executionProfileId: string;
  queueItems: FakeRecipeQueueItem[];
  completedSteps: FakeRecipeCompletedStep[];
  artifactRefs: FakeRecipeArtifactRef[];
  lastDecisionResult?: FakeRecipeDecisionResult;
  lastError?: string;
}

export type FakeRecipeGateWorkflow = (
  input: FakeRecipeInput
) => Promise<FakeRecipeResult>;

export interface BuildFakeRecipeWorkflowIdOptions {
  randomId?: () => string;
}
