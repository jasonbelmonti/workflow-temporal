import type {
  BuildFakeRecipeWorkflowIdOptions,
  FakeRecipeInput
} from './fake-recipe-contract.js';

export function buildFakeRecipeWorkflowId(
  input: FakeRecipeInput,
  {
    randomId = () => globalThis.crypto.randomUUID()
  }: BuildFakeRecipeWorkflowIdOptions = {}
): string {
  const label = input.runLabel ?? input.recipeSnapshot.recipeId;
  const slug = slugify(`${input.recipeSnapshot.snapshotId}-${label}`);

  return `fake-recipe-gate-${slug}-${randomId().toLowerCase()}`;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
