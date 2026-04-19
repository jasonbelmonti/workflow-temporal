import { proxyActivities } from '@temporalio/workflow';

import type * as greetingActivities from '../activities/index.js';
import {
  resolveHelloWorldName,
  type HelloWorldInput,
  type HelloWorldResult
} from './hello-world-contract.js';

const { composeGreeting } = proxyActivities<typeof greetingActivities>({
  startToCloseTimeout: '10 seconds'
});

export async function helloWorldWorkflow(
  input: HelloWorldInput = {}
): Promise<HelloWorldResult> {
  const name = resolveHelloWorldName(input.name);
  const greeting = await composeGreeting(name);

  return { greeting };
}
