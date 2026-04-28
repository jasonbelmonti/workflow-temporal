import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertLiveHelloClaudexSmokeOptIn,
  buildLiveHelloClaudexSmokeConfig
} from '../client/live-claudex-smoke-config.js';

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
  assert.deepEqual(config.input, {
    objective: 'Prove one live path.',
    provider: 'codex',
    workingDirectory: '/tmp/workflow-temporal-live'
  });
});

test('npm test does not include the live Claudex smoke command', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as {
    scripts: Record<string, string>;
  };

  assert.equal(packageJson.scripts['test:live:claudex'], 'tsx src/client/run-live-claudex-smoke.ts');
  assert.equal(packageJson.scripts.test, 'npm run test:offline');
  assert.doesNotMatch(packageJson.scripts['test:runner'], /test:live:claudex|LIVE_CLAUDEX_SMOKE/);
});
