import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NativeConnection, Worker } from '@temporalio/worker';

import * as defaultActivities from '../activities/index.js';
import { helloWorldTaskQueue } from '../workflows/index.js';

export interface CreateHelloWorldWorkerOptions {
  connection: NativeConnection;
  taskQueue?: string;
  activities?: typeof defaultActivities;
}

function resolveWorkflowsPath(): string {
  const currentFilePath = fileURLToPath(import.meta.url);
  const currentExtension = extname(currentFilePath);

  return fileURLToPath(new URL(`../workflows/index${currentExtension}`, import.meta.url));
}

export async function createHelloWorldWorker({
  connection,
  taskQueue = helloWorldTaskQueue,
  activities = defaultActivities
}: CreateHelloWorldWorkerOptions): Promise<Worker> {
  return Worker.create({
    connection,
    taskQueue,
    workflowsPath: resolveWorkflowsPath(),
    activities
  });
}
