import type {
  FakeRecipeActivityRequest,
  FakeRecipeActivityResult
} from '../workflows/fake-recipe-contract.js';

export async function runFakeRecipeStep(
  request: FakeRecipeActivityRequest
): Promise<FakeRecipeActivityResult> {
  return {
    stepId: request.stepId,
    text: request.input.text,
    artifactRefs: request.artifactRefs
  };
}
