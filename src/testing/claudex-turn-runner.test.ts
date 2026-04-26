import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  AgentError,
  type AgentEvent,
  type AgentSession,
  type ProviderCapabilities,
  type ProviderId,
  type ProviderReadiness,
  type SessionOptions,
  type SessionReference,
  type TurnInput,
  type TurnOptions,
  type TurnResult
} from '@jasonbelmonti/claudex';

import {
  createDefaultClaudexAdapter,
  parseClaudexTurnResponse,
  runClaudexTurn,
  serializeClaudexTurnRequest,
  type ClaudexRuntimeAdapter,
  type ClaudexTurnRequest
} from '../claudex-turn/index.js';

test('runWithControls keeps the timeout active for non-cooperative hung tasks', () => {
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

const turnRequest: ClaudexTurnRequest = {
  objective: 'Prove the direct Claudex turn runner',
  provider: 'auto',
  workingDirectory: process.cwd(),
  turnNumber: 1,
  priorSummary: 'Runner has not run yet.'
};

test('serializes the bounded turn request contract', () => {
  const payload = serializeClaudexTurnRequest(turnRequest);

  assert.equal(
    payload,
    JSON.stringify({
      objective: 'Prove the direct Claudex turn runner',
      provider: 'auto',
      workingDirectory: process.cwd(),
      turnNumber: 1,
      priorSummary: 'Runner has not run yet.'
    })
  );
});

test('parses a completed turn response payload', () => {
  const response = parseClaudexTurnResponse(
    JSON.stringify({
      requestedProvider: 'auto',
      provider: 'claude',
      outcome: 'completed',
      text: 'Completed fake turn 1.',
      artifactRefs: [],
      sessionRef: {
        provider: 'claude',
        sessionId: 'fake-claude-turn-1'
      }
    })
  );

  assert.equal(response.outcome, 'completed');
  assert.equal(response.provider, 'claude');
});

test('rejects a successful turn response payload without a resolved provider', () => {
  assert.throws(
    () =>
      parseClaudexTurnResponse(
        JSON.stringify({
          requestedProvider: 'auto',
          outcome: 'completed',
          text: 'Completed fake turn 1.',
          artifactRefs: []
        })
      ),
    /provider must be one of/
  );
});

test('parses a needs_input turn response payload', () => {
  const response = parseClaudexTurnResponse(
    JSON.stringify({
      requestedProvider: 'auto',
      provider: 'claude',
      outcome: 'needs_input',
      text: 'Need operator input.',
      artifactRefs: [],
      waitingReason: 'Waiting for operator instructions.'
    })
  );

  assert.equal(response.outcome, 'needs_input');
  assert.equal(response.provider, 'claude');
  assert.equal(response.waitingReason, 'Waiting for operator instructions.');
});

test('parses a failed turn response payload without a resolved provider', () => {
  const response = parseClaudexTurnResponse(
    JSON.stringify({
      requestedProvider: 'auto',
      outcome: 'failed',
      text: '',
      artifactRefs: [],
      errorMessage: 'Runner failed before provider selection.',
      failure: {
        kind: 'runtime_error',
        message: 'adapter construction failed'
      }
    })
  );

  assert.equal(response.outcome, 'failed');
  assert.equal(response.provider, undefined);
});

test('direct runner rejects invalid requests before adapter execution', async () => {
  let adapterCreated = false;

  await assert.rejects(
    async () =>
      runClaudexTurn(
        {
          ...turnRequest,
          provider: 'not-a-provider',
          workingDirectory: '',
          turnNumber: 0
        } as unknown as ClaudexTurnRequest,
        {
          createAdapter: () => {
            adapterCreated = true;
            return createFakeAdapter({});
          }
        }
      ),
    /provider must be one of/
  );

  assert.equal(adapterCreated, false);
});

test('direct runner returns a deterministic completed response', async () => {
  const response = await runClaudexTurn(turnRequest, {
    createAdapter: () =>
      createFakeAdapter({
        result: createTurnResult({
          text: 'Completed fake turn 1.'
        })
      })
  });

  assert.equal(response.outcome, 'completed');
  assert.equal(response.provider, 'claude');
  assert.match(response.text, /Completed fake turn 1/);
  assert.equal(response.sessionRef?.sessionId, 'fake-claude-session');
});

test('direct runner returns a deterministic needs_input response', async () => {
  const response = await runClaudexTurn(turnRequest, {
    createAdapter: () =>
      createFakeAdapter({
        result: createTurnResult({
          text: 'Need more input.',
          stopReason: 'needs_input',
          extensions: {
            needsInput: true,
            waitingReason: 'Waiting on human input before continuing.'
          }
        })
      })
  });

  assert.equal(response.outcome, 'needs_input');
  assert.equal(response.provider, 'claude');
  assert.match(response.waitingReason, /Waiting on human input/);
});

test('direct runner returns a deterministic failed response from provider errors', async () => {
  const response = await runClaudexTurn(turnRequest, {
    createAdapter: () =>
      createFakeAdapter({
        error: new AgentError({
          provider: 'claude',
          code: 'provider_failure',
          message: 'Fake Claudex provider failed deterministically.'
        })
      })
  });

  assert.equal(response.outcome, 'failed');
  assert.equal(response.provider, 'claude');
  assert.equal(response.sessionRef?.sessionId, 'fake-claude-session');
  assert.equal(response.failure.kind, 'turn_failed');
  assert.equal(response.failure.code, 'provider_failure');
  assert.match(response.errorMessage, /failed deterministically/);
});

test('direct runner preserves selected provider for runtime errors after readiness', async () => {
  const response = await runClaudexTurn(turnRequest, {
    createAdapter: () =>
      createFakeAdapter({
        error: new Error('Fake runtime failure after provider selection.')
      })
  });

  assert.equal(response.outcome, 'failed');
  assert.equal(response.provider, 'claude');
  assert.equal(response.sessionRef?.sessionId, 'fake-claude-session');
  assert.equal(response.failure.kind, 'runtime_error');
  assert.match(response.errorMessage, /runtime failure/);
});

test('direct runner rejects invalid provider results', async () => {
  const response = await runClaudexTurn(turnRequest, {
    createAdapter: () =>
      createFakeAdapter({
        result: createTurnResult({
          provider: 'invalid-provider'
        } as unknown as Partial<TurnResult>)
      })
  });

  assert.equal(response.outcome, 'failed');
  assert.equal(response.provider, 'claude');
  assert.equal(response.sessionRef?.sessionId, 'fake-claude-session');
  assert.equal(response.failure.kind, 'runtime_error');
  assert.match(response.errorMessage, /result\.provider must be one of/);
});

test('direct runner rejects invalid result text', async () => {
  const response = await runClaudexTurn(turnRequest, {
    createAdapter: () =>
      createFakeAdapter({
        result: createTurnResult({
          text: 42
        } as unknown as Partial<TurnResult>)
      })
  });

  assert.equal(response.outcome, 'failed');
  assert.equal(response.provider, 'claude');
  assert.equal(response.sessionRef?.sessionId, 'fake-claude-session');
  assert.equal(response.failure.kind, 'runtime_error');
  assert.match(response.errorMessage, /result\.text must be a string/);
});

test('direct runner rejects malformed artifact refs', async () => {
  const response = await runClaudexTurn(turnRequest, {
    createAdapter: () =>
      createFakeAdapter({
        result: createTurnResult({
          extensions: {
            artifactRefs: [
              {
                artifactId: 'artifact-1',
                kind: 'file',
                path: '',
                createdAt: '2026-04-25T00:00:00.000Z'
              }
            ]
          }
        })
      })
  });

  assert.equal(response.outcome, 'failed');
  assert.equal(response.provider, 'claude');
  assert.equal(response.sessionRef?.sessionId, 'fake-claude-session');
  assert.equal(response.failure.kind, 'runtime_error');
  assert.match(
    response.errorMessage,
    /result\.extensions\.artifactRefs\[\]\.path must be a non-empty string/
  );
});

test('direct runner rejects mismatched result session providers', async () => {
  const response = await runClaudexTurn(turnRequest, {
    createAdapter: () =>
      createFakeAdapter({
        result: createTurnResult({
          session: {
            provider: 'codex',
            sessionId: 'mismatched-session'
          }
        })
      })
  });

  assert.equal(response.outcome, 'failed');
  assert.equal(response.provider, 'claude');
  assert.equal(response.sessionRef?.sessionId, 'fake-claude-session');
  assert.equal(response.failure.kind, 'runtime_error');
  assert.match(response.errorMessage, /sessionRef\.provider must match expected provider claude/);
});

test('direct runner maps readiness failures into failed responses', async () => {
  const response = await runClaudexTurn(turnRequest, {
    createAdapter: () =>
      createFakeAdapter({
        readiness: createReadiness('claude', 'needs_auth')
      })
  });

  assert.equal(response.outcome, 'failed');
  assert.equal(response.provider, 'claude');
  assert.equal(response.failure.kind, 'readiness_failed');
  assert.equal(response.failure.code, 'needs_auth');
});

test('direct runner executes degraded but runnable providers', async () => {
  const calls: string[] = [];
  const response = await runClaudexTurn(turnRequest, {
    createAdapter: () =>
      createFakeAdapter({
        calls,
        readiness: createReadiness('claude', 'degraded'),
        result: createTurnResult({
          text: 'Completed degraded provider turn.'
        })
      })
  });

  assert.equal(response.outcome, 'completed');
  assert.equal(response.provider, 'claude');
  assert.match(response.text, /degraded provider/);
  assert.deepEqual(calls, ['checkReadiness', `createSession:${process.cwd()}`, 'run']);
});

test('direct runner resumes a prior provider session when supplied', async () => {
  const calls: string[] = [];
  const priorSessionRef = {
    provider: 'claude',
    sessionId: 'existing-session'
  } as const;

  const response = await runClaudexTurn(
    {
      ...turnRequest,
      provider: 'claude',
      priorSessionRef
    },
    {
      createAdapter: () =>
        createFakeAdapter({
          calls,
          result: createTurnResult({
            session: priorSessionRef,
            text: 'Resumed session.'
          })
        })
    }
  );

  assert.equal(response.outcome, 'completed');
  assert.deepEqual(calls, ['checkReadiness', 'resumeSession:existing-session', 'run']);
  assert.equal(response.sessionRef?.sessionId, 'existing-session');
});

test('direct runner starts a fresh session when resume fails with stale state', async () => {
  const calls: string[] = [];
  const priorSessionRef = {
    provider: 'claude',
    sessionId: 'stale-session'
  } as const;
  const freshSessionRef = {
    provider: 'claude',
    sessionId: 'fresh-session'
  } as const;

  const response = await runClaudexTurn(
    {
      ...turnRequest,
      provider: 'claude',
      priorSessionRef
    },
    {
      createAdapter: () =>
        createFakeAdapter({
          calls,
          resumeError: new AgentError({
            provider: 'claude',
            code: 'provider_failure',
            message: 'Session not found for resume id stale-session.'
          }),
          sessionReference: freshSessionRef,
          result: createTurnResult({
            session: freshSessionRef,
            text: 'Started fresh session.'
          })
        })
    }
  );

  assert.equal(response.outcome, 'completed');
  assert.deepEqual(calls, [
    'checkReadiness',
    'resumeSession:stale-session',
    `createSession:${process.cwd()}`,
    'run'
  ]);
  assert.equal(response.sessionRef?.sessionId, 'fresh-session');
  assert.match(response.text, /fresh session/);
});

test('direct runner preserves resumed session refs for run failures', async () => {
  const priorSessionRef = {
    provider: 'claude',
    sessionId: 'existing-session'
  } as const;

  const response = await runClaudexTurn(
    {
      ...turnRequest,
      provider: 'claude',
      priorSessionRef
    },
    {
      createAdapter: () =>
        createFakeAdapter({
          error: new Error('Resumed session run failed.'),
          sessionReference: priorSessionRef
        })
    }
  );

  assert.equal(response.outcome, 'failed');
  assert.equal(response.provider, 'claude');
  assert.deepEqual(response.sessionRef, priorSessionRef);
  assert.equal(response.failure.kind, 'runtime_error');
  assert.match(response.errorMessage, /Resumed session run failed/);
});

test('default adapter prefers the prior session provider for auto resume', () => {
  const adapter = createDefaultClaudexAdapter({
    ...turnRequest,
    provider: 'auto',
    priorSessionRef: {
      provider: 'claude',
      sessionId: 'existing-session'
    }
  }) as { preferredProviders?: readonly string[] };

  assert.deepEqual(adapter.preferredProviders, ['claude']);
});

test('direct runner maps timeouts into failed responses', async () => {
  const response = await runClaudexTurn(turnRequest, {
    timeoutMs: 25,
    createAdapter: () =>
      createFakeAdapter({
        delayMs: 250,
        result: createTurnResult({
          text: 'Too late.'
        })
      })
  });

  assert.equal(response.outcome, 'failed');
  assert.equal(response.provider, 'claude');
  assert.equal(response.failure.kind, 'timeout');
  assert.equal(response.failure.timeoutMs, 25);
});

test('direct runner maps abort signals into failed responses', async () => {
  const abortController = new AbortController();
  const responsePromise = runClaudexTurn(turnRequest, {
    signal: abortController.signal,
    createAdapter: () =>
      createFakeAdapter({
        delayMs: 250,
        result: createTurnResult({
          text: 'Too late.'
        })
      })
  });

  setTimeout(() => abortController.abort(), 25).unref();

  const response = await responsePromise;

  assert.equal(response.outcome, 'failed');
  assert.equal(response.provider, 'claude');
  assert.equal(response.failure.kind, 'aborted');
});

function createFakeAdapter({
  readiness = createReadiness('claude', 'ready'),
  result = createTurnResult({}),
  error,
  resumeError,
  delayMs = 0,
  sessionReference,
  calls = []
}: {
  readiness?: ProviderReadiness;
  result?: TurnResult;
  error?: Error;
  resumeError?: Error;
  delayMs?: number;
  sessionReference?: SessionReference | null;
  calls?: string[];
}): ClaudexRuntimeAdapter {
  const session = new FakeSession({
    provider: readiness.provider,
    result,
    error,
    delayMs,
    sessionReference,
    calls
  });

  return {
    async checkReadiness() {
      calls.push('checkReadiness');
      return readiness;
    },
    async createSession(options?: SessionOptions) {
      calls.push(`createSession:${options?.workingDirectory ?? ''}`);
      return session;
    },
    async resumeSession(reference: SessionReference) {
      calls.push(`resumeSession:${reference.sessionId}`);
      if (resumeError) {
        throw resumeError;
      }
      return session;
    }
  };
}

class FakeSession implements AgentSession {
  readonly provider: ProviderId;
  readonly capabilities: ProviderCapabilities;
  readonly reference: SessionReference | null;

  constructor(
    private readonly options: {
      provider: ProviderId;
      result: TurnResult;
      error?: Error;
      delayMs: number;
      sessionReference?: SessionReference | null;
      calls: string[];
    }
  ) {
    this.provider = options.provider;
    this.capabilities = createCapabilities(options.provider);
    this.reference =
      options.sessionReference === undefined
        ? {
            provider: options.provider,
            sessionId: `fake-${options.provider}-session`
          }
        : options.sessionReference;
  }

  async run(_input: TurnInput, options?: TurnOptions): Promise<TurnResult> {
    this.options.calls.push('run');

    if (this.options.delayMs > 0) {
      await delay(this.options.delayMs, options?.signal);
    }

    if (this.options.error) {
      throw this.options.error;
    }

    return this.options.result;
  }

  async *runStreamed(_input: TurnInput, _options?: TurnOptions): AsyncGenerator<AgentEvent> {
    return;
  }
}

function createReadiness(
  provider: ProviderId,
  status: ProviderReadiness['status']
): ProviderReadiness {
  return {
    provider,
    status,
    checks: [
      {
        kind: 'runtime',
        status: status === 'ready' ? 'pass' : 'fail',
        summary: `fake ${provider} ${status}`
      }
    ],
    capabilities: createCapabilities(provider)
  };
}

function createCapabilities(provider: ProviderId): ProviderCapabilities {
  return {
    provider,
    features: {}
  };
}

function createTurnResult(overrides: Partial<TurnResult>): TurnResult {
  return {
    provider: 'claude',
    session: {
      provider: 'claude',
      sessionId: 'fake-claude-session'
    },
    text: 'Completed fake turn.',
    usage: null,
    stopReason: 'completed',
    ...overrides
  };
}

function delay(delayMs: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    let onAbort: (() => void) | undefined;
    const timeoutId = setTimeout(() => {
      if (onAbort) {
        signal?.removeEventListener('abort', onAbort);
      }

      resolve();
    }, delayMs);

    if (signal) {
      onAbort = (): void => {
        clearTimeout(timeoutId);
        reject(
          new AgentError({
            provider: 'claude',
            code: 'aborted',
            message: 'Fake run aborted.'
          })
        );
      };

      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}
