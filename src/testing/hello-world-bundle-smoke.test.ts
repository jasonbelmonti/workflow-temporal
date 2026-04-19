import assert from 'node:assert/strict';
import test from 'node:test';

import { Client, Connection } from '@temporalio/client';
import { NativeConnection } from '@temporalio/worker';

import { temporalAddress } from '../lib/config.js';
import { createHelloWorldWorker } from '../worker/create-hello-world-worker.js';
import {
  buildHelloWorldWorkflowId,
  helloWorldWorkflow
} from '../workflows/index.js';

test('bundled hello-world workflow completes successfully', { timeout: 30_000 }, async () => {
  const taskQueue = `hello-world-smoke-${globalThis.crypto.randomUUID()}`;
  const workerConnection = await NativeConnection.connect({ address: temporalAddress });
  const clientConnection = await Connection.connect({ address: temporalAddress });
  const worker = await createHelloWorldWorker({ connection: workerConnection, taskQueue });
  const client = new Client({ connection: clientConnection });

  try {
    const result = await worker.runUntil(
      () =>
        client.workflow.execute(helloWorldWorkflow, {
          args: [{ name: 'Smoke' }],
          taskQueue,
          workflowId: buildHelloWorldWorkflowId('Smoke')
        }),
      { promiseCompletionTimeout: '5 seconds' }
    );

    assert.deepEqual(result, { greeting: 'Hello, Smoke!' });
  } finally {
    await clientConnection.close();
    await workerConnection.close();
  }
});
