import {
  fakeRecipeDecisionEffects,
  type FakeRecipeActivityStep,
  type FakeRecipeArtifactRef,
  type FakeRecipeCompactContext,
  type FakeRecipeDecisionInput,
  type FakeRecipeDecisionOption,
  type FakeRecipeGateStep,
  type FakeRecipeInput,
  type FakeRecipeInputCandidate,
  type FakeRecipePinnedSource,
  type FakeRecipeSnapshot,
  type FakeRecipeStep
} from './fake-recipe-contract.js';

export function resolveFakeRecipeInput(
  input: FakeRecipeInputCandidate
): FakeRecipeInput {
  if (!isRecord(input)) {
    throw new TypeError('fake recipe input must be a JSON object.');
  }

  const recipeSnapshot = normalizeFakeRecipeSnapshot(input.recipeSnapshot);
  const runLabel = trimOptionalString(input.runLabel, 'runLabel');

  return runLabel === undefined ? { recipeSnapshot } : { recipeSnapshot, runLabel };
}

export function normalizeFakeRecipeDecisionInput(
  decision: unknown
): FakeRecipeDecisionInput {
  if (!isRecord(decision)) {
    throw new TypeError('fake recipe decision must be a JSON object.');
  }

  const normalized: FakeRecipeDecisionInput = {
    workflowExecutionId: trimRequiredString(
      decision.workflowExecutionId,
      'decision.workflowExecutionId'
    ),
    queueItemId: trimRequiredString(decision.queueItemId, 'decision.queueItemId'),
    gateRevision: normalizePositiveInteger(decision.gateRevision, 'decision.gateRevision'),
    decision: trimRequiredString(decision.decision, 'decision.decision'),
    decidedBy: trimRequiredString(decision.decidedBy, 'decision.decidedBy')
  };
  const reason = trimOptionalString(decision.reason, 'decision.reason');

  return reason === undefined ? normalized : { ...normalized, reason };
}

export function trimRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new TypeError(`${fieldName} must be a non-empty string.`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new TypeError(`${fieldName} must be a non-empty string.`);
  }

  return trimmed;
}

function normalizeFakeRecipeSnapshot(value: unknown): FakeRecipeSnapshot {
  if (!isRecord(value)) {
    throw new TypeError('recipeSnapshot must be a JSON object.');
  }

  const stepsValue = value.steps;

  if (!Array.isArray(stepsValue) || stepsValue.length === 0) {
    throw new TypeError('recipeSnapshot.steps must be a non-empty array.');
  }

  return {
    recipeId: trimRequiredString(value.recipeId, 'recipeSnapshot.recipeId'),
    recipeVersion: trimRequiredString(value.recipeVersion, 'recipeSnapshot.recipeVersion'),
    snapshotId: trimRequiredString(value.snapshotId, 'recipeSnapshot.snapshotId'),
    source: normalizePinnedSource(value.source),
    executionProfileId: trimRequiredString(
      value.executionProfileId,
      'recipeSnapshot.executionProfileId'
    ),
    objective: trimRequiredString(value.objective, 'recipeSnapshot.objective'),
    steps: stepsValue.map((step, index) => normalizeFakeRecipeStep(step, index))
  };
}

function normalizePinnedSource(value: unknown): FakeRecipePinnedSource {
  if (!isRecord(value)) {
    throw new TypeError('recipeSnapshot.source must be a JSON object.');
  }

  const kind = trimRequiredString(value.kind, 'recipeSnapshot.source.kind');

  if (kind !== 'workflow-local-fixture') {
    throw new TypeError('recipeSnapshot.source.kind must be workflow-local-fixture.');
  }

  return {
    kind,
    commit: trimRequiredString(value.commit, 'recipeSnapshot.source.commit'),
    digest: trimRequiredString(value.digest, 'recipeSnapshot.source.digest')
  };
}

function normalizeFakeRecipeStep(value: unknown, index: number): FakeRecipeStep {
  if (!isRecord(value)) {
    throw new TypeError(`recipeSnapshot.steps[${index}] must be a JSON object.`);
  }

  const kind = trimRequiredString(value.kind, `recipeSnapshot.steps[${index}].kind`);

  if (kind === 'activity') {
    return normalizeActivityStep(value, index);
  }

  if (kind === 'gate') {
    return normalizeGateStep(value, index);
  }

  throw new TypeError(`recipeSnapshot.steps[${index}].kind must be activity or gate.`);
}

function normalizeActivityStep(
  value: Record<string, unknown>,
  index: number
): FakeRecipeActivityStep {
  const inputValue = value.input;

  if (!isRecord(inputValue)) {
    throw new TypeError(`recipeSnapshot.steps[${index}].input must be a JSON object.`);
  }

  return {
    stepId: trimRequiredString(value.stepId, `recipeSnapshot.steps[${index}].stepId`),
    kind: 'activity',
    label: trimRequiredString(value.label, `recipeSnapshot.steps[${index}].label`),
    input: {
      text: trimRequiredString(inputValue.text, `recipeSnapshot.steps[${index}].input.text`)
    },
    artifactRefs: normalizeArtifactRefs(
      value.artifactRefs,
      `recipeSnapshot.steps[${index}].artifactRefs`
    )
  };
}

function normalizeGateStep(
  value: Record<string, unknown>,
  index: number
): FakeRecipeGateStep {
  return {
    stepId: trimRequiredString(value.stepId, `recipeSnapshot.steps[${index}].stepId`),
    kind: 'gate',
    label: trimRequiredString(value.label, `recipeSnapshot.steps[${index}].label`),
    prompt: trimRequiredString(value.prompt, `recipeSnapshot.steps[${index}].prompt`),
    decisionOptions: normalizeDecisionOptions(
      value.decisionOptions,
      `recipeSnapshot.steps[${index}].decisionOptions`
    ),
    artifactRefs: normalizeArtifactRefs(
      value.artifactRefs,
      `recipeSnapshot.steps[${index}].artifactRefs`
    ),
    compactContext: normalizeCompactContext(
      value.compactContext,
      `recipeSnapshot.steps[${index}].compactContext`
    )
  };
}

function normalizeDecisionOptions(
  value: unknown,
  fieldName: string
): FakeRecipeDecisionOption[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty array.`);
  }

  return value.map((option, index) => normalizeDecisionOption(option, `${fieldName}[${index}]`));
}

function normalizeDecisionOption(
  value: unknown,
  fieldName: string
): FakeRecipeDecisionOption {
  if (!isRecord(value)) {
    throw new TypeError(`${fieldName} must be a JSON object.`);
  }

  const effect = trimRequiredString(value.effect, `${fieldName}.effect`);

  if (!isFakeRecipeDecisionEffect(effect)) {
    throw new TypeError(`${fieldName}.effect must be approve or reject.`);
  }

  return {
    id: trimRequiredString(value.id, `${fieldName}.id`),
    label: trimRequiredString(value.label, `${fieldName}.label`),
    effect
  };
}

function normalizeArtifactRefs(value: unknown, fieldName: string): FakeRecipeArtifactRef[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${fieldName} must be an array.`);
  }

  return value.map((artifactRef, index) => {
    if (!isRecord(artifactRef)) {
      throw new TypeError(`${fieldName}[${index}] must be a JSON object.`);
    }

    return {
      artifactId: trimRequiredString(artifactRef.artifactId, `${fieldName}[${index}].artifactId`),
      kind: trimRequiredString(artifactRef.kind, `${fieldName}[${index}].kind`),
      path: trimRequiredString(artifactRef.path, `${fieldName}[${index}].path`),
      createdAt: trimRequiredString(artifactRef.createdAt, `${fieldName}[${index}].createdAt`)
    };
  });
}

function normalizeCompactContext(value: unknown, fieldName: string): FakeRecipeCompactContext {
  if (!isRecord(value)) {
    throw new TypeError(`${fieldName} must be a JSON object.`);
  }

  const fields = normalizeOptionalStringRecord(value.fields, `${fieldName}.fields`);
  const context: FakeRecipeCompactContext = {
    title: trimRequiredString(value.title, `${fieldName}.title`),
    summary: trimRequiredString(value.summary, `${fieldName}.summary`)
  };

  return fields === undefined ? context : { ...context, fields };
}

function normalizeOptionalStringRecord(
  value: unknown,
  fieldName: string
): Record<string, string> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new TypeError(`${fieldName} must be a JSON object when present.`);
  }

  const normalized: Record<string, string> = {};

  for (const [key, rawValue] of Object.entries(value)) {
    normalized[key] = trimRequiredString(rawValue, `${fieldName}.${key}`);
  }

  return normalized;
}

function normalizePositiveInteger(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new TypeError(`${fieldName} must be a positive integer.`);
  }

  return value;
}

function trimOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return trimRequiredString(value, fieldName);
}

function isFakeRecipeDecisionEffect(
  value: string
): value is FakeRecipeDecisionOption['effect'] {
  return fakeRecipeDecisionEffects.includes(value as FakeRecipeDecisionOption['effect']);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
