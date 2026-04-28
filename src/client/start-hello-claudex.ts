import { pathToFileURL } from 'node:url';

import { Client, Connection } from '@temporalio/client';

import { temporalAddress } from '../lib/config.js';
import {
  cancelRunSignalName,
  getHelloClaudexStateQueryName,
  helloClaudexTaskQueue,
  helloClaudexWorkflowType,
  submitHumanInputSignalName,
  type HelloClaudexInput,
  type HelloClaudexWorkflow
} from '../workflows/hello-claudex-contract.js';
import { resolveHelloClaudexInput } from '../workflows/hello-claudex-state.js';
import { buildHelloClaudexWorkflowId } from '../workflows/hello-claudex-workflow-id.js';

export interface StartHelloClaudexOptions {
  input: HelloClaudexInput;
  address?: string;
  taskQueue?: string;
  workflowId?: string;
}

export interface StartHelloClaudexResult {
  workflowType: string;
  workflowId: string;
  runId: string;
  taskQueue: string;
  query: string;
  signals: {
    submitHumanInput: string;
    cancelRun: string;
  };
}

export async function startHelloClaudexWorkflow({
  input,
  address = temporalAddress,
  taskQueue = helloClaudexTaskQueue,
  workflowId
}: StartHelloClaudexOptions): Promise<StartHelloClaudexResult> {
  const resolvedInput = resolveHelloClaudexInput(input);
  const resolvedWorkflowId = workflowId ?? buildHelloClaudexWorkflowId(resolvedInput);
  const connection = await Connection.connect({ address });
  const client = new Client({ connection });

  try {
    const handle = await client.workflow.start<HelloClaudexWorkflow>(helloClaudexWorkflowType, {
      args: [resolvedInput],
      taskQueue,
      workflowId: resolvedWorkflowId
    });

    return {
      workflowType: helloClaudexWorkflowType,
      workflowId: resolvedWorkflowId,
      runId: handle.firstExecutionRunId,
      taskQueue,
      query: getHelloClaudexStateQueryName,
      signals: {
        submitHumanInput: submitHumanInputSignalName,
        cancelRun: cancelRunSignalName
      }
    };
  } finally {
    await connection.close();
  }
}

export function readHelloClaudexInputFromArgs(
  argv = process.argv.slice(2),
  defaultWorkingDirectory = process.cwd()
): HelloClaudexInput {
  const objective = readRequiredFlag(argv, '--objective');
  const provider = readOptionalFlag(argv, '--provider');
  const workingDirectory = readOptionalFlag(argv, '--working-directory');

  return resolveHelloClaudexInput(
    {
      objective,
      provider,
      workingDirectory
    },
    { defaultWorkingDirectory }
  );
}

export async function startHelloClaudex(): Promise<void> {
  const input = readHelloClaudexInputFromArgs();

  console.log(`Starting workflow "${helloClaudexWorkflowType}" on ${temporalAddress}`);

  const result = await startHelloClaudexWorkflow({ input });

  console.log('Workflow started successfully');
  console.log(JSON.stringify({ input, ...result }, null, 2));
}

function readRequiredFlag(argv: string[], flag: string): string {
  const value = readOptionalFlag(argv, flag);

  if (value === undefined) {
    throw new TypeError(`Missing required ${flag} argument.`);
  }

  return value;
}

function readOptionalFlag(argv: string[], flag: string): string | undefined {
  const equalsPrefix = `${flag}=`;
  const equalsMatch = argv.find((argument) => argument.startsWith(equalsPrefix));

  if (equalsMatch !== undefined) {
    return equalsMatch.slice(equalsPrefix.length);
  }

  const flagIndex = argv.indexOf(flag);

  if (flagIndex === -1) {
    return undefined;
  }

  const value = argv[flagIndex + 1];

  if (value === undefined || value.startsWith('--')) {
    throw new TypeError(`Missing value for ${flag} argument.`);
  }

  return value;
}

if (isMainModule()) {
  startHelloClaudex().catch((error: unknown) => {
    console.error('Failed to start hello Claudex workflow');
    console.error(error);
    process.exit(1);
  });
}

function isMainModule(): boolean {
  return process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
}
