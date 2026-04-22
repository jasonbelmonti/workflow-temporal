# workflow-temporal

Minimal TypeScript Temporal hello-world setup for this repository.

## What this starter establishes

This repository is a minimal Temporal starter that defines one workflow,
one activity, one worker entrypoint, and one client entrypoint. The goal is
to provide a small but explicit baseline for adding more workflows and
activities without having to rediscover the wiring each time.

## Prerequisites

- Node 22+
- A Temporal server reachable at `TEMPORAL_ADDRESS`

By default, the worker and client connect to `localhost:7233`. Override that
address by setting `TEMPORAL_ADDRESS`.

You already have local dev services available at the default address:

- Temporal Server: `localhost:7233`
- Temporal UI: [http://localhost:8233](http://localhost:8233)
- Temporal Metrics: [http://localhost:52122/metrics](http://localhost:52122/metrics)

## Install

```bash
npm install
```

## Project layout

- `src/activities/` contains Temporal activities
- `src/workflows/` contains workflow definitions and the shared workflow contract
- `src/worker/` contains the worker entrypoint
- `src/client/` contains the workflow starter
- `src/lib/` contains shared configuration

## Starter contract

The starter currently defines a single workflow contract in
`src/workflows/hello-world-contract.ts`:

- `HelloWorldInput` is `{ name?: string }`
- `HelloWorldResult` is `{ greeting: string }`
- the default name is `world`
- the shared task queue is `hello-world`
- workflow IDs use `hello-world-<sanitized-name>-<uuid>`

The workflow/client/worker boundary is intentionally split as follows:

- `src/workflows/hello-world-contract.ts` owns shared types, task queue naming,
  default resolution, and workflow ID generation
- `src/workflows/hello-world.ts` owns workflow behavior
- `src/activities/compose-greeting.ts` owns the activity implementation
- `src/worker/create-hello-world-worker.ts` wires workflows and activities into
  a Temporal worker
- `src/client/start-hello-world.ts` starts the workflow using the shared
  contract

If you add another workflow, keep shared workflow-facing types and identifiers
in a contract file so the client, worker, and workflow stay aligned.

## Run the worker

```bash
npm run worker
```

Expected output includes:

```text
Temporal worker connected to localhost:7233
Listening on task queue "hello-world"
```

## Start the hello-world workflow

In a separate terminal:

```bash
npm run workflow:start -- --name Temporal
```

Example successful output:

```json
{
  "workflowId": "hello-world-temporal-550e8400-e29b-41d4-a716-446655440000",
  "result": {
    "greeting": "Hello, Temporal!"
  }
}
```

If you omit `--name`, the workflow defaults to `world`.

## Type-check and build

```bash
npm run check
npm run build
```

## Smoke test the bundled workflow path

This smoke test exercises the compiled worker bundle against your local Temporal dev server.

```bash
npm test
```

## Extending the starter

When you add new behavior, keep the contract and runtime wiring explicit:

1. Add shared input/output types and identifiers under `src/workflows/`.
2. Implement workflow logic in a workflow file and activity logic under
   `src/activities/`.
3. Register new activities or workflow entrypoints through the worker wiring.
4. Start workflows from `src/client/` using the shared contract instead of
   duplicating task queue names or ID rules.

## Inspect in Temporal UI

After starting a workflow, open [http://localhost:8233](http://localhost:8233) and search for the printed `workflowId`.
