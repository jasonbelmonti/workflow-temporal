# EVD-1: Fake Recipe-To-Gate Proving Slice

Captured: 2026-04-30 16:23 CDT

Branch: `codex/bel-912-fake-recipe-gate`

Baseline: `origin/main` at `b866fc4d27b863f12e43be2ce9f0748dbd6ce3c9`

## Objective

Prove WP-1 / VAL-1 with fake-only workflow-local fixtures: pinned recipe snapshot starts, durable queue items, typed Temporal Update decision results, stale and mismatched decision rejection, targeted approval resume, terminal fake completion, and no forbidden registry edits.

## Implementation Evidence

- Added additive workflow type `agent.fakeRecipeGate`.
- Added workflow-local fake recipe snapshot fixture `fake-recipe-single-gate-snapshot@b866fc4`.
- Added fake activity boundary `runFakeRecipeStep` for non-gate recipe steps.
- Added typed decision Update name `submitFakeRecipeDecision`.
- Preserved existing `agent.helloClaudex`; no hello-Claudex workflow or Claudex activity files changed.

## VAL-1 Proof

Automated test coverage:

- `fake recipe input resolution preserves a pinned workflow-local snapshot`
- `fake recipe queue items contain the VAL-1 durable gate payload fields`
- `fake recipe decisions reject stale and mismatched targets without resuming work`
- `fake recipe matching approvals resume the current gate and terminal result is compact`
- `fake recipe matching rejection returns a typed rejected decision result`
- `bundled fake recipe workflow isolates queue decisions across multiple runs`

The bundled smoke test starts three fake recipe workflow runs from the pinned workflow-local snapshot. This satisfies the requirement for at least two runs and creates three open queue items before approval. Each queue item contains:

- workflow execution ID
- workflow ID and run ID
- queue item ID
- gate revision
- decision options
- artifact refs
- compact context

The smoke test submits these negative decisions against the first run while other runs remain blocked:

- wrong workflow execution ID -> typed `DecisionResult.status === "invalid"`
- wrong queue item ID -> typed `DecisionResult.status === "invalid"`
- stale gate revision -> typed `DecisionResult.status === "stale"`

The smoke test then approves only run A and verifies runs B and C remain blocked on their original queue items. It approves B and C afterward and verifies all targeted runs reach terminal `completed` state.

## Validation Commands

```text
npm run check
status: pass
```

```text
npm test
status: pass
tests: 59 passed
new relevant tests: fake recipe contract/state tests
```

```text
npm run test:smoke
status: pass
tests: 3 passed
new relevant test: bundled fake recipe workflow isolates queue decisions across multiple runs
```

## Registry Boundary Evidence

Changed and untracked implementation paths after WP-1:

```text
package.json
src/activities/index.ts
src/activities/run-fake-recipe-step.ts
src/testing/fake-recipe-bundle-smoke.test.ts
src/testing/fake-recipe-contract.test.ts
src/workflows/fake-recipe-contract.ts
src/workflows/fake-recipe-decision.ts
src/workflows/fake-recipe-fixtures.ts
src/workflows/fake-recipe-normalize.ts
src/workflows/fake-recipe-state.ts
src/workflows/fake-recipe-workflow-id.ts
src/workflows/fake-recipe-workflow.ts
src/workflows/index.ts
```

Forbidden registry path check:

```text
(git diff --name-only; git ls-files --others --exclude-standard) | sort | rg '(^|/)agent-config-registry/|contracts|schemas|validation|catalog'
status: no matches
```

Conclusion: WP-1 changed no `agent-config-registry` contract, schema, validation, or catalog files.

## Determinism And Compatibility Evidence

- `src/workflows/fake-recipe-workflow.ts` imports Temporal workflow APIs, activity types, fake recipe contracts, and deterministic state/decision/normalization helpers only.
- Fake side effects are activity-boundary only through `runFakeRecipeStep`.
- Workflow state stores compact artifact refs, not large logs, diffs, transcripts, or packets.
- `git diff` for existing `agent.helloClaudex` workflow and Claudex activity files is empty.

## MS-1 Note

This evidence completes VAL-1 for WP-1. MS-1 still requires the planned REV-1 / REV-3 review and Jason Belmonti approval before WP-2 or WP-3 expansion.
