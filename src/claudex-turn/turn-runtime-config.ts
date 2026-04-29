import type { SessionOptions } from '@jasonbelmonti/claudex';

export const claudexTurnTimeoutEnvName = 'CLAUDEX_TURN_TIMEOUT_MS';
export const claudexTurnModelEnvName = 'CLAUDEX_TURN_MODEL';

export type ClaudexTurnSessionOptions = Omit<SessionOptions, 'workingDirectory'>;

export function readClaudexTurnTimeoutMs(
  env: NodeJS.ProcessEnv = process.env
): number | undefined {
  const value = env[claudexTurnTimeoutEnvName];

  if (value === undefined) {
    return undefined;
  }

  return parseClaudexTurnTimeoutMs(value);
}

export function resolveClaudexTurnTimeoutMs(
  env: NodeJS.ProcessEnv,
  defaultTimeoutMs: number
): number {
  return readClaudexTurnTimeoutMs(env) ?? defaultTimeoutMs;
}

export function readClaudexTurnSessionOptions(
  env: NodeJS.ProcessEnv = process.env
): ClaudexTurnSessionOptions | undefined {
  const model = readClaudexTurnModel(env);

  if (model === undefined) {
    return undefined;
  }

  return { model };
}

export function readClaudexTurnModel(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const value = env[claudexTurnModelEnvName];

  if (value === undefined) {
    return undefined;
  }

  const model = value.trim();

  if (!model) {
    throw new TypeError(`${claudexTurnModelEnvName} must be a non-empty string.`);
  }

  return model;
}

function parseClaudexTurnTimeoutMs(value: string): number {
  const timeoutMs = Number(value);

  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new TypeError(`${claudexTurnTimeoutEnvName} must be a positive integer.`);
  }

  return timeoutMs;
}
