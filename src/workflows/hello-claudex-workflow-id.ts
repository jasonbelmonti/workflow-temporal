import {
  type BuildHelloClaudexWorkflowIdOptions,
  type HelloClaudexInput
} from './hello-claudex-contract.js';
import { resolveHelloClaudexInput } from './hello-claudex-state.js';

export function buildHelloClaudexWorkflowId(
  input: HelloClaudexInput,
  { randomId = () => globalThis.crypto.randomUUID() }: BuildHelloClaudexWorkflowIdOptions = {}
): string {
  const resolvedInput = resolveHelloClaudexInput(input);
  const objectiveSlug = slugWorkflowIdComponent(resolvedInput.objective, 'objective', 48);
  const workdirSlug = slugWorkflowIdComponent(
    lastPathSegment(resolvedInput.workingDirectory),
    'workdir',
    32
  );
  const workdirFingerprint = hashWorkflowIdComponent(resolvedInput.workingDirectory);
  const uniqueSuffix = slugWorkflowIdComponent(randomId(), 'run', 80);

  return [
    'hello-claudex',
    resolvedInput.provider,
    objectiveSlug,
    workdirSlug,
    workdirFingerprint,
    uniqueSuffix
  ].join('-');
}

function slugWorkflowIdComponent(value: string, fallback: string, maxLength: number): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLength)
    .replace(/-$/g, '');

  return slug || fallback;
}

function lastPathSegment(path: string): string {
  const trimmed = path.replace(/[\\/]+$/g, '');
  const segments = trimmed.split(/[\\/]+/g);

  return segments.at(-1) ?? trimmed;
}

function hashWorkflowIdComponent(value: string): string {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0).toString(36).padStart(7, '0');
}
