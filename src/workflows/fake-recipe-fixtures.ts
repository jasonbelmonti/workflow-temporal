import type {
  FakeRecipeDecisionOption,
  FakeRecipeSnapshot
} from './fake-recipe-contract.js';

export const fakeRecipeApprovalDecisionOptions = [
  {
    id: 'approve',
    label: 'Approve',
    effect: 'approve'
  },
  {
    id: 'reject',
    label: 'Reject',
    effect: 'reject'
  }
] satisfies FakeRecipeDecisionOption[];

export const fakeRecipeSingleGateSnapshot: FakeRecipeSnapshot = {
  recipeId: 'fake.recipe.single-gate',
  recipeVersion: '1.0.0',
  snapshotId: 'fake-recipe-single-gate-snapshot@b866fc4',
  source: {
    kind: 'workflow-local-fixture',
    commit: 'b866fc4d27b863f12e43be2ce9f0748dbd6ce3c9',
    digest: 'sha256:fake-single-gate-wp1'
  },
  executionProfileId: 'fake-execution-profile.readwrite-local@wp1',
  objective: 'Prove fake recipe gate resume correlation.',
  steps: [
    {
      stepId: 'prepare-context',
      kind: 'activity',
      label: 'Prepare compact context',
      input: {
        text: 'Prepared fake compact context for gate review.'
      },
      artifactRefs: [
        {
          artifactId: 'prepare-context-result',
          kind: 'fake-result',
          path: 'fake://artifacts/prepare-context-result.json',
          createdAt: '2026-04-30T20:49:00.000Z'
        }
      ]
    },
    {
      stepId: 'operator-approval',
      kind: 'gate',
      label: 'Operator approval',
      prompt: 'Approve the fake run to continue to terminal success.',
      decisionOptions: fakeRecipeApprovalDecisionOptions,
      artifactRefs: [
        {
          artifactId: 'operator-approval-packet',
          kind: 'review-packet',
          path: 'fake://artifacts/operator-approval-packet.json',
          createdAt: '2026-04-30T20:50:00.000Z'
        }
      ],
      compactContext: {
        title: 'Fake approval gate',
        summary: 'Workflow is blocked on a fake approval gate with compact state only.',
        fields: {
          risk: 'resume-correlation',
          scope: 'fake-only'
        }
      }
    },
    {
      stepId: 'complete-run',
      kind: 'activity',
      label: 'Complete fake run',
      input: {
        text: 'Completed fake recipe after approval.'
      },
      artifactRefs: [
        {
          artifactId: 'complete-run-result',
          kind: 'fake-result',
          path: 'fake://artifacts/complete-run-result.json',
          createdAt: '2026-04-30T20:51:00.000Z'
        }
      ]
    }
  ]
};

export const fakeRecipeRejectableGateSnapshot: FakeRecipeSnapshot = {
  ...fakeRecipeSingleGateSnapshot,
  snapshotId: 'fake-recipe-rejectable-gate-snapshot@b866fc4',
  recipeId: 'fake.recipe.rejectable-gate'
};
