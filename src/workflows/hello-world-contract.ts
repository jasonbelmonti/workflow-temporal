export const helloWorldTaskQueue = 'hello-world';
export const defaultHelloWorldName = 'world';

export interface HelloWorldInput {
  name?: string;
}

export interface HelloWorldResult {
  greeting: string;
}

export function resolveHelloWorldName(name?: string): string {
  return name?.trim() || defaultHelloWorldName;
}

function buildHelloWorldWorkflowSuffix(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || defaultHelloWorldName
  );
}

export function buildHelloWorldWorkflowId(name?: string): string {
  return `hello-world-${buildHelloWorldWorkflowSuffix(resolveHelloWorldName(name))}-${globalThis.crypto.randomUUID()}`;
}
