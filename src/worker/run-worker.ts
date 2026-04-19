import { NativeConnection } from '@temporalio/worker';

import { temporalAddress } from '../lib/config.js';
import { helloWorldTaskQueue } from '../workflows/index.js';
import { createHelloWorldWorker } from './create-hello-world-worker.js';

export async function runWorker(): Promise<void> {
  const connection = await NativeConnection.connect({ address: temporalAddress });
  const worker = await createHelloWorldWorker({ connection, taskQueue: helloWorldTaskQueue });

  console.log(`Temporal worker connected to ${temporalAddress}`);
  console.log(`Listening on task queue "${helloWorldTaskQueue}"`);

  await worker.run();
}

runWorker().catch((error: unknown) => {
  console.error('Temporal worker failed to start');
  console.error(error);
  process.exit(1);
});
