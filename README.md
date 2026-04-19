# workflow-temporal

Minimal TypeScript Temporal hello-world setup for this repository.

## Prerequisites

- Node 22+
- A Temporal dev server running on `localhost:7233`

You already have the local dev services available:

- Temporal Server: `localhost:7233`
- Temporal UI: [http://localhost:8233](http://localhost:8233)
- Temporal Metrics: [http://localhost:52122/metrics](http://localhost:52122/metrics)

## Install

```bash
npm install
```

## Project layout

- `src/activities/` contains Temporal activities
- `src/workflows/` contains workflow definitions
- `src/worker/` contains the worker entrypoint
- `src/client/` contains the workflow starter
- `src/lib/` contains shared configuration

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
  "workflowId": "hello-world-temporal-1713520000000",
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

## Inspect in Temporal UI

After starting a workflow, open [http://localhost:8233](http://localhost:8233) and search for the printed `workflowId`.
