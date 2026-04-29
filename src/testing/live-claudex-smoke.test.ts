import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertLiveHelloClaudexSmokeOptIn,
  buildLiveHelloClaudexSmokeConfig,
  claudexTurnModelEnvName,
  claudexTurnTimeoutEnvName,
  type LiveHelloClaudexSmokeConfig,
  defaultLiveClaudexTurnTimeoutMs
} from '../client/live-claudex-smoke-config.js';
import { createLiveHelloClaudexSmokeActivities } from '../client/live-claudex-smoke-activities.js';
import type { RunClaudexTurnActivityContext } from '../activities/run-claudex-turn.js';
import type { ClaudexTurnRequest, ClaudexTurnResponse } from '../claudex-turn/index.js';

test('live Claudex smoke requires explicit operator opt-in', () => {
  assert.throws(
    () => assertLiveHelloClaudexSmokeOptIn({}),
    /Set LIVE_CLAUDEX_SMOKE=1 to run the live Claudex smoke path/
  );

  assert.doesNotThrow(() => assertLiveHelloClaudexSmokeOptIn({ LIVE_CLAUDEX_SMOKE: '1' }));
});

test('live Claudex smoke config pins Codex and an explicit working directory', () => {
  const config = buildLiveHelloClaudexSmokeConfig({
    env: {
      LIVE_CLAUDEX_SMOKE: '1',
      LIVE_CLAUDEX_OBJECTIVE: '  Prove one live path.  ',
      LIVE_CLAUDEX_WORKING_DIRECTORY: '  /tmp/workflow-temporal-live  ',
      TEMPORAL_ADDRESS: 'temporal.example:7233'
    },
    defaultWorkingDirectory: '/fallback',
    randomId: () => 'ABCDEF'
  });

  assert.equal(config.address, 'temporal.example:7233');
  assert.equal(config.workflowId, 'hello-claudex-live-codex-abcdef');
  assert.equal(config.taskQueue, 'hello-claudex-live-codex-abcdef');
  assert.equal(config.turnTimeoutMs, defaultLiveClaudexTurnTimeoutMs);
  assert.deepEqual(config.input, {
    objective: 'Prove one live path.',
    provider: 'codex',
    workingDirectory: '/tmp/workflow-temporal-live'
  });
});

test('live Claudex smoke timeout can be overridden for slower Codex runs', () => {
  const config = buildLiveHelloClaudexSmokeConfig({
    env: {
      LIVE_CLAUDEX_SMOKE: '1',
      [claudexTurnTimeoutEnvName]: '120000',
      [claudexTurnModelEnvName]: 'gpt-5.1'
    },
    defaultWorkingDirectory: '/repo',
    randomId: () => 'ABCDEF'
  });

  assert.equal(config.turnTimeoutMs, 120_000);
  assert.equal(config.turnModel, 'gpt-5.1');
});

test('live Claudex smoke rejects invalid timeout overrides before starting Temporal', () => {
  assert.throws(
    () =>
      buildLiveHelloClaudexSmokeConfig({
        env: {
          LIVE_CLAUDEX_SMOKE: '1',
          [claudexTurnTimeoutEnvName]: '0'
        },
        defaultWorkingDirectory: '/repo'
      }),
    /CLAUDEX_TURN_TIMEOUT_MS must be a positive integer/
  );
});

test('live Claudex smoke rejects blank model overrides before starting Temporal', () => {
  assert.throws(
    () =>
      buildLiveHelloClaudexSmokeConfig({
        env: {
          LIVE_CLAUDEX_SMOKE: '1',
          [claudexTurnModelEnvName]: '   '
        },
        defaultWorkingDirectory: '/repo'
      }),
    /CLAUDEX_TURN_MODEL must be a non-empty string/
  );
});

test('live Claudex smoke scopes turn runtime config without mutating process env', async () => {
  const previousTimeoutMs = process.env[claudexTurnTimeoutEnvName];
  const previousModel = process.env[claudexTurnModelEnvName];
  const observed: Array<{ timeoutMs: number | undefined; model: string | undefined }> = [];

  try {
    process.env[claudexTurnTimeoutEnvName] = '111';
    process.env[claudexTurnModelEnvName] = 'ambient-model';

    const firstActivities = createLiveHelloClaudexSmokeActivities(
      buildLiveSmokeConfig({ turnTimeoutMs: 120_000, turnModel: 'gpt-5.1' }),
      {
        context: createFakeActivityContext,
        runner: async (_request, options) => {
          observed[0] = {
            timeoutMs: options.timeoutMs,
            model: options.sessionOptions?.model
          };
          return completedResponse;
        }
      }
    );
    const secondActivities = createLiveHelloClaudexSmokeActivities(
      buildLiveSmokeConfig({ turnTimeoutMs: 60_000, turnModel: 'gpt-5.3-codex' }),
      {
        context: createFakeActivityContext,
        runner: async (_request, options) => {
          observed[1] = {
            timeoutMs: options.timeoutMs,
            model: options.sessionOptions?.model
          };
          return completedResponse;
        }
      }
    );

    await Promise.all([
      firstActivities.runClaudexTurn(turnRequest),
      secondActivities.runClaudexTurn(turnRequest)
    ]);

    assert.deepEqual(observed, [
      { timeoutMs: 120_000, model: 'gpt-5.1' },
      { timeoutMs: 60_000, model: 'gpt-5.3-codex' }
    ]);
    assert.equal(process.env[claudexTurnTimeoutEnvName], '111');
    assert.equal(process.env[claudexTurnModelEnvName], 'ambient-model');
  } finally {
    restoreEnvValue(claudexTurnTimeoutEnvName, previousTimeoutMs);
    restoreEnvValue(claudexTurnModelEnvName, previousModel);
  }
});

test('npm test does not include the live Claudex smoke command', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as {
    scripts: Record<string, string>;
  };

  assert.equal(packageJson.scripts['test:live:claudex'], 'tsx src/client/run-live-claudex-smoke.ts');
  assert.equal(packageJson.scripts.test, 'npm run test:offline');
  assert.doesNotMatch(packageJson.scripts['test:runner'], /test:live:claudex|LIVE_CLAUDEX_SMOKE/);
});

function buildLiveSmokeConfig({
  turnTimeoutMs,
  turnModel
}: {
  turnTimeoutMs: number;
  turnModel: string;
}): LiveHelloClaudexSmokeConfig {
  return {
    address: 'temporal.example:7233',
    input: {
      objective: 'Prove one live path.',
      provider: 'codex',
      workingDirectory: '/repo'
    },
    taskQueue: `hello-claudex-live-codex-${turnTimeoutMs}`,
    workflowId: `hello-claudex-live-codex-${turnTimeoutMs}`,
    turnTimeoutMs,
    turnModel
  };
}

function createFakeActivityContext(): RunClaudexTurnActivityContext {
  return {
    info: {},
    cancellationSignal: new AbortController().signal,
    heartbeat: () => undefined
  };
}

function restoreEnvValue(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

const turnRequest: ClaudexTurnRequest = {
  objective: 'Expose a Temporal activity boundary for Claudex.',
  provider: 'codex',
  workingDirectory: '/repo',
  turnNumber: 1
};

const completedResponse: ClaudexTurnResponse = {
  requestedProvider: 'codex',
  provider: 'codex',
  outcome: 'completed',
  text: 'Completed one fake Claudex turn.',
  artifactRefs: [],
  sessionRef: {
    provider: 'codex',
    sessionId: 'fake-codex-session'
  }
};
