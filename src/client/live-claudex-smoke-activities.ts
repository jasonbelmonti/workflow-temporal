import { Context } from '@temporalio/activity';

import * as defaultActivities from '../activities/index.js';
import {
  runClaudexTurnWithActivityContext,
  type RunClaudexTurnActivityContext,
  type RunClaudexTurnActivityRunner
} from '../activities/run-claudex-turn.js';
import {
  claudexTurnModelEnvName,
  claudexTurnTimeoutEnvName,
  type LiveHelloClaudexSmokeConfig
} from './live-claudex-smoke-config.js';

export interface CreateLiveHelloClaudexSmokeActivitiesOptions {
  context?: () => RunClaudexTurnActivityContext;
  runner?: RunClaudexTurnActivityRunner;
}

export function createLiveHelloClaudexSmokeActivities(
  config: LiveHelloClaudexSmokeConfig,
  {
    context = () => Context.current(),
    runner
  }: CreateLiveHelloClaudexSmokeActivitiesOptions = {}
): typeof defaultActivities {
  const env = buildLiveHelloClaudexTurnRuntimeEnv(config);

  return {
    ...defaultActivities,
    runClaudexTurn: (request) =>
      runClaudexTurnWithActivityContext(request, {
        context: context(),
        runner,
        env
      })
  };
}

function buildLiveHelloClaudexTurnRuntimeEnv(
  config: LiveHelloClaudexSmokeConfig
): NodeJS.ProcessEnv {
  return {
    [claudexTurnTimeoutEnvName]: String(config.turnTimeoutMs),
    ...(config.turnModel === undefined ? {} : { [claudexTurnModelEnvName]: config.turnModel })
  };
}
