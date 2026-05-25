# Composable Agent Workflow Control Plane Execution Specification

## Document Control

| Field | Value |
| --- | --- |
| Title | Composable Agent Workflow Control Plane Execution Specification |
| Status | Draft |
| Execution level | `E3 Critical Execution` |
| Execution level justification | The execution introduces durable workflow orchestration, approval gates, resume correlation, registry-backed capability profiles, local worktree write controls, and read-only review or triage modes. Failure can resume the wrong workflow, allow review steps to mutate protected paths, or execute an agent under broader tools than declared. It also spans `workflow-temporal` and `agent-config-registry`, which makes source authority, sequencing, and rollback controls mandatory. |
| Author(s) | Codex |
| Executor(s) | Codex implementation agent(s), assigned by work package |
| Reviewers | Jason Belmonti; workflow implementation reviewer; independent capability-policy reviewer; registry contract reviewer |
| Decision owner | Jason Belmonti |
| Target branch, release, or milestone | Composable workflow MVP |
| Last updated | 2026-05-25 |
| Related source docs | `docs/composable-agent-workflow-design.md`; `docs/hello-claudex-mvp.md`; `agent-config-registry/docs/zero-dollar-agent-config-registry-design.md`; `agent-config-registry/docs/zero-dollar-agent-config-registry-execution.md` |
| Related tickets | BEL-910; implementation-control Linear issue or project pending as an entry condition. |

## 0. Execution Summary

Decision requested:
Approve with heightened controls

Approved outcome:
Execute the composable agent workflow control-plane design from `SRC-1` by adding registry-backed workflow-unit contracts, recipe and adapter records, derived compatibility graph diagnostics, bounded loop/guard semantics, an execution-profile model, a Temporal recipe interpreter, durable approval queue items, safe gate resume semantics, execution-profile enforcement, read-only triage/review behavior, run worktree containment, and operator evidence needed to activate the MVP.

Execution approach:
Use a risk-retirement and progressive-value sequence. First prove a fake recipe can validate, start, block on a durable queue item, and resume by queue item plus gate revision. BEL-910 is resolved by D-5 before WP-2: static registry workflow composition uses non-installable workflow package kinds, embedded workflow-unit contracts, derived compatibility graph output, and bounded loop transitions. Then harden registry contracts, Temporal state, execution-profile enforcement, worktree containment, skill adapters, queue triage, and live opt-in smoke evidence. Every implementation package shall have scoped validation, negative tests for the unsafe paths, and manual milestone approval before promotion.

Entry condition:
WP-1 execution shall not start until `SRC-1` is approved by Jason Belmonti, this execution spec is approved or conditionally approved for WP-1, Q-1 is resolved, a Linear execution-control issue or project exists for this implementation, and an independent capability-policy reviewer is assigned. Q-3/BEL-910 is resolved by D-5; the registry dependency state remains a gate for WP-2 registry work, not a blocker for the fake proving slice.

Top risks or unknowns:
- RISK-1: Execution-profile enforcement could be incomplete, allowing read-only review or triage steps to mutate protected paths or access disallowed tools.
- RISK-2: Queue item identity, gate revision, or workflow-run correlation could be wrong, causing an approval to resume the wrong work.
- RISK-3: Registry recipes could degrade into prompt-shaped or compatibility-blind blobs instead of typed, validated execution contracts with explicit composition, adapter, and loop semantics.

Section status:
Complete

## Layer 1: Execution Basis

## 1. Source Authority and Scope

| ID | Source | Authority | Execution implication |
| --- | --- | --- | --- |
| SRC-1 | `docs/composable-agent-workflow-design.md` in `workflow-temporal` | Current R3 design authority, status In Review, decision requested `Approve with heightened controls`. | Defines the intended control plane: versioned recipes, workflow-unit contracts, derived compatibility diagnostics, bounded loops, pinned snapshots, execution profiles, durable queue items, approval decisions, read-only triage, worktree containment, and heightened controls. Implementation cannot start until approval is recorded. Temporal Update-specific execution choices are governed by `SRC-4`. |
| SRC-2 | Existing `workflow-temporal` implementation in `src/workflows/**`, `src/activities/**`, and `src/claudex-turn/**` | Current executable baseline. | Shows the bounded Claudex turn boundary, hard-coded `agent.helloClaudex` workflow, current query and signal surfaces, cancellation behavior, session hints, and current absence of recipe, queue, worktree, or profile enforcement abstractions. |
| SRC-3 | `docs/hello-claudex-mvp.md` | MVP baseline design for Temporal-owned durable state and bounded agent turns. | Preserves constraints that workflow code remains deterministic, human input occurs between bounded turns, provider session refs are hints, and artifact refs are queryable workflow state. |
| SRC-4 | `docs/reference/temporal-typescript-sdk-1.16.0-authority.md`, which pins Temporal TypeScript SDK `1.16.0` from `package-lock.json`, `temporalio/sdk-typescript` tag `v1.16.0` commit `54eb0c85078632db04513d3838139ae242bf8d46`, and `temporalio/documentation` commit `26e515f28f8fdb27628b2fc968ef8f74a1d48d0f` path `docs/develop/typescript/**` | Temporal implementation authority for this spec. The repo-committed snapshot is the reviewable source authority; host-local cache paths are not source authority. | Requires deterministic workflow code, side effects in regular activities, typed Updates for state mutations that return results, read-only non-blocking Update validators, activity heartbeats for cancellation delivery, compact payload handling, visibility/search attributes or a durable projection for cross-run discovery, and replay/versioning controls for command-sequence changes. |
| SRC-5 | Canonical `jasonbelmonti/agent-config-registry` repository at `https://github.com/jasonbelmonti/agent-config-registry`, commit `b011664409b32967de9584e13c393b8b7ddd20f1` from 2026-04-29, tracked files `docs/zero-dollar-agent-config-registry-design.md`, `docs/zero-dollar-agent-config-registry-execution.md`, `src/agent-config-registry/contracts/**`, `src/agent-config-registry/validation/**`, and `docs/evidence/zero-dollar-registry/**` | Registry source and dependency baseline. The canonical repository and pinned commit are the source authority; local checkout paths, local branches, and uncommitted `.worktrees/**` entries are not source authority for this spec. | Registry currently defines `skill`, `agent-instructions`, and sync `profile` package kinds plus catalog/digest contracts. The composable workflow effort must add workflow-specific records without confusing runtime `execution-profile` records with existing sync profiles. |
| SRC-6 | Repository operating manual and user project-management constraints | Local execution authority. | Work shall prefer repo-local git worktrees. Linear, Jira, GitHub Issue, or Markdown handoff task bodies created for this effort shall use the `task-definition` contract with exact headings for Objective, Context / Constraints, Source Authority, Task Scope, Materially Verifiable Success Criteria, Incremental Value Delivery, Review Boundary, Validation / Evidence, Execution Notes, and Follow-up / Non-blocking Work. Durable handoff or review packets shall include exact artifact paths, read-first instructions, and checksum or validation evidence for local planning artifacts. |
| SRC-7 | User request on 2026-04-30 | Direct source request. | Draft this execution spec using `execution-spec-template` and `temporal:temporal-developer`, based on `docs/composable-agent-workflow-design.md`. |

In scope:
Implement the composable workflow MVP across `workflow-temporal` and `agent-config-registry`: workflow-unit contract records, workflow recipe records, step definitions, adapter-definition records, derived compatibility graph diagnostics, bounded loop/guard transition fields, runtime `execution-profile` records, recipe validation, pinned recipe snapshots, a new recipe-backed Temporal workflow, fake and real step activity runners, approval queue items, typed gate decision Updates, stale-decision rejection, worktree allocation, artifact references, execution-profile enforcement, read-only triage/review packets, visibility or projection listing, replay/versioning gates, five known happy-path skill adapters, tests, docs, evidence, and rollback controls.

Out of scope:
This execution will not build a hosted multi-user workflow product, replace Temporal, make provider-native sessions authoritative, create a general `AGENTS.md` merge engine, implement a public marketplace protocol, move registry runtime state into Git, introduce a registry microservice, or require an always-on paid server for the MVP.

Definition of done:
All `WP-*` work packages are complete; all `MS-*` gates have approval evidence; all `VAL-*` checks have `EVD-*` artifacts; compatibility graph and loop fixtures pass; read-only and stale-resume negative tests pass; a fake recipe smoke test and one opt-in live Codex-backed smoke path are documented; recipe-backed starts can be disabled or rolled back; and the existing `agent.helloClaudex` path remains runnable or has an approved replacement decision.

Re-decision boundaries:
Execution shall not re-decide Temporal as the durable state owner, provider session refs as non-authoritative hints, registry as the versioned static configuration compiler, read-only review/triage containment, queue item plus gate revision resume semantics, derived compatibility diagnostics as metadata, or the no-paid-server MVP posture. Any change to those decisions requires a `DEV-*` deviation and Jason Belmonti approval before related implementation proceeds.

Section status:
Complete

## 2. Objectives and Non-Objectives

| ID | Statement | Completion horizon | Evidence |
| --- | --- | --- | --- |
| OBJ-1 | A pinned registry recipe shall start a Temporal workflow that executes typed steps without hard-coded workflow-code step order. | Before MVP activation. | EVD-1, EVD-3, EVD-5 |
| OBJ-2 | Registry content shall validate workflow recipes, step definitions, and runtime execution profiles as typed records distinct from existing sync `profile` records. | Before real skill adapters are enabled. | EVD-2, EVD-4 |
| OBJ-3 | Blocking step outcomes shall create durable approval queue items with workflow execution ID, queue item ID, gate revision, decision options, artifacts, and compact context. | Before human-gated recipe runs are accepted. | EVD-1, EVD-6 |
| OBJ-4 | Decision Updates shall return typed `DecisionResult` values and resume only the matching workflow execution, queue item, and gate revision, while stale, cancelled, or abandoned gates remain blocked or terminal. | Before any live provider-backed recipe run. | EVD-1, EVD-6, EVD-13 |
| OBJ-5 | Execution profiles shall deny disallowed tools, skills, MCP servers, approval-Update authority, and protected-path writes before agent execution. | Before triage or consensus-review automation is enabled. | EVD-7, EVD-9 |
| OBJ-6 | Mutating execution shall be isolated to one explicit run worktree and failed runs shall preserve artifacts for inspection and rollback. | Before mutating skill adapters are enabled. | EVD-7, EVD-10 |
| OBJ-7 | Queue triage shall package pending gates into operator-review packets without approving gates or mutating workflow state. | Before completion handoff. | EVD-9, EVD-11 |
| OBJ-8 | Registry workflow composition shall be governed by the approved BEL-910/D-5 strategy before WP-2 starts, then proven through exported workflow-unit contracts, explicit adapters, derived compatibility graph diagnostics, and bounded loop fixtures before MS-2 approval. | BEL-910 before WP-2 starts; EVD-19 and EVD-20 before MS-2 approval. | BEL-910, EVD-19, EVD-20 |
| NG-1 | This execution will not replace the current MVP workflow with a hosted orchestration product. | Applies throughout MVP. | REV-1 |
| NG-2 | This execution will not treat provider session IDs as authoritative workflow state. | Applies throughout MVP. | VAL-5, VAL-8, VAL-13 |
| NG-3 | This execution will not implement custom credential storage or a new registry authentication model. | Applies throughout MVP. | REV-4 |
| NG-4 | This execution will not implement a complete public skill marketplace, package search UI, or reusable cross-project workflow platform. | Applies throughout MVP. | REV-6 |
| NG-5 | This execution will not permit read-only review or triage profiles to write into source, registry, or run worktree paths. | Applies throughout MVP. | VAL-7, VAL-9 |

Section status:
Complete

## 3. Ownership, Roles, and Decision Points

| Role or person | Responsibility | Required action |
| --- | --- | --- |
| Jason Belmonti | Owns design approval, MVP scope, Linear structure, milestone approval, and final activation. | Approve |
| Codex implementation agent | Implements scoped work packages inside assigned editable paths and produces evidence. | Execute |
| Workflow implementation reviewer | Reviews Temporal determinism, state transitions, queue semantics, activity boundaries, and rollback. | Review |
| Registry contract reviewer | Reviews registry package-kind changes, schema compatibility, catalog validation, and digest behavior. | Review |
| Independent capability-policy reviewer | Reviews execution-profile enforcement, read-only containment, protected-path policy, and approval-Update authority. | Review |
| Workflow operator | Runs local smoke tests, triage checks, gate decisions, rollback drills, and handoff verification. | Operate |
| Linear and GitHub integrations | Provide project-management, source-control, PR, and review context used by recipe steps. | Inform |

Decision points:
- DP-1: Approve `SRC-1` and this execution spec before implementation starts.
- DP-2: Decide whether existing durable human-loop MVP work is implemented first, replaced by the recipe-backed gate model, or absorbed into WP-3 before Temporal queue work begins.
- DP-3: BEL-910 resolved on 2026-05-01 by approving D-5: additive non-installable package kinds for `workflow-recipe`, `step-definition`, `adapter-definition`, and runtime `execution-profile`; embedded `workflowUnitContract` fields; guarded loop fields on recipe transitions; and derived compatibility graph catalog output. Any revision before WP-2 starts requires reopening BEL-910 or recording an approved deviation.
- DP-4: Approve the fake recipe-to-gate proving slice before real skill adapters or live providers are enabled.
- DP-5: Approve capability-policy negative-test evidence before read-only triage or consensus review can run.
- DP-6: Approve rollback drill and operator handoff before marking the MVP complete.
- DP-7: Decide whether `consensus-review` is represented as one step with fanout internals or as a recipe subworkflow before WP-5 adapts the real skill.

Escalation path:
Pause execution and escalate to Jason Belmonti if implementation requires a hosted service, custom credential store, weaker read-only containment, ambiguous queue ownership, shared editable paths across agents, nondeterministic workflow imports, direct registry state mutation during workflow replay, or any change that makes rollback materially weaker than this spec.

Section status:
Complete

## 4. Constraints, Assumptions, and Dependencies

| ID | Type | Statement | Owner | Blocking? | Validation or resolution plan |
| --- | --- | --- | --- | --- | --- |
| CON-1 | Constraint | Temporal workflow state shall remain the source of truth for run status, step cursor, active gate, queue item correlation, and terminal state. | Workflow implementation agent | No | VAL-5, VAL-6, and VAL-8 inspect workflow state and query behavior. |
| CON-2 | Constraint | Temporal workflow code shall not import Claudex, Codex, Claude SDKs, registry filesystem fetchers, Git clients, or nondeterministic runtime code. | Workflow implementation reviewer | No | VAL-5 and REV-3 inspect imports and compiled workflow bundle behavior. |
| CON-3 | Constraint | Running workflows shall use immutable recipe snapshots pinned by registry commit, digest, or equivalent snapshot ID. | Workflow implementation agent | No | VAL-3 verifies running workflows ignore later registry changes. |
| CON-4 | Constraint | Runtime `execution-profile` records shall be distinct from existing registry sync `profile` records. | Registry implementation agent | Yes | BEL-910/D-5 records the distinction; VAL-4 verifies it before recipes reference execution profiles. |
| CON-5 | Constraint | Read-only execution profiles shall deny write-capable tools, worker-agent delegation, mutation-capable MCP tools, approval-Update authority, and protected-path writes. | Capability-policy reviewer | No | VAL-7 and VAL-9 run negative enforcement tests. |
| CON-6 | Constraint | Mutating steps shall run in one explicit run worktree and shall not share active mutable paths across workflow runs. | Workflow implementation agent | No | VAL-7 and VAL-10 verify allocation, labels, and failed-run preservation. |
| CON-7 | Constraint | Queue triage may create derived review-packet artifacts but shall not approve, reject, cancel, abandon, or otherwise mutate workflow gate state. | Workflow implementation agent | No | VAL-9 verifies no queue-state mutation during triage. |
| CON-8 | Constraint | Project-management tasks created for this execution shall use the repository `task-definition` contract, including Source Authority, Task Scope, Incremental Value Delivery, Review Boundary, Validation / Evidence, and Follow-up / Non-blocking Work in addition to Objective, Context / Constraints, Materially Verifiable Success Criteria, and Execution Notes. | Codex implementation agent | No | REV-1 inspects task-definition compliance before implementation starts. |
| CON-9 | Constraint | Non-mutating steps may retry only according to pinned retry policy; mutating steps shall not auto-retry unless explicit idempotency is declared. | Workflow implementation reviewer | No | VAL-14 verifies retry policy and mutating retry denial. |
| CON-10 | Constraint | Human gate approval, rejection, and abandonment shall use Temporal Updates that return typed `DecisionResult` values; validators shall remain read-only and non-blocking, while semantic failures return `stale`, `invalid`, `rejected`, or `no_effect` results from the handler without resuming work. | Workflow implementation reviewer | No | VAL-6 and REV-5 inspect Update handler and validator behavior. |
| CON-11 | Constraint | Cross-run queue discovery shall use Temporal Visibility search attributes or a rebuildable durable projection; workflow histories shall store compact artifact references instead of large logs, diffs, transcripts, or review packets. | Workflow implementation agent | No | VAL-18 verifies listing, compact history, and projection rebuild or visibility behavior. |
| CON-12 | Constraint | Long-running agent activities shall declare heartbeat timeouts, heartbeat progress, and propagate cancellation through `Context.current().cancelled`, `cancellationSignal()`, `AbortSignal`, or child-process termination where supported. | Workflow implementation reviewer | No | VAL-15 verifies heartbeat-backed cancellation delivery and provider abort behavior. |
| CON-13 | Constraint | Recipe interpreter changes that add, remove, reorder, or change activity or child-workflow commands shall run saved-history replay with `Worker.runReplayHistory` and document a patching, new workflow type, Worker Versioning, or termination/migration decision before merge. | Workflow implementation reviewer | No | VAL-17 and REV-3 verify replay and versioning evidence. |
| CON-14 | Constraint | `agent-config-registry` shall remain a static configuration compiler for the MVP, not a runtime workflow-state service or always-on microservice. | Registry contract reviewer | Yes for WP-2 | BEL-910 and VAL-19 record the selected static record/catalog strategy. |
| CON-15 | Constraint | Compatibility graph edges shall be derived from workflow-unit contracts and explicit adapter definitions, not manually authored as source truth. | Registry implementation agent | Yes for WP-2 | VAL-19 verifies direct, adapter-required, incompatible, and composite-workflow-as-step fixtures. |
| CON-16 | Constraint | Looping recipe transitions shall declare typed guard predicates, loop identity, carried state, maximum iterations, terminal fallback, and history-budget behavior. | Registry implementation agent and workflow implementation reviewer | Yes for WP-2/WP-3 | VAL-20 verifies accepting and rejecting loop fixtures. |
| ASM-1 | Assumption | Fake steps can prove recipe, queue, and resume semantics before real skills are adapted. | Workflow implementation agent | No | VAL-1 proves the fake multi-run queue proof before WP-2 expands breadth. |
| ASM-2 | Assumption | The registry can add non-installable workflow package kinds for `workflow-recipe`, `step-definition`, `adapter-definition`, and runtime `execution-profile`; embedded `workflowUnitContract` and guarded loop fields; and derived compatibility graph catalog metadata without breaking existing skill, agent-instruction, or sync-profile behavior. | Registry implementation agent | No | BEL-910 approved D-5; VAL-4, VAL-16, VAL-19, and VAL-20 run compatibility tests across old and new records. |
| ASM-3 | Assumption | Initial queue listing can use Temporal Visibility search attributes if the local dev server supports the required fields; a rebuildable local projection is added only if the 50-item triage measurement requires it. | Workflow implementation agent | No | Q-2 resolves during WP-6 through VAL-9 and VAL-18 before MS-4 approval. |
| DEP-1 | Dependency | `SRC-1` design approval and this execution spec approval are required before implementation starts. | Jason Belmonti | Yes | Section 18 entry gate requires explicit approval evidence. |
| DEP-2 | Dependency | A Linear execution-control issue or project shall exist before implementation starts, and any execution-control task body shall satisfy the `task-definition` contract. | Jason Belmonti | Yes | REV-1 verifies issue/project attribution, source authority, review boundary, validation evidence, and required task-definition heading format. |
| DEP-3 | Dependency | Registry contract, validation, and catalog work must be stable enough to extend before formal workflow record implementation starts. | Registry implementation agent | Yes before WP-2 | BEL-910/D-5 records the selected workflow record strategy; DEP-3 records whether to wait for the active registry branch to stabilize or implement workflow records on a coordinated registry worktree. |
| DEP-4 | Dependency | Local Temporal server, Node 22+, and current offline test commands shall be available for integration smoke evidence. | Workflow operator | Yes before WP-3 | VAL-1 and VAL-5 record environment and command evidence. |

Section status:
Complete

## Layer 2: Execution Plan

## 5. Evidence-Led Execution Model

Observable outcome:
An operator can start a recipe-backed agent workflow from validated registry content, observe queryable run and listable queue state, receive a durable approval queue item from a blocking step, submit an approval, rejection, or abandonment Update that returns a typed `DecisionResult`, and continue execution under the declared execution profile without relying on provider-local session state or unsafe write access.

Core value proposition:
The control plane converts manually chained agent skills into a durable, typed, reviewable execution protocol where Temporal owns state, the registry owns versioned configuration, and human approvals are visible, triageable, and safe to resume.

Critical path hypothesis:
The shortest path that proves the design is viable is: validate a minimal recipe and runtime execution profile, resolve it to an immutable snapshot, start at least two Temporal recipe runs, execute fake regular activities, emit at least three queue items, reject stale and mismatched decision Updates with typed results, accept only matching decision Updates, and complete targeted runs while preserving deterministic workflow boundaries.

First proving slice:
WP-1 shall implement a fake recipe-to-gate vertical slice with workflow-local fake recipe and execution-profile fixtures that emulate resolved registry output, a pinned snapshot, a recipe-backed Temporal workflow path, fake blocking activities, queue item queries or visibility records, stale-decision rejection, wrong-workflow and wrong-queue-item rejection, typed `DecisionResult` return values, and matching approval resume. This slice shall create at least three queue items across at least two workflow runs, use fake regular activities only, and shall not edit `agent-config-registry` contracts, schemas, validation, catalog behavior, real skills, or live providers.

Sequencing principle:
Execution shall retire the highest-risk claims before broad implementation: prove recipe/gate/resume semantics with fake steps first, harden registry contracts second, enforce capability and worktree containment before real skills, and add triage/live smoke only after queue and profile negative tests pass.

Validation cadence:
Every work package shall produce focused tests and an evidence note under `docs/evidence/composable-agent-workflow/`. Integration validation runs at each milestone. Negative tests for stale decisions, active heartbeat-backed cancellation, retry-policy and idempotency violations, read-only writes, disallowed tools, one-run-one-worktree containment, protected-path changes, compatibility graph classification, invalid loop declarations, replay compatibility, and history/visibility growth are mandatory before live or mutating adapter work.

Deferred completeness:
Hosted UI, public workflow marketplace, full multi-user permissions, provider-agnostic live smoke beyond Codex, advanced queue prioritization heuristics, and reusable cross-repository package publication are deferred until after the MVP proves the local control-plane path.

Primary risks and unknowns:

| ID | Risk or unknown | Why it matters | Owner | Evidence required to retire | Decision gate |
| --- | --- | --- | --- | --- | --- |
| RISK-1 | Execution-profile enforcement could be incomplete. | Read-only review and triage steps become unsafe if prompts are the only control. | Capability-policy reviewer | VAL-7 and VAL-10 before MS-3, VAL-9 before MS-4, plus REV-4 approval. | MS-3, MS-4 |
| RISK-2 | Queue item identity or resume correlation could be wrong. | A human approval could resume the wrong workflow, step, or stale gate. | Workflow implementation agent | VAL-1 and VAL-6 stale/wrong-run decision tests. | MS-1, MS-3 |
| RISK-3 | Recipes could become prompt-shaped blobs. | Composition, validation, triage, and downstream step execution require typed contracts. | Registry implementation agent | VAL-2 and VAL-4 reject prompt-only recipe and missing contract records. | MS-2 |
| RISK-4 | Registry baseline is still in active MS-1 implementation. | Workflow-specific registry records may conflict with validation/catalog changes in progress. | Registry contract reviewer | BEL-910/D-5, REV-2, DEP-3 readiness, and compatibility evidence from VAL-4. | MS-2 |
| RISK-10 | Compatibility graph complexity could turn the registry into a runtime platform. | A registry microservice would add deployment, auth, persistence, and availability scope that the MVP explicitly avoids. | Registry contract reviewer | BEL-910 records static-compiler strategy; VAL-19 proves graph output is derived and metadata-only. | MS-2 |
| RISK-11 | Looping recipes could run indefinitely or hide unresolved findings. | Review/fix/review loops must be bounded and operator-visible. | Workflow implementation reviewer | VAL-20 verifies guard predicates, maximum iterations, terminal fallback, and history-budget behavior. | MS-2, MS-3 |
| RISK-7 | Mutating activity retries could duplicate filesystem or external side effects. | Temporal may re-execute activities after worker failure unless retry and idempotency policy is explicit. | Workflow implementation reviewer | VAL-14 verifies idempotency keys, retry taxonomy, and disabled nested provider retries. | MS-3 |
| RISK-8 | Recipe-interpreter changes could break replay for in-flight workflows. | Any command-sequence change can block existing executions with nondeterminism errors. | Workflow implementation reviewer | VAL-17 replay evidence and versioning decision. | MS-3 and release gate |
| RISK-9 | Queue listing or large artifacts could exceed local performance, payload, or history limits. | Triage depends on cross-run discovery, and Temporal histories cannot safely carry large agent artifacts. | Workflow implementation agent | VAL-18 listing, compact-history, projection rebuild, and continue-as-new evidence. | MS-4 |
| Q-1 | Should existing durable human-loop MVP work land first, or should its scope be absorbed into WP-3? | This affects sequencing and whether existing MVP tasking is superseded or prerequisite. | Jason Belmonti | Written decision in EVD-0 and project-management updates. | Entry gate |
| Q-2 | Should queue listing use Temporal Visibility search attributes only, or a derived local projection? | Triage performance and recovery complexity depend on this choice. | Workflow implementation agent | 50-item seed measurement in VAL-9 and VAL-18. | MS-4 |
| Q-4 | Should the first `consensus-review` adapter use the design-approved child-workflow fanout shape or the allowed single bounded step activity shape? | This changes adapter boundaries, workflow state shape, and review packet evidence while staying inside `SRC-1` D-1. | Jason Belmonti | Written decision before WP-5; VAL-8 verifies the adapter follows the approved shape. | MS-4 |

Section status:
Complete

## 6. Change Surface Inventory

| ID | Surface | Change type | Owner | Read/write boundary | Review expectation |
| --- | --- | --- | --- | --- | --- |
| SURF-1 | `agent-config-registry/src/agent-config-registry/contracts/**`, `schemas/**` | Contract / Schema | Registry implementation agent | Add non-installable workflow package kind contracts for `workflow-recipe`, `step-definition`, `adapter-definition`, and runtime `execution-profile`; embedded `workflowUnitContract` fields; guarded loop transition fields; and compatibility metadata without weakening existing package kinds. | REV-2 |
| SURF-2 | `agent-config-registry/src/agent-config-registry/validation/**`, catalog/digest modules, tests | Code / Test | Registry implementation agent | Add validation and catalog behavior for workflow records, derived compatibility diagnostics, adapter-required edges, incompatible edge reporting, and bounded loop fixtures. | REV-2 |
| SURF-3 | `workflow-temporal/src/workflows/**` | Code / Contract | Workflow implementation agent | Add a new recipe-backed workflow, queries, decision Updates, cancellation handling, search-attribute upserts where selected, and deterministic state transitions. Do not import side-effectful runtime code. | REV-3, REV-5 |
| SURF-4 | `workflow-temporal/src/activities/**`, `src/claudex-turn/**` | Code | Workflow implementation agent | Add step activity runner and execution-context handling outside workflow code. | REV-3, REV-4 |
| SURF-5 | Worktree manager and artifact storage modules under `workflow-temporal/src/**` | Code / Data | Workflow implementation agent | Add run-scoped worktree and artifact handling; writes only under explicit run-owned paths. | REV-4, REV-6 |
| SURF-6 | Approval queue, triage packet, and operator client surfaces under `workflow-temporal/src/client/**` and related modules | Code / API | Workflow implementation agent | Add query/list/decision surfaces and triage packets without implicit approval-Update authority. | REV-5, REV-6 |
| SURF-7 | Tests under both repositories | Test | Assigned package owners | Add unit, contract, bundle, negative, and smoke tests tied to `VAL-*` checkpoints. | REV-2 through REV-6 |
| SURF-8 | `docs/**`, `README.md`, `docs/evidence/composable-agent-workflow/**` | Docs / Runbook | Codex implementation agent | Add operator docs, evidence, rollback, and implementation handoff. Design doc remains read-only unless a deviation is approved. | REV-1, REV-6 |
| SURF-9 | Linear project/issues for composable workflow MVP | Project management | Jason Belmonti / Codex implementation agent | Create or update tasks with `task-definition` headings, source authority, task scope, incremental value, review boundary, validation/evidence, follow-up boundaries, and traceability to this spec. | REV-1 |
| SURF-10 | Existing `agent.helloClaudex` workflow path | Compatibility | Workflow implementation agent | Preserve as legacy path unless an approved deviation replaces it. | REV-3, REV-6 |

Section status:
Complete

## 7. Agent-Focused Package Decomposition

Decomposition mission:
Constrain cross-repository implementation so registry contracts, recipe resolution, Temporal orchestration, queue semantics, execution-profile enforcement, worktree containment, and operator surfaces can be assigned independently without overlapping write ownership or hidden dependency cycles.

| ID | Unit | Ladder level | Mission | Observable value enabled | Risk retired | Public interface | Validation command | Promotion blockers |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PKG-1 | Registry workflow contracts | 2 | Define non-installable workflow recipe, step definition, adapter definition, and runtime execution-profile package kinds; embedded workflow-unit contract fields; guarded loop transition fields; and compatibility metadata contracts. | Recipes can be validated and composed without prompt prose. | RISK-3, RISK-4, RISK-10, RISK-11 | Exported contract constants, types, schema records. | `npm test -- tests/contracts` in `agent-config-registry` | App-specific record semantics and no release compatibility process yet. |
| PKG-2 | Registry workflow validation and catalog integration | 2 | Validate and catalog workflow records, references, profile compatibility, adapter requirements, compatibility graph diagnostics, and guarded loop semantics. | Registry can reject invalid recipes and explain composition before workflow starts. | RISK-3, RISK-4, RISK-10, RISK-11 | Validation entrypoints, error codes, catalog record extensions, compatibility diagnostics. | `npm test -- tests/validation tests/catalog` in `agent-config-registry` | Depends on registry MS-1 validation/catalog baseline. |
| PKG-3 | Recipe resolver and snapshot contract | 2 | Resolve registry content to immutable workflow snapshots. | Temporal runs start from pinned recipe snapshots. | RISK-2, RISK-3 | Snapshot types, resolver activity or starter API, digest metadata. | `npm test` in `workflow-temporal` plus resolver tests | App-specific Temporal start semantics. |
| PKG-4 | Temporal recipe workflow and queue state | 2 | Interpret recipe steps, store run/gate state, manage visibility metadata, and handle decision Updates. | Fake and real recipe runs block and resume safely. | RISK-2, RISK-8, RISK-9 | Workflow type, query names, Update payloads, `DecisionResult`, state/result contracts. | `npm run test:smoke` in `workflow-temporal` plus replay tests | Temporal-specific and tied to local MVP workflow model. |
| PKG-5 | Step activity runner and skill adapters | 2 | Execute one bounded typed step through fake or real agent adapters. | Real skills can run from typed inputs and produce typed outputs. | RISK-3 | Step request/result contracts, adapter registry, fake runner. | `npm test` in `workflow-temporal` | Skill-specific behavior and local provider assumptions. |
| PKG-6 | Execution-profile enforcement, worktree, and artifact containment | 2 | Apply capability policy, run worktree allocation, read-only bundles, and protected-path checks. | Mutating work is isolated and read-only work cannot write protected paths. | RISK-1 | Execution context, worktree manager, artifact references, enforcement adapter. | `npm test` plus negative enforcement tests in `workflow-temporal` | Depends on local filesystem and tool availability. |
| PKG-7 | Approval queue triage and operator surfaces | 2 | List pending gates through visibility or projection, build review packets, and expose operator decision helpers without granting triage approval power. | Operators can triage gates without implicit approval. | RISK-1, RISK-2, RISK-9, Q-2 | Queue query/list API, triage packet artifact contract, CLI helpers. | `npm test` plus 50-item triage measurement | Heuristics are MVP-specific and not reusable yet. |

### Package Boundary Card: PKG-1

Ladder level:
2.

Mission:
Own registry-side typed contracts for workflow units, workflow recipes, step definitions, adapter definitions, guarded loop transitions, compatibility metadata, and runtime execution profiles.

Value / risk trace:
- Observable value enabled: registry content can express and explain composable workflows without hard-coded Temporal step order or prompt-inferred edges.
- Risk retired: RISK-3, RISK-4, RISK-10, RISK-11.
- Validation evidence: VAL-2, VAL-4, VAL-16, VAL-19, VAL-20, EVD-2, EVD-4, EVD-16, EVD-19, EVD-20.
- Blocking unknowns: DEP-3 registry readiness.

Owns:
- Files/directories: `agent-config-registry/src/agent-config-registry/contracts/**`, `schemas/**`, focused contract tests.
- Concepts: package kinds or record types, schema versions, contract field names, workflow-unit exported contracts, explicit adapter records, guarded loop fields, compatibility metadata, and compatibility between recipes and execution profiles.
- Runtime responsibilities: none; this package declares contracts only.

Does not own:
- Explicitly excluded behavior: Temporal run state, live workflow execution, filesystem writes, agent invocation.
- Responsibilities delegated elsewhere: validation to PKG-2, recipe resolution to PKG-3, runtime enforcement to PKG-6.

Public interface:
- Exported types: workflow unit, recipe, step definition, adapter definition, compatibility diagnostic, loop transition, execution profile, gate policy, retry policy, capability policy.
- Exported functions/classes/components: constants and contract guards as needed.
- Events/messages/contracts: registry record schemas.
- CLI/API surface: none.

Allowed dependencies:
- May import: existing registry contract and schema modules.
- May call: pure contract guards only.
- May read configuration from: package-local schema constants.

Forbidden dependencies:
- Must not import: `workflow-temporal`, Temporal SDK, Claudex, Codex, filesystem runtime modules.
- Must not call: network, Git, install, sync, or workflow start logic.
- Must not know about: current local worktree paths or live queue state.

State boundary:
- Owns state: committed schema and contract definitions.
- Reads state: existing package-kind constants.
- Mutates state: no runtime state.
- Persistence responsibility: source and schema files only.

Agent ownership boundary:
- Agent editable paths: `agent-config-registry/src/agent-config-registry/contracts/**`, `agent-config-registry/schemas/**`, `agent-config-registry/tests/contracts/**`.
- Agent read-only paths: registry design and execution docs; `workflow-temporal/docs/composable-agent-workflow-design.md`.
- Required coordination before editing: package kind names, schema version fields, compatibility diagnostic format, guarded loop fields, or existing `profile` semantics.

Validation command:
`npm test -- tests/contracts` from `agent-config-registry`.

Promotion blockers:
The contracts are MVP-specific until versioning, compatibility, and release policy exist.

### Package Boundary Card: PKG-2

Ladder level:
2.

Mission:
Own registry-side validation and catalog behavior for workflow records, derived compatibility graph diagnostics, adapter-required edges, and guarded loop semantics.

Value / risk trace:
- Observable value enabled: invalid workflow recipes, profile references, incompatible edges, missing adapters, and unbounded loops fail before a workflow starts.
- Risk retired: RISK-3, RISK-4, RISK-10, RISK-11.
- Validation evidence: VAL-2, VAL-4, VAL-16, VAL-19, VAL-20, EVD-2, EVD-4, EVD-16, EVD-19, EVD-20.
- Blocking unknowns: DEP-3.

Owns:
- Files/directories: `agent-config-registry/src/agent-config-registry/validation/**`, catalog integration modules, validation/catalog tests.
- Concepts: reference validation, missing-contract errors, prompt-only rejection, compatibility edge classification, adapter requirement diagnostics, loop validation, catalog metadata.
- Runtime responsibilities: local validation only.

Does not own:
- Explicitly excluded behavior: workflow execution, queue mutation, agent invocation, worktree writes.
- Responsibilities delegated elsewhere: contracts to PKG-1, runtime snapshot use to PKG-3.

Public interface:
- Exported types: validation result, compatibility diagnostic, and error codes for workflow records.
- Exported functions/classes/components: validation entrypoints and catalog builders.
- Events/messages/contracts: catalog record output.
- CLI/API surface: consumed by registry validation CLI when available.

Allowed dependencies:
- May import: PKG-1 contracts, digest/canonicalization modules, existing validation primitives.
- May call: pure validation and catalog generation functions.
- May read configuration from: registry root paths and schema constants passed explicitly.

Forbidden dependencies:
- Must not import: `workflow-temporal`, provider SDKs, Temporal SDKs, local install/sync write modules.
- Must not call: workflow starts, agent runners, protected-path write checks.
- Must not know about: live workflow IDs or queue item state.

State boundary:
- Owns state: validation errors and generated catalog output.
- Reads state: registry source files and schemas.
- Mutates state: generated catalog only through catalog builder command or tests.
- Persistence responsibility: metadata-only catalog output.

Agent ownership boundary:
- Agent editable paths: `agent-config-registry/src/agent-config-registry/validation/**`, catalog modules, validation/catalog tests, schema fixtures.
- Agent read-only paths: `agent-config-registry/src/agent-config-registry/contracts/**` unless assigned PKG-1 too.
- Required coordination before editing: validation result shape, public error codes, compatibility graph metadata, generated catalog fields.

Validation command:
`npm test -- tests/validation tests/catalog` from `agent-config-registry`.

Promotion blockers:
Validation remains tied to the private registry layout and MVP package kinds.

### Package Boundary Card: PKG-3

Ladder level:
2.

Mission:
Own workflow-side recipe resolution, pinning, and snapshot contracts.

Value / risk trace:
- Observable value enabled: Temporal workflows start from immutable recipe snapshots.
- Risk retired: RISK-2, RISK-3.
- Validation evidence: VAL-1, VAL-3, EVD-1, EVD-3.
- Blocking unknowns: WP-2 registry contract stabilization.

Owns:
- Files/directories: `workflow-temporal/src/**/recipe*`, resolver modules, starter input extensions, snapshot tests.
- Concepts: recipe snapshot ID, source registry commit/digest, step list materialization.
- Runtime responsibilities: resolve before workflow start or inside side-effectful starter/activity, never inside deterministic replay code.

Does not own:
- Explicitly excluded behavior: registry validation internals, queue item decision rules, execution-profile filesystem enforcement.
- Responsibilities delegated elsewhere: registry contracts to PKG-1, Temporal interpretation to PKG-4.

Public interface:
- Exported types: recipe snapshot, step snapshot, execution profile snapshot metadata.
- Exported functions/classes/components: resolver API and snapshot builder.
- Events/messages/contracts: workflow start payload references snapshot ID.
- CLI/API surface: starter surface for recipe-backed workflow runs.

Allowed dependencies:
- May import: pure contract types, Node activity/starter code, filesystem or Git access outside workflow code.
- May call: registry validation/fetch adapters from side-effectful contexts.
- May read configuration from: explicit registry path/ref arguments.

Forbidden dependencies:
- Must not import: side-effectful resolver code into `@temporalio/workflow` modules.
- Must not call: live registry reads during workflow replay.
- Must not know about: provider session internals.

State boundary:
- Owns state: immutable recipe snapshot passed into workflow start.
- Reads state: registry content and snapshot metadata before start.
- Mutates state: no workflow state except start payload construction.
- Persistence responsibility: snapshot metadata in workflow input/state.

Agent ownership boundary:
- Agent editable paths: resolver modules, starter/client recipe-start files, snapshot tests.
- Agent read-only paths: `src/workflows/hello-claudex*` unless assigned PKG-4.
- Required coordination before editing: workflow start contract and snapshot schema.

Validation command:
`npm test` from `workflow-temporal` plus focused resolver tests.

Promotion blockers:
Resolver semantics are specific to local registry and workflow start behavior.

### Package Boundary Card: PKG-4

Ladder level:
2.

Mission:
Own the deterministic Temporal recipe workflow, run state, step cursor, queue item creation, visibility metadata, and decision-Update handling.

Value / risk trace:
- Observable value enabled: recipe runs block and resume safely under Temporal-owned state.
- Risk retired: RISK-2, RISK-8, RISK-9.
- Validation evidence: VAL-1, VAL-5, VAL-6, VAL-17, VAL-18, EVD-1, EVD-5, EVD-6, EVD-17, EVD-18.
- Blocking unknowns: Q-1.

Owns:
- Files/directories: `workflow-temporal/src/workflows/**` recipe workflow files and workflow-focused tests.
- Concepts: run status, step status, gate status, queue item ID, gate revision, terminal states, search attributes, history budget.
- Runtime responsibilities: deterministic orchestration only.

Does not own:
- Explicitly excluded behavior: agent SDK calls, registry fetches, worktree writes, triage packet generation.
- Responsibilities delegated elsewhere: activity execution to PKG-5, enforcement/worktree to PKG-6, triage to PKG-7.

Public interface:
- Exported types: workflow input, query state, Update payloads, typed `DecisionResult`, workflow result.
- Exported functions/classes/components: workflow entrypoint.
- Events/messages/contracts: queue item and decision Update contracts.
- CLI/API surface: Temporal workflow type and query/Update names.

Allowed dependencies:
- May import: `@temporalio/workflow`, pure workflow contract modules, activity proxies.
- May call: Temporal condition, Update, query, search-attribute, continue-as-new, and proxied activity APIs.
- May read configuration from: workflow input only.

Forbidden dependencies:
- Must not import: Claudex, Codex, Claude SDKs, Node filesystem, Git, registry fetchers, process env.
- Must not call: side-effectful APIs during replay.
- Must not know about: protected path implementation details beyond snapshot policy values.

State boundary:
- Owns state: workflow run, step, gate, and queue correlation state.
- Reads state: pinned snapshot in workflow input, Update events, and workflow search attributes.
- Mutates state: workflow-owned state only.
- Persistence responsibility: Temporal history, queryable state, compact search attributes, and continue-as-new handoff state when required.

Agent ownership boundary:
- Agent editable paths: recipe workflow files, workflow contracts, workflow tests.
- Agent read-only paths: activity runner, registry modules, existing `hello-claudex` compatibility path unless explicitly assigned.
- Required coordination before editing: query/Update payloads and queue item contract.

Validation command:
`npm run test:smoke` and focused workflow tests from `workflow-temporal`.

Promotion blockers:
Temporal-specific implementation is not reusable without abstracting workflow runtime assumptions.

### Package Boundary Card: PKG-5

Ladder level:
2.

Mission:
Own fake and real bounded step execution adapters and typed step input/output mapping.

Value / risk trace:
- Observable value enabled: recipe steps can execute fake and real skill-backed work from typed contracts.
- Risk retired: RISK-3.
- Validation evidence: VAL-1, VAL-8, EVD-1, EVD-8.
- Blocking unknowns: Q-1.

Owns:
- Files/directories: `workflow-temporal/src/activities/**`, step runner modules, adapter tests.
- Concepts: step request, step response, gate request, artifact refs, provider session hints.
- Runtime responsibilities: side-effectful step execution outside workflow code.

Does not own:
- Explicitly excluded behavior: deterministic workflow orchestration, registry validation, filesystem policy enforcement internals.
- Responsibilities delegated elsewhere: orchestration to PKG-4, enforcement to PKG-6.

Public interface:
- Exported types: step activity request/result and adapter contract.
- Exported functions/classes/components: fake runner and skill adapter registry.
- Events/messages/contracts: gate request output contract.
- CLI/API surface: none.

Allowed dependencies:
- May import: activity context, Claudex turn runner, approved skill adapters, execution context from PKG-6.
- May call: bounded step runner with cancellation and timeout.
- May read configuration from: explicit execution context.

Forbidden dependencies:
- Must not import: workflow-only modules from `@temporalio/workflow`.
- Must not call: approval Update APIs directly.
- Must not know about: Linear or GitHub write behavior except through declared step contracts.

State boundary:
- Owns state: per-step attempt result and artifact refs.
- Reads state: step snapshot, prior summaries, execution context.
- Mutates state: runner-owned artifacts only, or run worktree when profile permits.
- Persistence responsibility: step artifacts via PKG-6.

Agent ownership boundary:
- Agent editable paths: step activity, adapter, and runner modules plus focused tests.
- Agent read-only paths: recipe workflow contract and registry contract definitions.
- Required coordination before editing: step result and gate request shapes.

Validation command:
`npm test` from `workflow-temporal`.

Promotion blockers:
Adapter set is MVP-specific and tied to locally installed skills.

### Package Boundary Card: PKG-6

Ladder level:
2.

Mission:
Own runtime execution-profile enforcement, worktree allocation, read-only bundles, artifact persistence, and protected-path checks.

Value / risk trace:
- Observable value enabled: mutating work is contained and read-only work cannot mutate protected paths.
- Risk retired: RISK-1.
- Validation evidence: VAL-7, VAL-10, EVD-7, EVD-10.
- Blocking unknowns: none after MS-2 execution-profile contract approval.

Owns:
- Files/directories: worktree manager, artifact store, enforcement adapter, protected-path policy modules, negative tests.
- Concepts: allowed tools, skills, MCP servers, approval-Update authority, protected paths, run worktree, read-only bundle.
- Runtime responsibilities: fail closed before agent launch when policy is absent or incompatible.

Does not own:
- Explicitly excluded behavior: registry schema definitions, Temporal step cursor, triage grouping heuristics.
- Responsibilities delegated elsewhere: contracts to PKG-1, queue/triage to PKG-7.

Public interface:
- Exported types: `AgentExecutionContext`, worktree allocation record, artifact ref, enforcement result.
- Exported functions/classes/components: enforcement adapter, worktree manager, artifact writer.
- Events/messages/contracts: protected-path violation record.
- CLI/API surface: operator inspection helpers where needed.

Allowed dependencies:
- May import: Node filesystem, Git helpers, execution profile snapshot contracts, activity runtime code.
- May call: filesystem reads/writes under run-owned paths, Git diff/status inspections.
- May read configuration from: explicit execution profile and run metadata.

Forbidden dependencies:
- Must not import: workflow replay modules.
- Must not call: approval Update mutation or registry validation as a side effect.
- Must not know about: recipe step business semantics beyond policy fields.

State boundary:
- Owns state: run worktree allocation metadata, read-only bundle path, artifact files.
- Reads state: source repo status, registry repo status, execution profile snapshot.
- Mutates state: run worktree and artifact output only when profile permits.
- Persistence responsibility: run-scoped artifacts and worktree metadata.

Agent ownership boundary:
- Agent editable paths: enforcement, worktree, artifact modules and tests.
- Agent read-only paths: workflow queue contracts and registry schema files.
- Required coordination before editing: execution profile policy fields and artifact ref format.

Validation command:
`npm test` from `workflow-temporal`, including negative protected-path and one-run-one-worktree containment tests.

Promotion blockers:
Local filesystem and tool restrictions are application-specific until an external policy engine exists.

### Package Boundary Card: PKG-7

Ladder level:
2.

Mission:
Own queue listing through visibility or projection, triage packet generation, operator decision helpers, and runbook surfaces.

Value / risk trace:
- Observable value enabled: pending human approvals can be reviewed efficiently without implicit approval.
- Risk retired: RISK-1, RISK-2, RISK-9, Q-2.
- Validation evidence: VAL-9, VAL-18, EVD-9, EVD-18.
- Blocking unknowns: Q-2.

Owns:
- Files/directories: queue client helpers, triage packet modules, operator docs, triage tests.
- Concepts: review packets, grouping heuristic, operator decision target, queue item list filters.
- Runtime responsibilities: read queue state through approved list/query paths and emit derived artifacts only.

Does not own:
- Explicitly excluded behavior: changing workflow gate state, approving decisions, execution-profile schema.
- Responsibilities delegated elsewhere: queue state to PKG-4, enforcement to PKG-6.

Public interface:
- Exported types: queue item summary, triage packet, packet artifact ref.
- Exported functions/classes/components: queue list helper, triage packet builder.
- Events/messages/contracts: review packet artifact contract.
- CLI/API surface: operator commands or scripts for listing and packaging gates.

Allowed dependencies:
- May import: workflow client/query/list contracts, artifact writer with read-only output permissions.
- May call: Temporal workflow list/query APIs and local artifact writes for packets.
- May read configuration from: explicit triage options.

Forbidden dependencies:
- Must not import: step adapter internals or worktree mutators.
- Must not call: approval, rejection, or abandonment Update APIs from triage packet generation.
- Must not know about: provider session internals.

State boundary:
- Owns state: derived triage packet artifacts.
- Reads state: listable and queryable queue item summaries and artifact refs.
- Mutates state: packet artifacts only.
- Persistence responsibility: review packet artifact files; queue listing state remains owned by PKG-4 or a rebuildable projection.

Agent ownership boundary:
- Agent editable paths: queue client, triage packet, docs, and triage tests.
- Agent read-only paths: workflow queue state contract and enforcement policy.
- Required coordination before editing: queue item summary and artifact schemas.

Validation command:
`npm test` from `workflow-temporal` plus 50-item triage measurement.

Promotion blockers:
Grouping heuristics are operator-specific and need broader use before reuse.

Dependency direction rules:
- Allowed direction: registry contracts -> registry validation; workflow snapshot resolver -> registry contract types; workflow interpreter -> snapshot contracts and activity proxies; activity runner -> execution context; triage -> workflow list/query contracts.
- Prohibited imports: workflow replay modules importing Node/registry/provider SDKs; registry modules importing workflow runtime code; triage importing decision-Update mutators.
- Allowed cross-boundary communication: typed contract exports, workflow start payloads, activity request/results, artifact refs, query results.
- Disallowed cross-boundary communication: deep private imports, shared mutable module state, implicit filesystem paths, prompt-only contracts.

State boundary rules:
- Package-owned state: registry catalog state belongs to the registry; run/gate/queue state belongs to Temporal workflow state and visibility/projection metadata; worktree and artifacts belong to run-scoped runtime storage; triage packets are derived artifacts.
- Package-read state: activity runners may read snapshot and execution context; triage may read queue summaries; registry validation may read registry content.
- Package-mutated state: only PKG-4 mutates workflow state; only PKG-6 mutates run worktrees/artifacts; only PKG-2 mutates generated catalog metadata.
- Persistence ownership: Temporal history for workflow state, registry Git content for configuration, local run artifact directory for evidence and packets.

Reusable package candidates:

| Candidate | Current level | Reuse rationale | Required decoupling | Promotion trigger |
| --- | --- | --- | --- | --- |
| Execution-profile policy evaluator | 2 | Capability policy may apply across agent runners. | Remove local path assumptions, define public policy schema, add compatibility tests. | Second repository consumes it without copying workflow-specific code. |
| Recipe snapshot contract | 2 | Pinned recipe snapshots may be reusable in other orchestration runtimes. | Remove Temporal-specific start/result assumptions. | A non-Temporal runner consumes the same snapshot contract. |

Coupling tripwires:
- A workflow module needs to import registry fetch, Node filesystem, Claudex, Codex, Claude, or Git code.
- A real skill adapter requires editing registry schema fields after MS-2 approval.
- A read-only profile needs a mutable worktree path.
- Triage code needs approval-Update authority.
- Queue listing requires querying every workflow execution instead of Temporal Visibility or a rebuildable projection.
- Two agents need to edit the same contract file in parallel.
- Validation requires full live provider execution when a fake or contract test should suffice.

N/A rationale:
N/A does not apply. Code, contracts, schema, package, and multi-agent implementation surfaces are affected.

Section status:
Complete

## 8. Work Packages and Sequencing

Planning strategy:
Risk retirement with progressive value. WP-1 proves the critical path with fake steps. WP-2 and WP-3 harden source authority and workflow state. WP-4 blocks unsafe capability drift before real skills. WP-5 and WP-6 add real adapter and operator value. WP-7 performs activation, rollback, and handoff.

Critical path hypothesis:
A validated recipe snapshot can drive a deterministic Temporal workflow through fake regular activity execution, durable gate creation, stale decision Update rejection with typed results, matching approval resume, visibility-backed queue discovery, and terminal completion.

First proving slice:
WP-1.

Validation cadence:
Each work package adds focused automated validation and records `EVD-*` evidence. Milestones require manual verification before dependent work proceeds.

Deferred completeness:
Hosted UI, provider breadth beyond Codex, advanced heuristics, public reusable packages, and general `AGENTS.md` merge behavior remain out of scope.

| ID | Objective | Owner | Package boundary | Editable paths | Read-only paths | Inputs | Outputs | Dependencies | Observable value enabled | Risk retired | Milestone gate | Validation checkpoint | Completion criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WP-1 | Implement fake recipe-to-gate proving slice. | Workflow implementation agent | PKG-3, PKG-4, PKG-5 | Workflow-local fake fixture, resolver, workflow, contract, and test paths only; no `agent-config-registry` edits | Existing `hello-claudex` code, registry docs, `SRC-5` baseline | `SRC-1`, `SRC-2`, workflow-local fake recipe fixture | Fake recipes start at least two workflow runs, create at least three operator-reviewable queue items with workflow execution ID, queue item ID, gate revision, decision options, artifact refs, and compact context, reject stale, wrong-workflow, and wrong-queue-item decision Updates with typed `DecisionResult` values, resume only matching decisions, and complete | DEP-1, DEP-2, Q-1 decision | Proves critical recipe/gate/resume path before broad work | RISK-2 | MS-1 | VAL-1 | Automated fake vertical-slice tests and manual state inspection prove multi-run queue isolation, complete queue payloads, typed decision results, matching resume evidence, and post-WP-1 registry-boundary containment. |
| WP-2 | Harden BEL-910 registry workflow records and compatibility. | Registry implementation agent | PKG-1, PKG-2 | `agent-config-registry` contracts, schemas, validation/catalog tests | `workflow-temporal` design and resolver tests | WP-1 fixture, registry MS-1 baseline, BEL-910 decision | Validated workflow-unit, recipe, step definition, adapter-definition, loop transition, execution-profile records, derived compatibility graph diagnostics, and catalog metadata | DEP-3 | Registry rejects invalid or prompt-only recipes, explains direct/adapter-required/incompatible composition edges, rejects unbounded loops, and preserves pinned recipe compatibility across schema/profile evolution | RISK-3, RISK-4, RISK-10, RISK-11 | MS-2 | VAL-2, VAL-4, VAL-16, VAL-19, VAL-20 | Existing registry tests remain green; new workflow validation tests pass; compatibility graph fixtures classify direct, adapter-required, incompatible, and composite-workflow-as-step edges; loop fixtures accept bounded loops and reject unbounded loops; older pinned recipe snapshots remain executable after newer compatible schema or execution-profile records are published; reviewer approves compatibility. |
| WP-3 | Build durable Temporal recipe workflow and approval queue semantics. | Workflow implementation agent | PKG-3, PKG-4 | `workflow-temporal/src/workflows/**`, workflow tests | Registry validation modules, activity runner internals | WP-1 and WP-2 contracts | Production-shaped recipe workflow state, queue item query/list metadata, decision Updates with typed `DecisionResult`, retry policy, cancel/abandon semantics, replay/versioning gate, compact history policy | MS-1, Q-1, DEP-4; WP-2 registry contracts stabilized before workflow snapshot shape lock | Queue state becomes durable, inspectable, listable, and replay-safe | RISK-2, RISK-8, RISK-9 | MS-3 | VAL-3, VAL-5, VAL-6, VAL-13, VAL-14, VAL-15, VAL-17, VAL-18 | Workflow bundle tests cover pinned snapshot, retry policy, stale decisions, active heartbeat-backed cancellation propagation, abandon, provider-session loss, query/list state, compact artifacts, replay compatibility, and versioning decision evidence. |
| WP-4 | Implement execution-profile enforcement and worktree/artifact containment. | Capability-policy implementation agent | PKG-6 | Enforcement, worktree, artifact modules and tests | Workflow queue contracts, registry profile contracts | WP-2 execution-profile schema; WP-3 state | Fail-closed execution context, one-run-one-worktree allocation, read-only bundle, failed-worktree preservation, protected-path diff checks | MS-2 | Read-only and mutating execution profiles have enforceable runtime and worktree boundaries before real adapters run | RISK-1 | MS-3 | VAL-7, VAL-10 | Negative and containment tests prove protected writes, disallowed tools, disallowed skills, worker-agent/delegation denial, write-capable tool denial, no mutable worktree path for read-only profiles, approval-Update authority denial, one-run-one-worktree allocation, and failed-worktree preservation before WP-5 can proceed. |
| WP-5 | Adapt the five known happy-path skills and approved consensus review shape. | Step adapter implementation agent | PKG-5, PKG-6 | Step adapter modules, fixtures, adapter tests | Skill source docs, registry contracts, workflow state | Approved profile enforcement, Q-4 consensus-review shape decision, and Q-5 typed step contracts | Typed adapters for `linear-next-task`, `handoff-prompt`, `code-simplifier`, `organize-code-boundaries`, and `consensus-review`; one validated five-step happy-path recipe; fake fallbacks | MS-3, Q-4, Q-5 | Recipe can represent and execute the intended workflow path | RISK-3 | MS-4 | VAL-8 | Adapter tests show typed inputs/outputs; registry validation accepts one full five-step recipe ordered as `linear-next-task` -> `handoff-prompt` -> `code-simplifier` -> `organize-code-boundaries` -> `consensus-review` without hard-coded workflow-code step order; `consensus-review` follows the approved Q-4 shape under a read-only profile. |
| WP-6 | Implement queue triage and operator surfaces. | Operator tooling implementation agent | PKG-7 | Queue client, triage packet, docs, tests | Workflow queue contracts, enforcement modules | WP-3 queue state and WP-4 read-only profile | Queue listing through Temporal Visibility or a rebuildable projection, review packets, Q-2 storage decision from the 50-item measurement, runbook updates | MS-3 | Operator can triage pending decisions without implicit approval | RISK-1, RISK-2, RISK-9, Q-2 | MS-4 | VAL-9, VAL-18 | Triage packet generation is measured, read-only, resolves Q-2 before MS-4, and proves queue listing does not require querying every workflow execution. |
| WP-7 | Complete live opt-in smoke, rollback, Linear handoff, and final evidence. | Codex implementation agent and operator | PKG-3 through PKG-7 | Docs, evidence, smoke scripts, Linear updates | All implementation surfaces | WP-1 through WP-6 and prior EVD-10/EVD-17/EVD-18 containment proof | Final evidence bundle, rollback drill, live opt-in smoke result, replay/versioning evidence, queue listing evidence, handoff record | MS-4 | MVP is activation-ready or explicitly blocked with evidence | RISK-1, RISK-2, RISK-8, RISK-9 | MS-5 | VAL-11, VAL-12, VAL-17, VAL-18 | Final gate evidence exists, prior worktree-containment, replay, and history/visibility evidence is included, and Jason approves or rejects activation. |

Execution sequence:
1. Resolve entry gates and Q-1.
2. Execute WP-1 as the first proving slice. Any registry-adjacent work in WP-1 is workflow-local fixture-only, shall not edit `agent-config-registry`, and shall not override the BEL-910/D-5 package-kind, schema, catalog, compatibility graph, adapter, or loop strategy.
3. Execute WP-2 and WP-3 after MS-1; Q-3/BEL-910 is resolved by D-5, DEP-3 must still be resolved before WP-2 starts, and WP-2 must stabilize registry contracts before WP-3 locks workflow snapshot shapes.
4. Execute WP-4 before any real skill adapter receives write-capable tools.
5. Execute WP-5 after MS-3, Q-4, and Q-5; execute WP-6 after MS-3, using the VAL-9 and VAL-18 50-item measurements to resolve Q-2 before MS-4. They may proceed in parallel only if they do not share editable paths and use approved queue/profile contracts.
6. Execute WP-7 after MS-4.

Parallelization rules:
Parallel work is prohibited before WP-1 approval. After MS-2, registry validation work and workflow queue work may proceed in parallel only when contract files are not shared. After MS-3, skill adapters and triage may proceed in parallel if neither changes queue item or execution-profile public contracts.

Integration points:
Registry contract exports feed recipe snapshots. Recipe snapshots feed workflow start. Workflow queue contracts and visibility/projection records feed triage. Execution-profile snapshots feed activity runner enforcement. Artifacts from activity runner and triage feed manual milestone verification. Saved histories feed replay validation before command-sequence changes can merge.

Coordination triggers:
Changing any public recipe, step, execution profile, queue item, decision Update, artifact ref, or worktree allocation field requires pausing dependent packages, updating traceability, and recording a `DEV-*` if the change alters source-authority behavior.

Section status:
Complete

## 9. Milestone Gates and Manual Verification

Milestone verifier rule:
Jason Belmonti is the named human verifier for every milestone gate. Required reviewer roles remain mandatory review inputs through the `REV-*` gates and required evidence, but they are not substitutes for the named milestone verifier. Named reviewer assignments for `REV-2`, `REV-3`, `REV-4`, `REV-5`, and `REV-6` shall be recorded in EVD-0 before the first milestone that depends on each review gate can be approved.

| ID | Gate objective | Covered work | Due point | Human verifier | Prerequisites | Review gate | Required evidence | Approval decision | Failure path |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MS-1 | Approve fake multi-run queue proof. | OBJ-1, OBJ-3, OBJ-4, WP-1, PKG-3, PKG-4, PKG-5 | Before WP-2 or WP-3 expands implementation | Jason Belmonti | VAL-1 and EVD-1, including post-WP-1 confirmation that WP-1 changed no `agent-config-registry` contract, schema, validation, or catalog files | REV-1, REV-3 | EVD-1 with WP-1 registry-boundary evidence | Approve / Reject / Conditional approval | Stop; revise recipe/gate model before broad implementation. If WP-1 needs registry contract/schema changes, stop WP-1 and move that work behind WP-2/MS-2 or add an explicit `DEV-*` with `REV-2` approval. |
| MS-2 | Approve BEL-910 registry workflow contracts and composition model. | OBJ-2, OBJ-8, WP-2, PKG-1, PKG-2, SURF-1, SURF-2 | Before WP-4 and before real adapters reference execution profiles | Jason Belmonti | BEL-910 decision recorded; named `REV-2` reviewer assignment recorded in EVD-0; VAL-2, VAL-4, VAL-16, VAL-19, VAL-20, EVD-2, EVD-4, EVD-16, EVD-19, EVD-20 | REV-2 | EVD-2, EVD-4, EVD-16, EVD-19, EVD-20, BEL-910 decision record | Approve / Reject / Conditional approval | Stop registry integration; revise package-kind/schema strategy, static compiler boundary, compatibility graph posture, adapter semantics, loop semantics, or pinned snapshot compatibility. |
| MS-3 | Approve queue safety and capability containment. | OBJ-3, OBJ-4, OBJ-5, OBJ-6, WP-3, WP-4, PKG-4, PKG-6 | Before WP-5 real skill adapters or WP-6 triage | Jason Belmonti | Named `REV-3`, `REV-4`, and `REV-5` reviewer assignments recorded in EVD-0; VAL-3, VAL-5, VAL-6, VAL-7, VAL-10, VAL-13, VAL-14, VAL-15, VAL-17, EVD-3, EVD-5, EVD-6, EVD-7, EVD-10, EVD-13, EVD-14, EVD-15, EVD-17 | REV-3, REV-4, REV-5 | EVD-3, EVD-5, EVD-6, EVD-7, EVD-10, EVD-13, EVD-14, EVD-15, EVD-17 | Approve / Reject / Conditional approval | Disable recipe-backed starts; keep fake slice only until defects are resolved. |
| MS-4 | Approve adapter and triage usability. | OBJ-1, OBJ-5, OBJ-7, WP-5, WP-6, PKG-5, PKG-7 | Before live opt-in smoke or final readiness | Jason Belmonti | Q-4, Q-5, VAL-8, VAL-9, VAL-18, EVD-8, EVD-9, EVD-18 | REV-1A, REV-4, REV-5 | EVD-8, EVD-9, EVD-18, Q-4 decision record, Q-5 adapter contract decision record | Approve / Reject / Conditional approval | Remove real adapters from activation path; continue with fake recipe evidence only. |
| MS-5 | Approve MVP activation or rejection. | All objectives, WP-7, rollout, rollback, handoff | Before completion | Jason Belmonti | MS-4 approval; MS-3 approval including EVD-10 and EVD-17; VAL-11, VAL-12, VAL-18, EVD-11, EVD-12, EVD-18 | REV-6 | EVD-10, EVD-11, EVD-12, EVD-17, EVD-18, handoff record | Approve / Reject / Conditional approval | Mark Not ready; keep recipe-backed starts disabled and preserve evidence. |

Manual verification guide:

| Step ID | Milestone | Operator action | Expected result | Evidence artifact |
| --- | --- | --- | --- | --- |
| MV-1 | MS-1 | Start at least two fake recipe workflow runs and query or list state while blocked. | Queries or visibility/projection listing show pinned recipe snapshots, active steps, and at least three total open queue items across the runs. Each queue item includes workflow execution ID, queue item ID, gate revision, decision options, compact context, and fake artifact refs. | EVD-1 |
| MV-2 | MS-1 | Submit stale, wrong-workflow, and wrong-queue-item decision Updates. | Workflows return typed `DecisionResult` values of `stale`, `invalid`, `rejected`, or `no_effect` as appropriate and remain blocked on the current queue item and gate revision. | EVD-1 |
| MV-3 | MS-1 | Submit matching approval Updates for the intended queue items. | Only the targeted workflows return accepted `DecisionResult` values, resume, and reach terminal success through fake steps. | EVD-1 |
| MV-3A | MS-1 | Inspect the WP-1 diff and evidence bundle for registry-boundary containment. | EVD-1 shows no `agent-config-registry` contract, schema, validation, or catalog files changed. If WP-1 needed those edits, MS-1 fails until the work moves behind WP-2/MS-2 or records an approved `DEV-*` with `REV-2`. | EVD-1 |
| MV-4 | MS-2 | Inspect registry contract, validation, compatibility, and loop evidence. | Runtime `execution-profile` is distinct from sync `profile`; prompt-only and missing-reference recipes fail validation; compatibility graph diagnostics classify direct, adapter-required, incompatible, and composite-workflow-as-step edges; bounded loop fixtures pass; invalid loop declarations fail; older pinned recipe snapshots remain executable after newer compatible schema or execution-profile records are published. | EVD-2, EVD-4, EVD-16, EVD-19, EVD-20 |
| MV-5 | MS-3 | Run read-only protected-path and capability negative tests. | Protected write attempts fail before protected source, registry, or worktree paths change; disallowed skills, worker-agent/delegation, shell/editor/patch/filesystem-write exposure, mutation-capable MCP access, approval-Update authority, and mutable worktree path access are denied for read-only profiles. | EVD-7 |
| MV-5A | MS-3 | Start two mutating fake recipe runs that request worktrees and force one activity failure. | Each run receives exactly one distinct mutable worktree, no active worktree path is shared, and the failed run's worktree and artifacts are preserved for inspection. | EVD-10 |
| MV-6 | MS-3 | Run cancel/abandon/stale decision cases. | Queue item and workflow states transition as specified; later decisions are rejected. | EVD-5, EVD-6 |
| MV-6A | MS-3 | Simulate provider-session loss before a resume attempt. | The workflow resumes from workflow-owned objective, summaries, human input, and artifact refs; prior provider session refs are treated only as hints and a new session hint is recorded when available. | EVD-13 |
| MV-6B | MS-3 | Run retry-policy cases for mutating and non-mutating steps. | Non-mutating steps retry according to the pinned policy; mutating steps require idempotency keys and retry taxonomy before retry; nested provider-client retries are disabled or explicitly bounded. | EVD-14 |
| MV-6C | MS-3 | Cancel an active running step while its activity runner is in flight. | The activity runner has a heartbeat timeout, heartbeats progress, receives cancellation through heartbeat-backed delivery, aborts provider calls or child processes when supported, records cancelled state, stops subsequent step scheduling, and preserves protected-path diff artifacts. | EVD-15 |
| MV-6D | MS-3 | Replay saved fake recipe workflow histories against the current workflow bundle. | `Worker.runReplayHistory` succeeds for unchanged command sequences; any command-sequence change has a recorded patch, new workflow type, Worker Versioning, or termination/migration decision. | EVD-17 |
| MV-6E | MS-4 | Inspect queue listing and history-budget evidence for 50 pending queue items. | Queue items are discovered through Temporal Visibility search attributes or a rebuildable projection within the local SLA; workflow histories contain compact artifact refs, not large logs, diffs, transcripts, or review packets. | EVD-18 |
| MV-7A | MS-4 | Inspect or run the five happy-path recipe and step adapter evidence. | One validated recipe represents `linear-next-task` -> `handoff-prompt` -> `code-simplifier` -> `organize-code-boundaries` -> `consensus-review` without workflow-code step ordering; each adapter exposes typed input, output, artifact, and gate contracts; compatibility graph output explains required edges; `consensus-review` follows the Q-4 approved shape and is bound to a read-only execution profile. | EVD-8, EVD-9, EVD-19 |
| MV-7 | MS-4 | Generate a triage packet from seed queue items. | Packet references still-open queue item IDs and does not approve, reject, cancel, or abandon any gate. | EVD-9 |
| MV-8 | MS-5 | Execute rollback drill. | New recipe-backed starts can be disabled, existing `agent.helloClaudex` or approved equivalent remains runnable, failed worktrees/artifacts are preserved, and registry workflow records or execution-profile publication can be reverted or pinned to the last validated commit. | EVD-10, EVD-12 |
| MV-8A | MS-5 | Run the live opt-in smoke path under approved execution profiles. | The Codex-backed recipe path completes or reaches a documented gate without requesting broader permissions, and smoke logs identify the recipe snapshot and execution profile IDs. | EVD-12 |
| MV-8B | MS-5 | Review the final handoff and operator documentation. | Handoff includes start, query, list queue, decide, triage, cancel, abandon, rollback, disable-starts commands, Linear links, evidence paths, exact design/execution artifact paths, read-first instructions, checksum or validation evidence, and known limitations. | EVD-11, handoff record |

Section status:
Complete

## 10. Execution Controls and Drift Management

| ID | Trigger | Required action | Owner | Evidence |
| --- | --- | --- | --- | --- |
| CTRL-1 | Design source, Linear scope, task-definition contract, durable artifact protocol, or registry dependency changes before implementation. | Reconcile this spec and record a `DEV-*` if scope, sequencing, source authority, validation evidence, or review boundary changes. | Codex implementation agent | Updated spec section and EVD-0 note. |
| CTRL-2 | A workflow module needs a nondeterministic import. | Stop and move behavior into an activity, starter, or resolver outside workflow replay. | Workflow implementation agent | REV-3 import inspection. |
| CTRL-3 | A read-only profile requires a mutable worktree, shell write, patch, worker-agent, or approval-Update authority. | Stop and revise profile or package boundary before execution continues. | Capability-policy reviewer | VAL-7 negative evidence. |
| CTRL-4 | Two work packages require the same editable contract path. | Serialize those packages or create an explicit coordination subtask before editing. | Codex implementation agent | Work package update and reviewer note. |
| CTRL-5 | Registry workflow records conflict with existing `profile` package semantics. | Pause WP-2 and reconcile the implementation against BEL-910/D-5 with the registry reviewer and Jason; reopen BEL-910 or record an approved deviation if the selected strategy must change. | Registry implementation agent | EVD-4 decision record. |
| CTRL-6 | A milestone due point is reached without required evidence. | Stop dependent work until required evidence exists and the verifier approves or rejects. Conditional approval may only unblock explicitly named non-dependent work, must list missing `EVD-*` artifacts, and must keep any work depending on missing evidence stopped. | Assigned work package owner | Milestone approval record with conditional scope when applicable. |
| CTRL-7 | Live provider smoke requires broader permissions than the approved execution profile. | Abort live smoke and revise policy or mark activation Not ready. | Workflow operator | EVD-12 smoke log and REV-4 note. |
| CTRL-8 | A recipe-interpreter change adds, removes, reorders, or changes activity or child-workflow commands. | Stop merge until saved-history replay passes and a Temporal versioning decision is recorded. | Workflow implementation reviewer | EVD-17 replay/versioning record. |
| CTRL-9 | A long-running activity lacks heartbeat timeout, heartbeat progress, or provider abort propagation. | Block the activity from live execution until cancellation delivery and cleanup behavior are implemented and tested. | Workflow implementation reviewer | EVD-15 cancellation evidence. |
| CTRL-10 | Queue listing requires querying every workflow execution, or workflow state grows with large artifacts. | Stop WP-6 or release activation and move listing to Temporal Visibility or a rebuildable projection; move large data to artifact refs and define continue-as-new threshold. | Workflow implementation agent | EVD-18 history/visibility evidence. |
| CTRL-11 | WP-2 implementation deviates from BEL-910 D-5 for workflow-unit contracts, adapter semantics, derived compatibility graph output, loop semantics, pinned snapshot compatibility, or the no-microservice boundary. | Stop WP-2 and keep divergent registry workflow records unimplemented until BEL-910 is reopened or an approved deviation is recorded. | Registry contract reviewer | BEL-910 decision record, EVD-19, EVD-20. |

Deviation rules:
Any change to source authority, execution level, rollback posture, queue ownership, execution-profile policy, protected-path scope, package-kind semantics, Temporal Update semantics, replay/versioning posture, history-budget posture, or first proving slice shall be recorded as `DEV-*` with owner, approver, rationale, impact, and evidence before implementation continues.

Pause or escalation conditions:
Pause for any failed protected-path negative test, stale decision accepted as valid, decision validator mutating state or blocking, workflow replay nondeterminism, unreviewed registry schema incompatibility, activity cancellation not delivered through heartbeats, queue listing that requires scanning all workflows, large payloads entering workflow history, live provider auth leakage, missing milestone evidence, project-management work created outside the `task-definition` contract, or durable handoff/review packets that omit exact artifact paths and read-first instructions.

Section status:
Complete

## 11. Data, Schema, Config, and Contract Handling

| Change | Impact | Compatibility | Reversibility | Validation |
| --- | --- | --- | --- | --- |
| Add registry `workflow-recipe` records. | New non-installable package kind for ordered, branched, or guarded-loop workflow steps with exported composite workflow-unit contract. | Existing registry package kinds must continue to validate and catalog unchanged; older pinned recipe snapshots must remain executable after newer compatible schema or execution-profile records are published. | Reversible by removing records and disabling recipe-backed starts. | VAL-2, VAL-4, VAL-16 |
| Add registry `step-definition` records. | New non-installable package kind defining typed input, output, artifact, gate, side-effect, and execution-profile constraints for recipe steps. | Existing skills are referenced by adapters; skill package content does not need immediate rewrite. | Reversible by removing step records and adapters. | VAL-2, VAL-8 |
| Add embedded `workflowUnitContract` schema fields. | Defines the exported composition interface shared by primitive steps and composite workflows without a standalone source-record kind for MVP. | Existing package kinds must ignore or reject unsupported workflow-unit metadata by schema version; composite workflows can be reused as steps only through this public contract. | Reversible by removing fields and disabling recipe-backed starts. | VAL-19 |
| Add registry `adapter-definition` records. | New non-installable package kind defining explicit typed transforms between otherwise incompatible workflow-unit outputs and inputs. | Existing recipes remain valid; adapter-required edges are diagnostics until a recipe references an adapter. | Reversible by removing adapter records and recipes that depend on them. | VAL-19 |
| Add derived compatibility graph catalog metadata. | Explains direct, adapter-required, incompatible, and composite-workflow-as-step composition relationships. | Graph output is metadata-only and derived from source records, not source truth. | Reversible by regenerating catalog without graph metadata and disabling graph-dependent starts. | VAL-19 |
| Add guarded loop transition fields. | Adds typed loop predicates and loop state to `workflow-recipe` transitions. | Existing non-loop recipes remain valid; loop recipes fail validation without max iterations, terminal fallback, and history-budget behavior. | Reversible by disabling or removing loop recipes. | VAL-20 |
| Add runtime `execution-profile` records. | Adds capability policy for tools, skills, MCP, approval-Update authority, retry class, idempotency, and filesystem policy. | Must be distinct from current sync `profile` package kind and versioned so older pinned recipe snapshots keep their original execution-profile semantics. | Reversible by disabling recipe-backed starts and removing records. | VAL-4, VAL-7, VAL-14, VAL-16 |
| Add recipe snapshot to workflow start/state. | New recipe-backed workflow start contract and query state. | Existing `agent.helloClaudex` remains compatible unless deviation approved. | Reversible by disabling new workflow type. | VAL-3, VAL-5 |
| Add approval queue item and decision Update contracts. | Enables durable gate listing and resume by queue item plus gate revision, returning typed `DecisionResult` values for accepted, rejected, stale, invalid, and no-effect decisions. | Version queue item payloads and Update payload/result contracts to protect long-running workflows; validators remain read-only and non-blocking. | Reversible for new runs; existing blocked runs can be cancelled or abandoned. | VAL-6 |
| Add queue visibility search attributes or durable projection. | Enables cross-run queue listing without querying every workflow execution. | Visibility/projection fields must be derivable from workflow-owned state and artifact refs. | Reversible by rebuilding or dropping the projection and falling back to direct workflow inspection for individual runs. | VAL-9, VAL-18 |
| Add run worktree and artifact metadata. | Records run-owned mutable path, read-only bundle path, and artifact refs. | Existing turn artifact refs can be extended without removing old fields. | Reversible by preserving artifacts and disabling worktree allocation for new recipe runs. | VAL-7, VAL-10 |
| Add compact artifact-reference and history-budget contract. | Prevents logs, summaries, diffs, transcripts, and review packets from entering workflow history. | Workflow state stores identifiers and refs only; continue-as-new or projection rebuild behavior is required when thresholds are approached. | Reversible by preserving external artifacts and disabling new recipe-backed starts. | VAL-18 |
| Add triage packet artifact contract. | Stores derived review packets that reference queue items. | Queue item state remains authoritative; packets can be regenerated. | Reversible by deleting derived packets. | VAL-9, VAL-18 |

N/A rationale:
N/A does not apply. Data, schema, config, and contract changes are core to this execution.

Section status:
Complete

## Layer 3: Validation, Release, and Handoff

## 12. Validation and Evidence Plan

| ID | Method | Claim verified | Timing | Owner | Evidence artifact |
| --- | --- | --- | --- | --- | --- |
| VAL-0 | Review / PM inspection | WP-1 entry readiness is recorded: `SRC-1` approval, spec approval or conditional approval for WP-1, Q-1 decision, Linear execution-control issue or project with `task-definition` compliant work-item body, and named reviewer assignments for each `REV-*` gate before its dependent milestone can be approved. The work-item body shall include Objective, Context / Constraints, Source Authority, Task Scope, Materially Verifiable Success Criteria, Incremental Value Delivery, Review Boundary, Validation / Evidence, Execution Notes, and Follow-up / Non-blocking Work. Q-3 is resolved by BEL-910/D-5; DEP-3 is recorded before WP-2 starts. | Before WP-1 starts; update before WP-2 starts for DEP-3; update before any milestone whose dependent `REV-*` reviewer has not yet been named | Jason Belmonti and Codex implementation agent | EVD-0 |
| VAL-1 | Test / Manual | Fake recipe queue proof validates, starts at least two workflow runs, creates at least three operator-reviewable queue items with workflow execution ID, queue item ID, gate revision, decision options, artifact refs, and compact context, rejects stale, wrong-workflow, and wrong-queue-item decision Updates with typed `DecisionResult` values, accepts only matching decisions, completes targeted runs, and records post-WP-1 evidence that no `agent-config-registry` contract, schema, validation, or catalog files changed. | Pre-merge for WP-1 | Workflow implementation agent | EVD-1 |
| VAL-2 | Test / Review | Registry rejects missing step contracts, missing execution profiles, prompt-only outputs, unsupported schema versions, and invalid references. | Pre-merge for WP-2 | Registry implementation agent | EVD-2 |
| VAL-3 | Test | Running workflow uses pinned recipe snapshot and ignores later registry changes. | Pre-merge for WP-3 | Workflow implementation agent | EVD-3 |
| VAL-4 | Compatibility test | Existing `skill`, `agent-instructions`, and sync `profile` records remain valid; runtime `execution-profile` remains distinct. | Pre-merge for WP-2 | Registry contract reviewer | EVD-4 |
| VAL-5 | Test / Inspection | Workflow code remains deterministic, side effects stay inside regular activities, starters, or resolver code outside replay, and workflow imports exclude Node, provider SDK, Git, filesystem, and live registry fetchers. | Pre-merge for WP-3 | Workflow implementation reviewer | EVD-5 |
| VAL-6 | Test | Decision Updates validate workflow execution ID, queue item ID, gate revision, status, actor authority, and terminal/abandoned cases; validators are read-only/non-blocking, and semantic failures return typed `DecisionResult` values without mutating gate state. | Pre-merge for WP-3 | Workflow implementation agent | EVD-6 |
| VAL-7 | Negative test / Security review | Execution-profile enforcement blocks disallowed tools, disallowed skills, mutation-capable MCP access, worker-agent/delegation, shell/editor/patch/filesystem-write exposure, approval-Update authority, protected-path writes, and mutable worktree path access for read-only profiles. | Pre-merge for WP-4 | Capability-policy reviewer | EVD-7 |
| VAL-8 | Test | One validated recipe represents `linear-next-task` -> `handoff-prompt` -> `code-simplifier` -> `organize-code-boundaries` -> `consensus-review` without hard-coded workflow-code step order; the five happy-path step adapters use typed input/output/gate contracts, preserve artifact refs, and implement the Q-4 approved `consensus-review` step or subworkflow shape. | Pre-release | Step adapter implementation agent | EVD-8 |
| VAL-9 | Negative test / Measurement | Triage and consensus read-only profiles cannot mutate protected paths or queue state; active-run query and pending-queue list operations complete within 2 seconds for 50 active runs on the local development machine; 50 pending items package within 5 seconds. | Pre-release for WP-6 | Operator tooling agent | EVD-9 |
| VAL-10 | Test / Manual / Inspection | Worktree allocation is one run to one mutable worktree, failed worktrees are preserved, and cleanup is explicit. | Pre-merge for WP-4; required before WP-5 mutating adapters | Workflow operator and capability-policy reviewer | EVD-10 |
| VAL-11 | Manual / Review | Operator docs and Linear handoff show how to start, inspect, approve, reject, abandon, triage, and roll back recipe-backed runs. Handoff packets include exact artifact paths, read-first instructions for the design and execution specs, and current checksum or markdown validation evidence for durable planning artifacts. | Pre-completion | Codex implementation agent | EVD-11 |
| VAL-12 | Live opt-in smoke / Rollback drill | One Codex-backed opt-in recipe path runs under approved profiles, recipe-backed starts can be disabled while preserving legacy/equivalent behavior, and registry workflow records or execution-profile publication can be reverted or pinned to the last validated commit. | Pre-completion | Workflow operator | EVD-12 |
| VAL-13 | Test / Fault injection | Provider-session loss resumes from workflow-owned objective, summaries, human inputs, and artifact refs rather than provider-local session state; a new provider session hint is recorded when available. | Pre-merge for WP-3; repeat before live smoke if adapter behavior changes | Workflow implementation agent | EVD-13 |
| VAL-14 | Test | Non-mutating steps retry only according to pinned retry policy; mutating steps do not auto-retry unless idempotency keys, retryable/non-retryable error taxonomy, and disabled or bounded nested provider-client retries are declared. | Pre-merge for WP-3 | Workflow implementation agent | EVD-14 |
| VAL-15 | Test / Fault injection | Active step cancellation propagates through heartbeat-backed activity cancellation, the runner declares heartbeat timeout and heartbeats progress, provider calls or child processes abort where supported, cancelled status is recorded, subsequent scheduling stops, and protected-path diff artifacts are preserved. | Pre-merge for WP-3; required before MS-3 approval | Workflow implementation agent | EVD-15 |
| VAL-16 | Compatibility test | New registry schema records are versioned and older pinned recipe snapshots remain executable after newer compatible schema or execution-profile records are published. | Pre-merge for WP-2; repeat before MS-5 if registry compatibility behavior changes | Registry contract reviewer | EVD-16 |
| VAL-17 | Replay / Release gate | Saved fake and representative recipe workflow histories replay with `Worker.runReplayHistory`; any interpreter change that alters activity or child-workflow command sequence records a patching, new workflow type, Worker Versioning, or termination/migration decision before merge. | Pre-merge for WP-3; repeat before release when interpreter commands change | Workflow implementation reviewer | EVD-17 |
| VAL-18 | Measurement / Inspection | Queue listing uses Temporal Visibility search attributes or a rebuildable durable projection, 50 pending items meet the local listing SLA, workflow histories store compact artifact references instead of large artifacts, and projection rebuild or continue-as-new behavior is exercised. | Pre-release for WP-6; repeat before MS-5 | Workflow implementation agent and operator tooling agent | EVD-18 |
| VAL-19 | Test / Inspection | Registry validation or catalog generation emits compatibility diagnostics for one direct compatible edge, one adapter-required edge, one incompatible edge, and one composite-workflow-as-step edge, all derived from workflow-unit contracts and adapter records. | Pre-merge for WP-2; required before MS-2 | Registry implementation agent and registry contract reviewer | EVD-19 |
| VAL-20 | Test / Inspection | Registry validation accepts a bounded review/fix/review loop only when it declares typed guard predicates, loop ID, carried state, maximum iterations, terminal fallback, and history-budget behavior, and rejects loop recipes missing those fields. | Pre-merge for WP-2; replay implications checked again before MS-3 if interpreter loop commands change | Registry implementation agent and workflow implementation reviewer | EVD-20 |

Design-spec mapping:
Execution `VAL-19` / `EVD-19` maps to design `VAL-21`; execution `VAL-20` / `EVD-20` maps to design `VAL-22`.

Section status:
Complete

## 13. Review Plan

| ID | Reviewer | Review scope | Blocking? | Completion evidence |
| --- | --- | --- | --- | --- |
| REV-1 | Jason Belmonti | Source authority, Linear project/ticket structure, Q-1 decision, `task-definition` compliance, durable artifact protocol, and WP-1/MS-1 entry readiness. | Yes | VAL-0 approval and EVD-0. |
| REV-1A | Jason Belmonti | Q-4 `consensus-review` execution-shape decision and Q-5 typed adapter contract decision before WP-5 and MS-4 adapter approval. | Yes before WP-5 | Q-4 decision record and Q-5 adapter contract decision record before WP-5 starts. |
| REV-2 | Registry contract reviewer | BEL-910 decision, registry contracts, schema compatibility, validation, catalog, digest, workflow-unit contracts, adapter definitions, derived compatibility graph metadata, guarded loop fields, runtime `execution-profile` distinction, and older pinned recipe compatibility across compatible schema/profile evolution. | Yes | MS-2 approval with EVD-2, EVD-4, EVD-16, EVD-19, and EVD-20. |
| REV-3 | Workflow implementation reviewer | Temporal determinism, recipe snapshot use, workflow imports, queue state, decision Update handlers, heartbeat-backed cancellation propagation, retry/idempotency policy, provider-session fallback, replay compatibility, versioning decisions, and compiled bundle behavior. | Yes | MS-1/MS-3 approval with EVD-1, EVD-3, EVD-5, EVD-13, EVD-14, EVD-15, and EVD-17. |
| REV-4 | Independent capability-policy reviewer | Execution-profile enforcement, read-only containment, one-run-one-worktree containment, protected-path checks, tool/MCP/skill authority, worker-agent/delegation denial, mutable worktree denial for read-only profiles, and approval-Update authority. | Yes | MS-3/MS-4 approval with EVD-7, EVD-9, and EVD-10. |
| REV-5 | Workflow implementation reviewer | Queue item identity, stale decisions, typed `DecisionResult` behavior, retry behavior, active cancellation, abandon behavior, provider-session fallback, visibility/projection listing, history budget, recovery, and artifact references. | Yes | EVD-6, EVD-13, EVD-14, EVD-15, EVD-17, and EVD-18 approval. |
| REV-6 | Jason Belmonti and operator reviewer | Operator docs, live smoke evidence, rollback drill, replay/versioning evidence, queue listing/history-budget evidence, Linear handoff, and final readiness. | Yes | MS-5 approval with EVD-10 through EVD-12 plus EVD-17 and EVD-18. |

Approval conditions:
Implementation may merge only when all due milestone gates have evidence, all blocking reviews are approved, no E3 heightened-control finding remains open, typed Update semantics are verified, replay/versioning evidence is current for command-sequence changes, the existing `agent.helloClaudex` compatibility posture is documented, and rollback can be executed by the operator.

Section status:
Complete

## 14. Rollout, Migration, Rollback, and Recovery

| ID | Action | Timing | Owner | Abort trigger | Evidence |
| --- | --- | --- | --- | --- | --- |
| REL-1 | Land recipe-backed workflow as a new workflow path or feature-gated starter without removing `agent.helloClaudex`. | WP-3 | Workflow implementation agent | Compiled bundle failure, nondeterministic import, or missing replay/versioning evidence for command-sequence changes. | EVD-5, EVD-17 |
| REL-2 | Enable fake recipe runs for WP-1/MS-1 validation under fake-only guardrails; enable broader fake-run rollout only after MS-1 approval. | During WP-1 validation; broader rollout after MS-1 | Workflow operator | Stale decision accepted, queue query missing required fields, or fake-only guardrails bypassed. | EVD-1 |
| REL-3 | Enable real skill adapters only after MS-4 approval, including Q-4/Q-5 resolution and VAL-8 adapter evidence. | After WP-5 / MS-4 | Capability-policy reviewer | Read-only protected-path negative test, worktree containment proof, approved consensus-review shape, or typed adapter contract evidence fails. | EVD-7, EVD-8, EVD-10 |
| REL-4 | Enable queue triage only after MS-4 approval. | After WP-6 | Workflow operator | Triage mutates queue state, requires querying every workflow execution, stores large packets in workflow history, or fails the 50-item-within-5-seconds local measurement. | EVD-9, EVD-18 |
| REL-5 | Run live Codex opt-in smoke and rollback drill before completion. | WP-7 | Workflow operator | Live run requests broader permissions, rollback cannot disable new starts, replay/versioning evidence is stale, visibility/history-budget evidence is missing, or registry workflow records cannot be reverted or pinned to the last validated commit. | EVD-12, EVD-17, EVD-18 |

Rollback or containment plan:
Disable new recipe-backed starts, leave existing `agent.helloClaudex` or approved equivalent available, reject or abandon blocked recipe-backed runs through the workflow Update path, preserve run worktrees and artifacts for inspection, revert registry workflow records to the last validated commit, keep any rebuildable queue projection derivable from workflow-owned state, and remove triage/adapter activation from operator docs until the failed milestone is corrected.

Recovery limit:
Rollback is strong for new runs because recipe-backed starts are additive and can be disabled. Recovery is constrained for already-running workflows: they must be completed, cancelled, or abandoned through recorded workflow state rather than rewritten out of history.

Section status:
Complete

## 15. Observability and Operational Readiness

| ID | Signal | Purpose | Consumer | Response |
| --- | --- | --- | --- | --- |
| OBS-1 | Recipe run query state | Shows snapshot ID, current step, status, queue item, gate revision, worktree/bundle path, and profile IDs. | Operator | Inspect before approving, rejecting, cancelling, or abandoning. |
| OBS-2 | Queue item count by status and age | Detects blocked workflow backlog. | Operator / triage | Generate triage packet or abandon stale work. |
| OBS-2A | Queue visibility search attributes or projection records | Enables cross-run pending-gate discovery without scanning every workflow. | Operator / triage / recovery tooling | Rebuild projection or disable triage if listing evidence is stale or inconsistent. |
| OBS-3 | Step transition audit | Records pending, running, blocked, completed, failed, cancelled, abandoned. | Reviewer / operator | Investigate failed runs and stale gates. |
| OBS-4 | Execution-profile enforcement failure | Proves disallowed tools or writes were blocked. | Capability-policy reviewer | Block milestone approval until expected and documented. |
| OBS-5 | Worktree allocation record | Maps run to mutable path, base ref, branch, and cleanup state. | Operator | Inspect failed work or run cleanup after approval. |
| OBS-6 | Triage packet artifact | Records grouping heuristic, queue item IDs, and decision targets. | Jason Belmonti | Review pending gates without switching full context for each run. |
| OBS-7 | Rollback drill record | Shows recipe-backed starts disabled and legacy/equivalent path preserved. | Jason Belmonti | Approve final activation or reject readiness. |
| OBS-8 | Replay/versioning record | Shows saved-history replay status and selected Temporal versioning strategy for command-sequence changes. | Workflow implementation reviewer | Block merge or activation until current. |
| OBS-9 | History-budget record | Shows compact artifact refs, history size trend, and continue-as-new or projection rebuild behavior. | Workflow operator | Disable queue-heavy runs if thresholds are exceeded. |
| OBS-10 | Registry compatibility diagnostics | Explains direct, adapter-required, incompatible, and composite-workflow-as-step edges derived from workflow-unit contracts and adapter records. | Registry contract reviewer / operator | Block WP-2 or recipe publication until diagnostics match BEL-910 and VAL-19. |
| OBS-11 | Loop guard and iteration record | Records loop ID, current iteration, guard outcome, carried state ref, terminal fallback, and history-budget behavior. | Workflow implementation reviewer / operator | Stop loop-capable recipes if guard or iteration evidence is missing or exceeds policy. |

Operator actions:
Start fake or live opt-in recipe runs, query run state, list queue items through the approved visibility/projection path, submit approval/rejection/abandon Updates and cancellation requests, generate triage packets, inspect artifacts and worktrees, inspect registry compatibility diagnostics and loop iteration records, replay saved histories after interpreter changes, inspect history-budget evidence, disable recipe-backed starts, and revert registry workflow records to a validated commit.

Monitoring window:
For the MVP, monitor manually through the first live opt-in run and the next three local recipe-backed runs after activation. Any stale decision acceptance, protected-path mutation, missed activity cancellation, replay nondeterminism, queue-listing inconsistency, history-budget breach, or missing rollback path immediately suspends recipe-backed starts.

N/A rationale:
N/A does not apply because the change affects live local workflow operation.

Section status:
Complete

## 16. Risks, Questions, Deviations, and Waivers

Risks:

| ID | Risk | Impact | Likelihood | Owner | Mitigation | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| RISK-1 | Execution-profile enforcement incomplete. | High | Medium | Capability-policy reviewer | Fail closed, deny-by-default profiles, read-only bundles, one-run-one-worktree checks, protected-path diff checks, independent review. | VAL-7, VAL-9, VAL-10 |
| RISK-2 | Queue item or gate revision correlation incorrect. | High | Medium | Workflow implementation agent | Include workflow execution ID, queue item ID, gate revision, and status checks in every decision. | VAL-1, VAL-6 |
| RISK-3 | Recipes become prompt-shaped blobs. | Medium | Medium | Registry implementation agent | Require typed step definitions, outputs, artifacts, and gate contracts; reject prompt-only records. | VAL-2, VAL-4, VAL-8 |
| RISK-4 | Registry baseline conflicts with workflow-specific records. | Medium | Medium | Registry contract reviewer | Resolve DEP-3 registry readiness, preserve existing package-kind behavior, add compatibility tests. | VAL-2, VAL-4 |
| RISK-5 | Cross-repo implementation creates overlapping editable paths. | Medium | Medium | Codex implementation agent | Assign package ownership, serialize public contract edits, and trigger coordination on shared paths. | CTRL-4, REV-1 |
| RISK-6 | Live provider smoke expands permissions beyond MVP policy. | High | Low | Workflow operator | Keep live path opt-in, abort on permission drift, require REV-4 before activation. | VAL-7, VAL-12 |
| RISK-7 | Retried mutating activities duplicate side effects. | High | Medium | Workflow implementation reviewer | Require idempotency keys, retryable/non-retryable taxonomy, disabled or bounded nested provider retries, and non-retryable classification for validation/auth/policy failures. | VAL-14 |
| RISK-8 | Recipe-interpreter changes break replay for in-flight workflows. | High | Medium | Workflow implementation reviewer | Require saved-history replay and a patching, new workflow type, Worker Versioning, or termination/migration decision for command-sequence changes. | VAL-17 |
| RISK-9 | Queue listing or artifact handling exceeds visibility, payload, or history limits. | Medium | Medium | Workflow implementation agent | Use Temporal Visibility search attributes or a rebuildable projection, keep large artifacts outside history, and define continue-as-new thresholds. | VAL-18 |
| RISK-10 | Compatibility graph complexity turns registry into a runtime platform. | Medium | Medium | Registry contract reviewer | Keep registry as static compiler, derive metadata-only graph output, and defer any service until explicit service trigger conditions exist. | VAL-19, REV-2 |
| RISK-11 | Looping recipes run indefinitely or hide unresolved review/fix findings. | High | Medium | Workflow implementation reviewer | Require typed guards, maximum iterations, terminal fallback, loop state, compact artifacts, and history-budget behavior. | VAL-20, VAL-17 |

Open questions:

Question mapping note:
`SRC-1` Q-1 maps to this spec's Q-2 queue storage decision. `SRC-1` Q-2 maps to this spec's resolved Q-3/BEL-910 registry workflow record strategy. `SRC-1` D-1 constrains this spec's Q-4 consensus-review execution-shape decision. This spec's Q-1 and Q-5 are execution-specific gates added during planning.

| ID | Question | Owner | Due date | Blocking? | Resolution path |
| --- | --- | --- | --- | --- | --- |
| Q-1 | Should existing durable human-loop MVP work land before this work, or should this execution absorb and supersede that scope? | Jason Belmonti | Before implementation starts | Yes | Record decision in EVD-0 and update project-management scope. |
| Q-2 | Should queue listing use Temporal Visibility search attributes only, or a derived local projection? | Workflow implementation agent | Before MS-4 | No | Resolve during WP-6 by running the VAL-9 and VAL-18 50-item seed measurements and choosing the least stateful option that meets triage needs. |
| Q-4 | Should the first `consensus-review` adapter use the design-approved child-workflow fanout shape or the allowed single bounded step activity shape? | Jason Belmonti | Before WP-5 starts | Yes for WP-5 | Record the design-owner decision and validate the selected shape in VAL-8 before adapting the real skill. |
| Q-5 | What exact typed output contract is required for each of the five happy-path skills? | Step adapter implementation agent drafts; Jason Belmonti approves with workflow and registry reviewer input | Before WP-5 starts | Yes for WP-5 | Draft an adapter contract table, record a Q-5 adapter contract decision artifact, review it against workflow and registry contracts, and validate with fake fixtures before real skills. |

Approved deviations:

| ID | Deviation | Owner | Approver | Rationale | Impact | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| None | No deviations approved. | N/A | N/A | N/A | N/A | N/A |

Approved waivers:

| ID | Waived rule or finding | Approver | Rationale | Boundary or expiry | Compensating control | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| None | No waivers approved. | N/A | N/A | N/A | N/A | N/A |

Section status:
Complete

## 17. Execution Traceability Matrix

| Source, objective, or evidence-led claim | Change surfaces | Package boundaries | Work packages | Milestones | Controls | Validation | Review | Release or ops | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SRC-1 / OBJ-1 / Critical path | SURF-1, SURF-3, SURF-4 | PKG-1, PKG-3, PKG-4, PKG-5 | WP-1, WP-2, WP-3, WP-5 | MS-1, MS-2, MS-4 | CTRL-1, CTRL-2, CTRL-5, CTRL-8 | VAL-1, VAL-2, VAL-3, VAL-8, VAL-17, VAL-18 | REV-1, REV-2, REV-3 | REL-1, REL-2, OBS-1, OBS-8 | EVD-1, EVD-2, EVD-3, EVD-8, EVD-17, EVD-18 |
| SRC-5 / OBJ-2 / Typed registry contracts | SURF-1, SURF-2 | PKG-1, PKG-2 | WP-2 | MS-2 | CTRL-5 | VAL-2, VAL-4, VAL-16 | REV-2 | REL-2 | EVD-2, EVD-4, EVD-16 |
| SRC-1 / OBJ-1 / OBJ-2 / Registry evolution compatibility | SURF-1, SURF-2, SURF-3 | PKG-1, PKG-2, PKG-3 | WP-2, WP-3 | MS-2, MS-3 | CTRL-5, CTRL-6 | VAL-3, VAL-16 | REV-2, REV-3 | REL-1, REL-2 | EVD-3, EVD-16 |
| OBJ-3 / Durable queue items | SURF-3, SURF-6 | PKG-4 | WP-1, WP-3 | MS-1, MS-3 | CTRL-6, CTRL-10 | VAL-1, VAL-6, VAL-18 | REV-5 | OBS-1, OBS-2, OBS-2A | EVD-1, EVD-6, EVD-18 |
| OBJ-4 / Safe resume | SURF-3 | PKG-4 | WP-1, WP-3 | MS-1, MS-3 | CTRL-6 | VAL-1, VAL-6, VAL-13 | REV-3, REV-5 | OBS-3 | EVD-1, EVD-6, EVD-13 |
| OBJ-5 / Execution-profile enforcement | SURF-4, SURF-5 | PKG-6 | WP-4, WP-5 | MS-3, MS-4 | CTRL-3, CTRL-7 | VAL-7, VAL-9, VAL-10 | REV-4 | REL-3, OBS-4 | EVD-7, EVD-9, EVD-10 |
| OBJ-6 / Worktree containment | SURF-5 | PKG-6 | WP-4, WP-7 | MS-3, MS-5 | CTRL-3 | VAL-7, VAL-10, VAL-12 | REV-4, REV-6 | REL-3, REL-5, OBS-5 | EVD-7, EVD-10, EVD-12 |
| OBJ-7 / Triage packets | SURF-6, SURF-8 | PKG-7 | WP-6 | MS-4 | CTRL-3, CTRL-6, CTRL-10 | VAL-9, VAL-18 | REV-4, REV-5 | REL-4, OBS-2A, OBS-6, OBS-9 | EVD-9, EVD-18 |
| OBJ-8 / Registry composition and bounded loops | SURF-1, SURF-2, SURF-7 | PKG-1, PKG-2 | WP-2 | MS-2 | CTRL-5, CTRL-11 | VAL-19, VAL-20 | REV-2 | OBS-10, OBS-11 | EVD-19, EVD-20 |
| SRC-4 / Temporal SDK controls | SURF-3, SURF-4, SURF-6 | PKG-4, PKG-5, PKG-7 | WP-3, WP-5, WP-6, WP-7 | MS-3, MS-4, MS-5 | CTRL-2, CTRL-8, CTRL-9, CTRL-10 | VAL-5, VAL-6, VAL-14, VAL-15, VAL-17, VAL-18 | REV-3, REV-5, REV-6 | REL-1, REL-4, OBS-8, OBS-9 | EVD-5, EVD-6, EVD-14, EVD-15, EVD-17, EVD-18 |
| SRC-6 / PM readiness | SURF-9 | N/A with PM rationale | WP-7 | Entry gate, MS-5 | CTRL-1, CTRL-6 | VAL-0, VAL-11 | REV-1, REV-6 | OBS-7 | EVD-0, EVD-11 |
| SRC-2 / SRC-3 / NG-2 / Provider-session non-authority | SURF-3, SURF-4, SURF-10 | PKG-3, PKG-4, PKG-5 | WP-1, WP-3, WP-5 | MS-1, MS-3, MS-4 | CTRL-2, CTRL-6 | VAL-5, VAL-8, VAL-13 | REV-3, REV-5 | REL-1, OBS-1, OBS-3 | EVD-5, EVD-8, EVD-13 |
| SRC-1 / SRC-3 / OBJ-4 / Recovery semantics | SURF-3, SURF-4, SURF-5 | PKG-3, PKG-4, PKG-6 | WP-3, WP-4 | MS-3 | CTRL-2, CTRL-3, CTRL-6, CTRL-8, CTRL-9 | VAL-14, VAL-15, VAL-17 | REV-3, REV-5 | OBS-3, OBS-4, OBS-8 | EVD-14, EVD-15, EVD-17 |
| SRC-7 / Requested execution-spec artifact | SURF-8, SURF-9 | N/A with docs and PM rationale | WP-7 | Entry gate, MS-5 | CTRL-1, CTRL-6 | VAL-0, VAL-11 | REV-1, REV-6 | OBS-7 | EVD-0, EVD-11 |
| SURF-7 / Validation test surface | SURF-7 | PKG-1, PKG-2, PKG-3, PKG-4, PKG-5, PKG-6, PKG-7 | WP-1, WP-2, WP-3, WP-4, WP-5, WP-6, WP-7 | Entry gate, MS-1, MS-2, MS-3, MS-4, MS-5 | CTRL-1, CTRL-6, CTRL-8, CTRL-9, CTRL-10, CTRL-11 | VAL-0, VAL-1, VAL-2, VAL-3, VAL-4, VAL-5, VAL-6, VAL-7, VAL-8, VAL-9, VAL-10, VAL-11, VAL-12, VAL-13, VAL-14, VAL-15, VAL-16, VAL-17, VAL-18, VAL-19, VAL-20 | REV-1, REV-1A, REV-2, REV-3, REV-4, REV-5, REV-6 | REL-2, REL-3, REL-4, REL-5, OBS-7, OBS-8, OBS-9, OBS-10, OBS-11 | EVD-0, EVD-1, EVD-2, EVD-3, EVD-4, EVD-5, EVD-6, EVD-7, EVD-8, EVD-9, EVD-10, EVD-11, EVD-12, EVD-13, EVD-14, EVD-15, EVD-16, EVD-17, EVD-18, EVD-19, EVD-20 |
| RISK-1 | SURF-4, SURF-5, SURF-6 | PKG-6, PKG-7 | WP-4, WP-6 | MS-3, MS-4 | CTRL-3, CTRL-7 | VAL-7, VAL-9, VAL-10 | REV-4 | REL-3, REL-4 | EVD-7, EVD-9, EVD-10 |
| RISK-2 | SURF-3, SURF-6 | PKG-4, PKG-7 | WP-1, WP-3, WP-6 | MS-1, MS-3 | CTRL-6 | VAL-1, VAL-6, VAL-13, VAL-15 | REV-5 | OBS-1, OBS-3 | EVD-1, EVD-6, EVD-13, EVD-15 |
| RISK-3 | SURF-1, SURF-2, SURF-4 | PKG-1, PKG-2, PKG-5 | WP-2, WP-5 | MS-2, MS-4 | CTRL-5 | VAL-2, VAL-4, VAL-8 | REV-2, REV-4 | REL-2, REL-3 | EVD-2, EVD-4, EVD-8 |
| RISK-4 | SURF-1, SURF-2, SURF-9 | PKG-1, PKG-2 | WP-2 | MS-2 | CTRL-1, CTRL-5 | VAL-2, VAL-4, VAL-16 | REV-2 | REL-2 | EVD-2, EVD-4, EVD-16 |
| RISK-5 | SURF-1, SURF-2, SURF-3, SURF-4, SURF-5, SURF-6, SURF-7, SURF-8, SURF-9 | PKG-1, PKG-2, PKG-3, PKG-4, PKG-5, PKG-6, PKG-7 | WP-1, WP-2, WP-3, WP-4, WP-5, WP-6, WP-7 | Entry gate, MS-1, MS-2, MS-3, MS-4, MS-5 | CTRL-4, CTRL-6 | VAL-0, VAL-11 | REV-1, REV-2, REV-3, REV-4, REV-5, REV-6 | OBS-7 | EVD-0, EVD-11 |
| RISK-6 | SURF-4, SURF-5 | PKG-6 | WP-4, WP-7 | MS-3, MS-5 | CTRL-7 | VAL-7, VAL-12 | REV-4, REV-6 | REL-5, OBS-4, OBS-7 | EVD-7, EVD-12 |
| RISK-7 | SURF-4, SURF-5 | PKG-5, PKG-6 | WP-3, WP-4 | MS-3 | CTRL-9 | VAL-14, VAL-15 | REV-3, REV-5 | OBS-3, OBS-4 | EVD-14, EVD-15 |
| RISK-8 | SURF-3 | PKG-4 | WP-3, WP-7 | MS-3, MS-5 | CTRL-8 | VAL-17 | REV-3, REV-6 | REL-1, REL-5, OBS-8 | EVD-17 |
| RISK-9 | SURF-3, SURF-6, SURF-8 | PKG-4, PKG-7 | WP-3, WP-6, WP-7 | MS-4, MS-5 | CTRL-10 | VAL-18 | REV-5, REV-6 | REL-4, REL-5, OBS-2A, OBS-9 | EVD-18 |
| RISK-10 | SURF-1, SURF-2 | PKG-1, PKG-2 | WP-2 | MS-2 | CTRL-5, CTRL-11 | VAL-19 | REV-2 | OBS-10 | EVD-19 |
| RISK-11 | SURF-1, SURF-2, SURF-3 | PKG-1, PKG-2, PKG-4 | WP-2, WP-3 | MS-2, MS-3 | CTRL-8, CTRL-11 | VAL-20, VAL-17 | REV-2, REV-3 | OBS-9, OBS-11 | EVD-20, EVD-17 |
| Q-1 / Entry sequencing | SURF-9, SURF-10 | PKG-4 | WP-1, WP-3 | Entry gate, MS-1 | CTRL-1 | VAL-0 | REV-1 | REL-1 | EVD-0 |
| Q-2 / Queue storage and index decision | SURF-6, SURF-8 | PKG-7 | WP-6 | MS-4 | CTRL-1, CTRL-6, CTRL-10 | VAL-9, VAL-18 | REV-5 | OBS-2, OBS-2A, OBS-6 | EVD-9, EVD-18 |
| Resolved Q-3 / BEL-910 registry record strategy | SURF-1, SURF-2, SURF-7, SURF-9 | PKG-1, PKG-2 | WP-2 | MS-2 | CTRL-5, CTRL-11 | VAL-2, VAL-4, VAL-16, VAL-19, VAL-20 | REV-2 | OBS-10, OBS-11 | BEL-910 approval of D-5, EVD-2, EVD-4, EVD-16, EVD-19, EVD-20 |
| Q-4 / Consensus-review execution shape | SURF-3, SURF-4, SURF-6, SURF-8 | PKG-4, PKG-5, PKG-6 | WP-5 | MS-4 | CTRL-1, CTRL-3 | VAL-8 | REV-1A, REV-4 | REL-3, OBS-3 | Q-4 decision record, EVD-8 |
| Q-5 / Skill adapter output contracts | SURF-4, SURF-6, SURF-8 | PKG-5, PKG-6 | WP-5 | MS-4 | CTRL-1, CTRL-3 | VAL-8 | REV-1A, REV-4 | REL-3, OBS-3 | Q-5 adapter contract decision record, EVD-8 |

Section status:
Complete

## 18. Final Execution Gate

Entry gate:
Not satisfied. Required before WP-1 starts: Jason approves `SRC-1`; Jason approves this execution spec or conditionally approves it for WP-1; Q-1 is resolved; a Linear execution-control issue or project exists with a `task-definition` compliant work-item body and traceability; and an independent capability-policy reviewer is assigned. Q-3 is resolved by BEL-910/D-5; DEP-3 is still required before WP-2 starts, not before the fake proving slice.

Milestone approval gate:
MS-1 through MS-5 are fully specified with due points, verifiers, manual verification steps, required evidence, review gates, approval decisions, and failure paths. No milestone may be treated as approved until its named verifier records approval evidence.

Completion gate:
Completion requires all `WP-*` rows closed, all `VAL-*` checks passed or explicitly blocked, all `EVD-*` artifacts present, all blocking `REV-*` approvals recorded, no open E3 heightened-control findings, all blocking `Q-*` rows resolved, and current replay/versioning plus history/visibility evidence recorded.

Release gate:
Activation requires MS-5 approval, successful rollback drill including registry revert or pin proof, live opt-in smoke evidence, current replay/versioning evidence, current queue listing/history-budget evidence, recipe-backed starts disabled-by-default or otherwise operator-controlled, and documented preservation of `agent.helloClaudex` or an approved equivalent. If live smoke is explicitly deferred, activation is limited to the non-live fake recipe path and live provider-backed recipe starts must remain disabled until VAL-12 evidence is approved.

Handoff record:
The final handoff shall include the exact paths to `docs/composable-agent-workflow-design.md` and `docs/composable-agent-workflow-execution.md`, an instruction that any continuation agent must read those artifacts from disk before relying on the handoff, current checksum or markdown validation evidence for each durable planning artifact, the approved recipe and execution-profile IDs, workflow type and Update/query/list names, Linear issue/project links, evidence bundle path, replay/versioning decision, queue visibility/projection decision, history-budget threshold, rollback procedure, known limitations, open deferred work, and operator commands for start, query, list queue, decide, triage, cancel, abandon, and disable recipe-backed starts.

Final readiness state:
Not ready

Section status:
Complete
