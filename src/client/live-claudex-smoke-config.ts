import { randomUUID } from 'node:crypto';

import { temporalAddress } from '../lib/config.js';
import type { HelloClaudexInput } from '../workflows/hello-claudex-contract.js';
import { resolveHelloClaudexInput } from '../workflows/hello-claudex-state.js';

const liveSmokeFlagName = 'LIVE_CLAUDEX_SMOKE';
const liveSmokeRequiredValue = '1';
const defaultLiveObjective =
  'Return one concise sentence confirming a live Codex turn executed through Temporal.';

export const liveHelloClaudexSmokeTaskQueuePrefix = 'hello-claudex-live-codex';

export interface LiveHelloClaudexSmokeConfig {
  address: string;
  input: HelloClaudexInput;
  taskQueue: string;
  workflowId: string;
}

export interface BuildLiveHelloClaudexSmokeConfigOptions {
  env?: NodeJS.ProcessEnv;
  defaultWorkingDirectory?: string;
  randomId?: () => string;
}

export function assertLiveHelloClaudexSmokeOptIn(
  env: NodeJS.ProcessEnv = process.env
): void {
  if (env[liveSmokeFlagName] !== liveSmokeRequiredValue) {
    throw new TypeError(
      `Set ${liveSmokeFlagName}=${liveSmokeRequiredValue} to run the live Claudex smoke path.`
    );
  }
}

export function buildLiveHelloClaudexSmokeConfig({
  env = process.env,
  defaultWorkingDirectory = process.cwd(),
  randomId = randomUUID
}: BuildLiveHelloClaudexSmokeConfigOptions = {}): LiveHelloClaudexSmokeConfig {
  assertLiveHelloClaudexSmokeOptIn(env);

  const id = randomId().toLowerCase();
  const runKey = `${liveHelloClaudexSmokeTaskQueuePrefix}-${id}`;
  const workingDirectory = env.LIVE_CLAUDEX_WORKING_DIRECTORY ?? defaultWorkingDirectory;
  const objective = env.LIVE_CLAUDEX_OBJECTIVE ?? defaultLiveObjective;

  return {
    address: env.TEMPORAL_ADDRESS ?? temporalAddress,
    input: resolveHelloClaudexInput(
      {
        objective,
        provider: 'codex',
        workingDirectory
      },
      { defaultWorkingDirectory }
    ),
    taskQueue: runKey,
    workflowId: runKey
  };
}
