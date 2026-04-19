import { Connection, Client } from '@temporalio/client';

import { temporalAddress } from '../lib/config.js';
import {
  buildHelloWorldWorkflowId,
  helloWorldTaskQueue,
  resolveHelloWorldName,
  helloWorldWorkflow
} from '../workflows/index.js';

function readNameArgument(): string | undefined {
  const nameFlagIndex = process.argv.indexOf('--name');

  return nameFlagIndex === -1 ? undefined : process.argv[nameFlagIndex + 1];
}

export async function startHelloWorld(): Promise<void> {
  const name = resolveHelloWorldName(readNameArgument());
  const workflowId = buildHelloWorldWorkflowId(name);
  const connection = await Connection.connect({ address: temporalAddress });
  const client = new Client({ connection });

  console.log(`Starting workflow "${workflowId}" on ${temporalAddress}`);

  const result = await client.workflow.execute(helloWorldWorkflow, {
    args: [{ name }],
    taskQueue: helloWorldTaskQueue,
    workflowId
  });

  console.log('Workflow completed successfully');
  console.log(JSON.stringify({ workflowId, result }, null, 2));
}

startHelloWorld().catch((error: unknown) => {
  console.error('Failed to start hello world workflow');
  console.error(error);
  process.exit(1);
});
