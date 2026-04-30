# Temporal TypeScript SDK 1.16.0 Authority Snapshot

Status: source authority for `SRC-4` in `docs/composable-agent-workflow-execution.md`.

Captured: 2026-04-30.

## Canonical Sources

- `package-lock.json` in this repository locks `@temporalio/activity`, `@temporalio/client`, `@temporalio/common`, `@temporalio/worker`, and `@temporalio/workflow` to `1.16.0`.
- `temporalio/sdk-typescript` tag `v1.16.0`, commit `54eb0c85078632db04513d3838139ae242bf8d46`: `https://github.com/temporalio/sdk-typescript/tree/v1.16.0`.
- `temporalio/documentation` commit `26e515f28f8fdb27628b2fc968ef8f74a1d48d0f`, path `docs/develop/typescript/**`: `https://github.com/temporalio/documentation/tree/26e515f28f8fdb27628b2fc968ef8f74a1d48d0f/docs/develop/typescript`.

Host-local Codex plugin cache paths are not source authority for this execution spec.

## Project Controls Derived From The Sources

- Workflow code remains deterministic. It does not import Node filesystem or process modules, provider SDKs, Git clients, registry fetchers, or other nondeterministic runtime code.
- Side effects run in regular activities, starter code, or resolver code outside workflow replay.
- Human gate decisions use typed Temporal Updates that return `DecisionResult` values. Validators stay read-only and non-blocking; semantic failures return typed results without resuming work.
- Long-running activities declare heartbeat timeouts, heartbeat progress, and cancellation propagation to the running provider or child process.
- Workflow history stores compact state and artifact references, not large logs, diffs, transcripts, or review packets.
- Cross-run queue discovery uses Temporal Visibility search attributes or a rebuildable durable projection instead of scanning every workflow execution.
- Recipe interpreter changes that add, remove, reorder, or change activity or child-workflow commands require saved-history replay evidence and a documented patching, new workflow type, Worker Versioning, or termination/migration decision.

## Drift Control

Any change to the locked Temporal SDK version, SDK source tag, documentation commit, or the controls above must be recorded as a `DEV-*` source-authority deviation before dependent implementation continues.
