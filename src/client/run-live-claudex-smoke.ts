import { pathToFileURL } from 'node:url';

import { temporalAddress } from '../lib/config.js';
import {
  buildLiveHelloClaudexSmokeConfig,
  claudexTurnModelEnvName,
  claudexTurnTimeoutEnvName,
  defaultLiveClaudexTurnTimeoutMs,
  liveHelloClaudexSmokeTaskQueuePrefix
} from './live-claudex-smoke-config.js';
import { runLiveHelloClaudexSmoke } from './live-claudex-smoke.js';

export async function runLiveHelloClaudexSmokeCli(): Promise<void> {
  const config = buildLiveHelloClaudexSmokeConfig();

  console.log('Starting live Claudex smoke workflow');
  console.log(JSON.stringify({
    temporalAddress: config.address,
    workflowId: config.workflowId,
    taskQueue: config.taskQueue,
    turnTimeoutMs: config.turnTimeoutMs,
    turnModel: config.turnModel,
    input: config.input
  }, null, 2));

  const report = await runLiveHelloClaudexSmoke(config);

  console.log('Live Claudex smoke workflow returned');
  console.log(JSON.stringify(report, null, 2));

  if (report.result.status !== 'completed') {
    throw new Error(`Live Claudex smoke workflow returned status "${report.result.status}".`);
  }
}

if (isMainModule()) {
  runLiveHelloClaudexSmokeCli().catch((error: unknown) => {
    console.error('Live Claudex smoke failed');
    console.error(JSON.stringify({
      errorMessage: getErrorMessage(error),
      temporalAddress,
      taskQueuePrefix: liveHelloClaudexSmokeTaskQueuePrefix,
      requestedProvider: 'codex',
      turnTimeoutMs: process.env[claudexTurnTimeoutEnvName] ?? defaultLiveClaudexTurnTimeoutMs,
      turnModel: process.env[claudexTurnModelEnvName],
      workingDirectory: process.env.LIVE_CLAUDEX_WORKING_DIRECTORY ?? process.cwd()
    }, null, 2));
    process.exit(1);
  });
}

function isMainModule(): boolean {
  return process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
