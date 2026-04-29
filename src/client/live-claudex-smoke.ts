import { Client, Connection } from '@temporalio/client';
import { NativeConnection } from '@temporalio/worker';

import { createHelloWorldWorker } from '../worker/create-hello-world-worker.js';
import {
  helloClaudexWorkflowType,
  type HelloClaudexResult
} from '../workflows/hello-claudex-contract.js';
import {
  startHelloClaudexWorkflow,
  type StartHelloClaudexResult
} from './start-hello-claudex.js';
import { type LiveHelloClaudexSmokeConfig } from './live-claudex-smoke-config.js';
import { createLiveHelloClaudexSmokeActivities } from './live-claudex-smoke-activities.js';

export interface LiveHelloClaudexSmokeReport {
  workflowType: string;
  workflowId: string;
  runId: string;
  taskQueue: string;
  temporalAddress: string;
  input: LiveHelloClaudexSmokeConfig['input'];
  turnTimeoutMs: number;
  turnModel?: string;
  result: HelloClaudexResult;
}

export async function runLiveHelloClaudexSmoke(
  config: LiveHelloClaudexSmokeConfig
): Promise<LiveHelloClaudexSmokeReport> {
  let workerConnection: NativeConnection | undefined;
  let clientConnection: Connection | undefined;

  try {
    workerConnection = await NativeConnection.connect({ address: config.address });
    clientConnection = await Connection.connect({ address: config.address });

    const client = new Client({ connection: clientConnection });
    const worker = await createHelloWorldWorker({
      connection: workerConnection,
      taskQueue: config.taskQueue,
      activities: createLiveHelloClaudexSmokeActivities(config)
    });
    const { started, result } = await worker.runUntil(
      () => startAndAwaitHelloClaudexWorkflow(client, config),
      { promiseCompletionTimeout: '10 seconds' }
    );

    return {
      workflowType: helloClaudexWorkflowType,
      workflowId: started.workflowId,
      runId: started.runId,
      taskQueue: started.taskQueue,
      temporalAddress: config.address,
      input: config.input,
      turnTimeoutMs: config.turnTimeoutMs,
      ...(config.turnModel === undefined ? {} : { turnModel: config.turnModel }),
      result
    };
  } finally {
    await clientConnection?.close();
    await workerConnection?.close();
  }
}

async function startAndAwaitHelloClaudexWorkflow(
  client: Client,
  config: LiveHelloClaudexSmokeConfig
): Promise<{
  started: StartHelloClaudexResult;
  result: HelloClaudexResult;
}> {
  const started = await startHelloClaudexWorkflow({
    input: config.input,
    address: config.address,
    taskQueue: config.taskQueue,
    workflowId: config.workflowId
  });
  const handle = client.workflow.getHandle(started.workflowId, started.runId);
  const result = await handle.result();

  return { started, result };
}
