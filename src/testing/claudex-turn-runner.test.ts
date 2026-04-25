import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  AgentError,
  type AgentSession,
  type ProviderCapabilities,
  type ProviderReadiness,
  type SessionOptions,
  type SessionReference,
  type TurnInput,
  type TurnOptions,
  type TurnResult
} from '@jasonbelmonti/claudex';

import {
  runClaudexTurn,
  type ClaudexRuntimeAdapter,
  type ClaudexTurnRequest
} from '../claudex-turn/index.js';
import {
  RunnerAbortError,
  runWithControls
} from '../claudex-turn/runner-controls.js';

const capabilities: ProviderCapabilities = {
  provider: 'claude',
  features: {}
};

const readyReadiness: ProviderReadiness = {
  provider: 'claude',
  status: 'ready',
  checks: [],
  capabilities
};

test('runWithControls rejects before launching task when the caller signal is already aborted', async () => {
  const controller = new AbortController();
  controller.abort();
  let taskStarted = false;

  await assert.rejects(
    runWithControls(
      async () => {
        taskStarted = true;
        return 'unexpected';
      },
      { signal: controller.signal, timeoutMs: 100 }
    ),
    RunnerAbortError
  );

  assert.equal(taskStarted, false);
});

test('runWithControls keeps the timeout active for an otherwise idle hung task', () => {
  const child = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      [
        "import { runWithControls } from './dist/claudex-turn/runner-controls.js';",
        'try {',
        '  await runWithControls(() => new Promise(() => undefined), { timeoutMs: 25 });',
        "  console.log('resolved');",
        '} catch (error) {',
        '  console.log(error.constructor.name);',
        '}'
      ].join('\n')
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 1_000
    }
  );

  assert.equal(child.status, 0);
  assert.match(child.stdout, /RunnerTimeoutError/);
});

test('runClaudexTurn falls back to a fresh session when resumed session fails lazily', async () => {
  const adapter = new LazyStaleResumeAdapter();

  const response = await runClaudexTurn(createTurnRequest(), {
    createAdapter: () => adapter,
    timeoutMs: 1_000
  });

  assert.equal(response.outcome, 'completed');
  assert.equal(response.provider, 'claude');
  assert.equal(response.sessionRef?.sessionId, 'fresh-session');
  assert.equal(response.text, 'fresh result');
  assert.equal(adapter.resumeCalls, 1);
  assert.equal(adapter.createCalls, 1);
  assert.equal(adapter.resumedRunCalls, 1);
});

function createTurnRequest(): ClaudexTurnRequest {
  return {
    objective: 'Complete one bounded turn.',
    provider: 'claude',
    workingDirectory: process.cwd(),
    turnNumber: 2,
    priorSessionRef: {
      provider: 'claude',
      sessionId: 'stale-session'
    },
    priorSummary: 'Previous normalized state.',
    humanInput: 'Continue.'
  };
}

class LazyStaleResumeAdapter implements ClaudexRuntimeAdapter {
  createCalls = 0;
  resumeCalls = 0;
  resumedRunCalls = 0;

  async checkReadiness(): Promise<ProviderReadiness> {
    return readyReadiness;
  }

  async createSession(_options?: SessionOptions): Promise<AgentSession> {
    this.createCalls += 1;

    return new FakeSession(
      {
        provider: 'claude',
        sessionId: 'fresh-session'
      },
      async () => ({
        provider: 'claude',
        session: {
          provider: 'claude',
          sessionId: 'fresh-session'
        },
        text: 'fresh result',
        usage: null
      })
    );
  }

  async resumeSession(
    reference: SessionReference,
    _options?: SessionOptions
  ): Promise<AgentSession> {
    this.resumeCalls += 1;

    return new FakeSession(reference, async () => {
      this.resumedRunCalls += 1;
      throw new AgentError({
        code: 'provider_failure',
        provider: 'claude',
        message: 'Session not found for resume id stale-session.'
      });
    });
  }
}

class FakeSession implements AgentSession {
  readonly provider = 'claude';
  readonly capabilities = capabilities;

  constructor(
    readonly reference: SessionReference | null,
    private readonly runTurn: (input: TurnInput, options?: TurnOptions) => Promise<TurnResult>
  ) {}

  async run(input: TurnInput, options?: TurnOptions): Promise<TurnResult> {
    return await this.runTurn(input, options);
  }

  async *runStreamed(): AsyncGenerator<never> {
    throw new Error('FakeSession.runStreamed is not implemented for these tests.');
  }
}
