export async function runWithControls<T>(
  task: (signal: AbortSignal) => Promise<T>,
  { signal, timeoutMs }: { signal?: AbortSignal; timeoutMs: number }
): Promise<T> {
  const controller = new AbortController();
  let timeoutId: NodeJS.Timeout | undefined;
  let removeAbortListener: (() => void) | undefined;

  const controlPromise = new Promise<never>((_, reject) => {
    if (signal) {
      const onAbort = (): void => {
        controller.abort();
        reject(new RunnerAbortError());
      };

      signal.addEventListener('abort', onAbort, { once: true });
      removeAbortListener = () => signal.removeEventListener('abort', onAbort);
    }

    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new RunnerTimeoutError());
      }, timeoutMs);

      timeoutId.unref();
    }
  });

  try {
    const taskPromise = task(controller.signal);
    taskPromise.catch(() => undefined);

    return await Promise.race([taskPromise, controlPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    removeAbortListener?.();
  }
}

export class RunnerTimeoutError extends Error {
  constructor() {
    super('Claudex turn timed out.');
  }
}

export class RunnerAbortError extends Error {
  constructor() {
    super('Claudex turn was aborted.');
  }
}
