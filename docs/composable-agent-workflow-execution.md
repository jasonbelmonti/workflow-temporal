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
| Last updated | 2026-04-29 |
| Related source docs | `docs/composable-agent-workflow-design.md`; `docs/hello-claudex-mvp.md`; `agent-config-registry/docs/zero-dollar-agent-config-registry-design.md`; `agent-config-registry/docs/zero-dollar-agent-config-registry-execution.md` |
| Related tickets | Linear `workflow-temporal` project; BEL-768, BEL-769, BEL-770, BEL-771, BEL-772, BEL-773, BEL-774, BEL-854, BEL-892; Linear `Zero-Dollar Agent Config Registry MVP` project; BEL-855, BEL-858, BEL-859, BEL-901, BEL-902, BEL-903 |

## 0. Execution Summary

Decision requested:
Approve with heightened controls.

Approved outcome:
Execute the composable agent workflow control-plane design from `SRC-1` by adding a registry-backed recipe and execution-profile model, a Temporal recipe interpreter, durable approval queue items, safe gate resume semantics, execution-profile enforcement, read-only triage/review behavior, run worktree containment, and operator evidence needed to activate the MVP.

Execution approach:
Use a risk-retirement and progressive-value sequence. First prove a fake recipe can validate, start, block on a durable queue item, and resume by queue item plus gate revision. Then harden registry contracts, Temporal state, execution-profile enforcement, worktree containment, skill adapters, queue triage, and live opt-in smoke evidence. Every implementation package shall have scoped validation, negative tests for the unsafe paths, and manual milestone approval before promotion.

Entry condition:
Execution shall not start until `SRC-1` is approved by Jason Belmonti, a Linear execution-control issue or project exists for this implementation, the registry dependency state is confirmed, and an independent capability-policy reviewer is assigned.

Top risks or unknowns:
- RISK-1: Execution-profile enforcement could be incomplete, allowing read-only review or triage steps to mutate protected paths or access disallowed tools.
- RISK-2: Queue item identity, gate revision, or workflow-run correlation could be wrong, causing an approval to resume the wrong work.
- RISK-3: Registry recipes could degrade into prompt-shaped blobs instead of typed, validated execution contracts.

Section status:
Complete.

## Layer 1: Execution Basis

## 1. Source Authority and Scope

| ID | Source | Authority | Execution implication |
| --- | --- | --- | --- |
| SRC-1 | `docs/composable-agent-workflow-design.md` | Current R3 design authority, status In Review, decision requested `Approve with heightened controls`. | Defines the intended control plane: versioned recipes, pinned snapshots, execution profiles, durable queue items, read-only triage, worktree containment, and heightened controls. Implementation cannot start until approval is recorded. |
| SRC-2 | Existing `workflow-temporal` implementation in `src/workflows/**`, `src/activities/**`, and `src/claudex-turn/**` | Current executable baseline. | Shows the bounded Claudex turn boundary, hard-coded `agent.helloClaudex` workflow, query/signal names, cancellation behavior, session hints, and current absence of recipe, queue, worktree, or profile enforcement abstractions. |
| SRC-3 | `docs/hello-claudex-mvp.md` | MVP baseline design for Temporal-owned durable state and bounded agent turns. | Preserves constraints that workflow code remains deterministic, human input occurs between bounded turns, provider session refs are hints, and artifact refs are queryable workflow state. |
| SRC-4 | Linear `workflow-temporal` project state queried on 2026-04-29 | Current project-management baseline. | Phases 1 and 2 are complete. Phase 3 human loop is 0 percent with BEL-772 open. Phase 4 is partially complete with BEL-773 and BEL-774 open and BEL-892 done. No dedicated composable-control-plane project or issue was found. |
| SRC-5 | `agent-config-registry` design, execution spec, and checked-out implementation | Registry source and dependency baseline. | Registry currently defines `skill`, `agent-instructions`, and sync `profile` package kinds, target compatibility, catalog records, digest contracts, and active validation work. The composable workflow effort must add workflow-specific records without confusing runtime `execution-profile` records with existing sync profiles. |
| SRC-6 | Linear `Zero-Dollar Agent Config Registry MVP` project state queried on 2026-04-29 | Current registry project-management baseline. | Registry project is In Progress. MS-0 is complete, MS-1 is partially complete, BEL-858 is done, and BEL-859/BEL-901 are in progress. Later accepted-head, install/sync, CLI, and final evidence work remains open. |
| SRC-7 | User request on 2026-04-29 | Direct source request. | Draft this execution spec using the `execution-spec-template` skill after examining design, Linear state, implementation, and the sibling registry repo. |

In scope:
Implement the composable workflow MVP across `workflow-temporal` and `agent-config-registry`: workflow recipe records, step definitions, runtime `execution-profile` records, recipe validation, pinned recipe snapshots, a new recipe-backed Temporal workflow, fake and real step activity runners, approval queue items, gate decision signals, stale-decision rejection, worktree allocation, artifact references, execution-profile enforcement, read-only triage/review packets, five known happy-path skill adapters, tests, docs, evidence, and rollback controls.

Out of scope:
This execution will not build a hosted multi-user workflow product, replace Temporal, make provider-native sessions authoritative, create a general `AGENTS.md` merge engine, implement a public marketplace protocol, move registry runtime state into Git, or require an always-on paid server for the MVP.

Definition of done:
All `WP-*` work packages are complete; all `MS-*` gates have approval evidence; all `VAL-*` checks have `EVD-*` artifacts; read-only and stale-resume negative tests pass; a fake recipe smoke test and one opt-in live Codex-backed smoke path are documented; recipe-backed starts can be disabled or rolled back; and the existing `agent.helloClaudex` path remains runnable or has an approved replacement decision.

Re-decision boundaries:
Execution shall not re-decide Temporal as the durable state owner, provider session refs as non-authoritative hints, registry as the versioned configuration source, read-only review/triage containment, queue item plus gate revision resume semantics, or the no-paid-server MVP posture. Any change to those decisions requires a `DEV-*` deviation and Jason Belmonti approval before related implementation proceeds.

Section status:
Complete.

## 2. Objectives and Non-Objectives

| ID | Statement | Completion horizon | Evidence |
| --- | --- | --- | --- |
| OBJ-1 | A pinned registry recipe shall start a Temporal workflow that executes typed steps without hard-coded workflow-code step order. | Before MVP activation. | EVD-1, EVD-3, EVD-5 |
| OBJ-2 | Registry content shall validate workflow recipes, step definitions, and runtime execution profiles as typed records distinct from existing sync `profile` records. | Before real skill adapters are enabled. | EVD-2, EVD-4 |
| OBJ-3 | Blocking step outcomes shall create durable approval queue items with workflow execution ID, queue item ID, gate revision, decision options, artifacts, and compact context. | Before human-gated recipe runs are accepted. | EVD-1, EVD-6 |
| OBJ-4 | Decision signals shall resume only the matching workflow execution, queue item, and gate revision, while stale, cancelled, or abandoned gates remain blocked or terminal. | Before any live provider-backed recipe run. | EVD-6, EVD-8 |
| OBJ-5 | Execution profiles shall deny disallowed tools, skills, MCP servers, approval authority, and protected-path writes before agent execution. | Before triage or consensus-review automation is enabled. | EVD-7, EVD-9 |
| OBJ-6 | Mutating execution shall be isolated to one explicit run worktree and failed runs shall preserve artifacts for inspection and rollback. | Before mutating skill adapters are enabled. | EVD-7, EVD-10 |
| OBJ-7 | Queue triage shall package pending gates into operator-review packets without approving gates or mutating workflow state. | Before completion handoff. | EVD-9, EVD-11 |
| NG-1 | This execution will not replace the current MVP workflow with a hosted orchestration product. | Applies throughout MVP. | REV-1 |
| NG-2 | This execution will not treat provider session IDs as authoritative workflow state. | Applies throughout MVP. | VAL-5, VAL-8, VAL-13 |
| NG-3 | This execution will not implement custom credential storage or a new registry authentication model. | Applies throughout MVP. | REV-4 |
| NG-4 | This execution will not implement a complete public skill marketplace, package search UI, or reusable cross-project workflow platform. | Applies throughout MVP. | REV-6 |
| NG-5 | This execution will not permit read-only review or triage profiles to write into source, registry, or run worktree paths. | Applies throughout MVP. | VAL-7, VAL-9 |

Section status:
Complete.

## 3. Ownership, Roles, and Decision Points

| Role or person | Responsibility | Required action |
| --- | --- | --- |
| Jason Belmonti | Owns design approval, MVP scope, Linear structure, milestone approval, and final activation. | Approve |
| Codex implementation agent | Implements scoped work packages inside assigned editable paths and produces evidence. | Execute |
| Workflow implementation reviewer | Reviews Temporal determinism, state transitions, queue semantics, activity boundaries, and rollback. | Review |
| Registry contract reviewer | Reviews registry package-kind changes, schema compatibility, catalog validation, and digest behavior. | Review |
| Independent capability-policy reviewer | Reviews execution-profile enforcement, read-only containment, protected-path policy, and approval authority. | Review |
| Workflow operator | Runs local smoke tests, triage checks, gate decisions, rollback drills, and handoff verification. | Operate |
| Linear and GitHub integrations | Provide project-management, source-control, PR, and review context used by recipe steps. | Inform |

Decision points:
- DP-1: Approve `SRC-1` and this execution spec before implementation starts.
- DP-2: Decide whether BEL-772 is implemented first, replaced by the recipe-backed gate model, or absorbed into WP-3 before Temporal queue work begins.
- DP-3: Confirm registry package-kind strategy for `workflow-recipe`, `step-definition`, and runtime `execution-profile` before registry schema work lands.
- DP-4: Approve the fake recipe-to-gate proving slice before real skill adapters or live providers are enabled.
- DP-5: Approve capability-policy negative-test evidence before read-only triage or consensus review can run.
- DP-6: Approve rollback drill and operator handoff before marking the MVP complete.

Escalation path:
Pause execution and escalate to Jason Belmonti if implementation requires a hosted service, custom credential store, weaker read-only containment, ambiguous queue ownership, shared editable paths across agents, nondeterministic workflow imports, direct registry state mutation during workflow replay, or any change that makes rollback materially weaker than this spec.

Section status:
Complete.

## 4. Constraints, Assumptions, and Dependencies

| ID | Type | Statement | Owner | Blocking? | Validation or resolution plan |
| --- | --- | --- | --- | --- | --- |
| CON-1 | Constraint | Temporal workflow state shall remain the source of truth for run status, step cursor, active gate, queue item correlation, and terminal state. | Workflow implementation agent | No | VAL-5, VAL-6, and VAL-8 inspect workflow state and query behavior. |
| CON-2 | Constraint | Temporal workflow code shall not import Claudex, Codex, Claude SDKs, registry filesystem fetchers, Git clients, or nondeterministic runtime code. | Workflow implementation reviewer | No | VAL-5 and REV-3 inspect imports and compiled workflow bundle behavior. |
| CON-3 | Constraint | Running workflows shall use immutable recipe snapshots pinned by registry commit, digest, or equivalent snapshot ID. | Workflow implementation agent | No | VAL-3 verifies running workflows ignore later registry changes. |
| CON-4 | Constraint | Runtime `execution-profile` records shall be distinct from existing registry sync `profile` records. | Registry implementation agent | Yes | DP-3 and VAL-4 verify the distinction before recipes reference execution profiles. |
| CON-5 | Constraint | Read-only execution profiles shall deny write-capable tools, worker-agent delegation, mutation-capable MCP tools, approval-signal authority, and protected-path writes. | Capability-policy reviewer | No | VAL-7 and VAL-9 run negative enforcement tests. |
| CON-6 | Constraint | Mutating steps shall run in one explicit run worktree and shall not share active mutable paths across workflow runs. | Workflow implementation agent | No | VAL-7 and VAL-10 verify allocation, labels, and failed-run preservation. |
| CON-7 | Constraint | Queue triage may create derived review-packet artifacts but shall not approve, reject, cancel, abandon, or otherwise mutate workflow gate state. | Workflow implementation agent | No | VAL-9 verifies no queue-state mutation during triage. |
| CON-8 | Constraint | Linear tasks created for this execution shall use the repository-required headings: Objective, Context / Constraints, Materially verifiable success criteria, and Execution notes. | Codex implementation agent | No | REV-1 inspects Linear task hygiene before implementation starts. |
| CON-9 | Constraint | Non-mutating steps may retry only according to pinned retry policy; mutating steps shall not auto-retry unless explicit idempotency is declared. | Workflow implementation reviewer | No | VAL-14 verifies retry policy and mutating retry denial. |
| ASM-1 | Assumption | Fake steps can prove recipe, queue, and resume semantics before real skills are adapted. | Workflow implementation agent | No | VAL-1 proves the fake multi-run queue proof before WP-2 expands breadth. |
| ASM-2 | Assumption | The registry can add workflow-specific package kinds or catalog record types without breaking existing skill, agent-instruction, or sync-profile behavior. | Registry implementation agent | No | VAL-4 runs compatibility tests across old and new records. |
| ASM-3 | Assumption | Initial queue storage can live in Temporal workflow state and queries, with a derived local index added only if triage latency requires it. | Workflow implementation agent | No | Q-2 resolves during WP-6 through the VAL-9 50-item seed measurement before MS-4 approval. |
| DEP-1 | Dependency | `SRC-1` design approval and this execution spec approval are required before implementation starts. | Jason Belmonti | Yes | Section 18 entry gate requires explicit approval evidence. |
| DEP-2 | Dependency | A Linear execution-control issue or project shall exist before implementation starts. | Jason Belmonti | Yes | REV-1 verifies issue/project attribution and required heading format. |
| DEP-3 | Dependency | Registry MS-1 contract, validation, and catalog work must be stable enough to extend before formal workflow record implementation starts. | Registry implementation agent | Yes before WP-2 | DP-3 records whether to wait for BEL-859/BEL-901 or implement on the current registry branch. |
| DEP-4 | Dependency | Local Temporal server, Node 22+, and current offline test commands shall be available for integration smoke evidence. | Workflow operator | Yes before WP-3 | VAL-1 and VAL-5 record environment and command evidence. |

Section status:
Complete.

## Layer 2: Execution Plan

## 5. Evidence-Led Execution Model

Observable outcome:
An operator can start a recipe-backed agent workflow from validated registry content, observe queryable run and queue state, receive a durable approval queue item from a blocking step, approve or reject the matching gate, and continue execution under the declared execution profile without relying on provider-local session state or unsafe write access.

Core value proposition:
The control plane converts manually chained agent skills into a durable, typed, reviewable execution protocol where Temporal owns state, the registry owns versioned configuration, and human approvals are visible, triageable, and safe to resume.

Critical path hypothesis:
The shortest path that proves the design is viable is: validate a minimal recipe and runtime execution profile, resolve it to an immutable snapshot, start at least two Temporal recipe runs, execute fake steps, emit at least three queue items, reject stale and mismatched decisions, accept only matching decisions, and complete targeted runs while preserving deterministic workflow boundaries.

First proving slice:
WP-1 shall implement a fake recipe-to-gate vertical slice with minimal registry fixture records, a pinned snapshot, a recipe-backed Temporal workflow path, fake blocking steps, queue item queries, stale-decision rejection, wrong-workflow and wrong-queue-item rejection, and matching approval resume. This slice shall create at least three queue items across at least two workflow runs, use fake activities only, and shall not adapt real skills or live providers.

Sequencing principle:
Execution shall retire the highest-risk claims before broad implementation: prove recipe/gate/resume semantics with fake steps first, harden registry contracts second, enforce capability and worktree containment before real skills, and add triage/live smoke only after queue and profile negative tests pass.

Validation cadence:
Every work package shall produce focused tests and an evidence note under `docs/evidence/composable-agent-workflow/`. Integration validation runs at each milestone. Negative tests for stale decisions, retry-policy violations, read-only writes, disallowed tools, and protected-path changes are mandatory before live or mutating adapter work.

Deferred completeness:
Hosted UI, public workflow marketplace, full multi-user permissions, provider-agnostic live smoke beyond Codex, advanced queue prioritization heuristics, and reusable cross-repository package publication are deferred until after the MVP proves the local control-plane path.

Primary risks and unknowns:

| ID | Risk or unknown | Why it matters | Owner | Evidence required to retire | Decision gate |
| --- | --- | --- | --- | --- | --- |
| RISK-1 | Execution-profile enforcement could be incomplete. | Read-only review and triage steps become unsafe if prompts are the only control. | Capability-policy reviewer | VAL-7 before MS-3, VAL-9 before MS-4, plus REV-4 approval. | MS-3, MS-4 |
| RISK-2 | Queue item identity or resume correlation could be wrong. | A human approval could resume the wrong workflow, step, or stale gate. | Workflow implementation agent | VAL-1 and VAL-6 stale/wrong-run decision tests. | MS-1, MS-3 |
| RISK-3 | Recipes could become prompt-shaped blobs. | Composition, validation, triage, and downstream step execution require typed contracts. | Registry implementation agent | VAL-2 and VAL-4 reject prompt-only recipe and missing contract records. | MS-2 |
| RISK-4 | Registry baseline is still in active MS-1 implementation. | Workflow-specific registry records may conflict with validation/catalog changes in progress. | Registry contract reviewer | DP-3, REV-2, and compatibility evidence from VAL-4. | MS-2 |
| Q-1 | Should BEL-772 land first, or should its durable human-loop scope be absorbed into WP-3? | This affects sequencing and whether existing MVP tickets are superseded or prerequisites. | Jason Belmonti | Written decision in EVD-0 and Linear issue updates. | Entry gate |
| Q-2 | Should queue listing use only Temporal query state or a derived local queue index? | Triage performance and recovery complexity depend on this choice. | Workflow implementation agent | 50-item seed measurement in VAL-9. | MS-4 |

Section status:
Complete.

## 6. Change Surface Inventory

| ID | Surface | Change type | Owner | Read/write boundary | Review expectation |
| --- | --- | --- | --- | --- | --- |
| SURF-1 | `agent-config-registry/src/agent-config-registry/contracts/**`, `schemas/**` | Contract / Schema | Registry implementation agent | Add workflow recipe, step definition, and runtime execution-profile contracts without weakening existing package kinds. | REV-2 |
| SURF-2 | `agent-config-registry/src/agent-config-registry/validation/**`, catalog/digest modules, tests | Code / Test | Registry implementation agent | Add validation and catalog behavior for workflow records with compatibility tests. | REV-2 |
| SURF-3 | `workflow-temporal/src/workflows/**` | Code / Contract | Workflow implementation agent | Add a new recipe-backed workflow, query, signal, and deterministic state transitions. Do not import side-effectful runtime code. | REV-3, REV-5 |
| SURF-4 | `workflow-temporal/src/activities/**`, `src/claudex-turn/**` | Code | Workflow implementation agent | Add step activity runner and execution-context handling outside workflow code. | REV-3, REV-4 |
| SURF-5 | Worktree manager and artifact storage modules under `workflow-temporal/src/**` | Code / Data | Workflow implementation agent | Add run-scoped worktree and artifact handling; writes only under explicit run-owned paths. | REV-4, REV-6 |
| SURF-6 | Approval queue, triage packet, and operator client surfaces under `workflow-temporal/src/client/**` and related modules | Code / API | Workflow implementation agent | Add query/list/decision surfaces and triage packets without implicit approval authority. | REV-5, REV-6 |
| SURF-7 | Tests under both repositories | Test | Assigned package owners | Add unit, contract, bundle, negative, and smoke tests tied to `VAL-*` checkpoints. | REV-2 through REV-6 |
| SURF-8 | `docs/**`, `README.md`, `docs/evidence/composable-agent-workflow/**` | Docs / Runbook | Codex implementation agent | Add operator docs, evidence, rollback, and implementation handoff. Design doc remains read-only unless a deviation is approved. | REV-1, REV-6 |
| SURF-9 | Linear project/issues for composable workflow MVP | Project management | Jason Belmonti / Codex implementation agent | Create or update tasks with required headings and traceability to this spec. | REV-1 |
| SURF-10 | Existing `agent.helloClaudex` workflow path | Compatibility | Workflow implementation agent | Preserve as legacy path unless an approved deviation replaces it. | REV-3, REV-6 |

Section status:
Complete.

## 7. Agent-Focused Package Decomposition

Decomposition mission:
Constrain cross-repository implementation so registry contracts, recipe resolution, Temporal orchestration, queue semantics, execution-profile enforcement, worktree containment, and operator surfaces can be assigned independently without overlapping write ownership or hidden dependency cycles.

| ID | Unit | Ladder level | Mission | Observable value enabled | Risk retired | Public interface | Validation command | Promotion blockers |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PKG-1 | Registry workflow contracts | 2 | Define typed workflow recipe, step definition, and runtime execution-profile records. | Recipes can be validated without prompt prose. | RISK-3, RISK-4 | Exported contract constants, types, schema records. | `npm test -- tests/contracts` in `agent-config-registry` | App-specific record semantics and no release compatibility process yet. |
| PKG-2 | Registry workflow validation and catalog integration | 2 | Validate and catalog workflow records, references, and profile compatibility. | Registry can reject invalid recipes before workflow starts. | RISK-3, RISK-4 | Validation entrypoints, error codes, catalog record extensions. | `npm test -- tests/validation tests/catalog` in `agent-config-registry` | Depends on registry MS-1 validation/catalog baseline. |
| PKG-3 | Recipe resolver and snapshot contract | 2 | Resolve registry content to immutable workflow snapshots. | Temporal runs start from pinned recipe snapshots. | RISK-2, RISK-3 | Snapshot types, resolver activity or starter API, digest metadata. | `npm test` in `workflow-temporal` plus resolver tests | App-specific Temporal start semantics. |
| PKG-4 | Temporal recipe workflow and queue state | 2 | Interpret recipe steps, store run/gate state, and validate decision signals. | Fake and real recipe runs block and resume safely. | RISK-2 | Workflow type, query names, signal payloads, state/result contracts. | `npm run test:smoke` in `workflow-temporal` | Temporal-specific and tied to local MVP workflow model. |
| PKG-5 | Step activity runner and skill adapters | 2 | Execute one bounded typed step through fake or real agent adapters. | Real skills can run from typed inputs and produce typed outputs. | RISK-3 | Step request/result contracts, adapter registry, fake runner. | `npm test` in `workflow-temporal` | Skill-specific behavior and local provider assumptions. |
| PKG-6 | Execution-profile enforcement, worktree, and artifact containment | 2 | Apply capability policy, run worktree allocation, read-only bundles, and protected-path checks. | Mutating work is isolated and read-only work cannot write protected paths. | RISK-1 | Execution context, worktree manager, artifact references, enforcement adapter. | `npm test` plus negative enforcement tests in `workflow-temporal` | Depends on local filesystem and tool availability. |
| PKG-7 | Approval queue triage and operator surfaces | 2 | List pending gates, build review packets, and expose operator decisions. | Operators can triage gates without implicit approval. | RISK-1, RISK-2, Q-2 | Queue query/list API, triage packet artifact contract, CLI helpers. | `npm test` plus 50-item triage measurement | Heuristics are MVP-specific and not reusable yet. |

### Package Boundary Card: PKG-1

Ladder level:
2.

Mission:
Own registry-side typed contracts for workflow recipes, step definitions, and runtime execution profiles.

Value / risk trace:
- Observable value enabled: registry content can express a composable workflow without hard-coded Temporal step order.
- Risk retired: RISK-3, RISK-4.
- Validation evidence: VAL-2, VAL-4, EVD-2, EVD-4.
- Blocking unknowns: DP-3.

Owns:
- Files/directories: `agent-config-registry/src/agent-config-registry/contracts/**`, `schemas/**`, focused contract tests.
- Concepts: package kinds or record types, schema versions, contract field names, compatibility between recipes and execution profiles.
- Runtime responsibilities: none; this package declares contracts only.

Does not own:
- Explicitly excluded behavior: Temporal run state, live workflow execution, filesystem writes, agent invocation.
- Responsibilities delegated elsewhere: validation to PKG-2, recipe resolution to PKG-3, runtime enforcement to PKG-6.

Public interface:
- Exported types: recipe, step definition, execution profile, gate policy, retry policy, capability policy.
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
- Required coordination before editing: package kind names, schema version fields, or existing `profile` semantics.

Validation command:
`npm test -- tests/contracts` from `agent-config-registry`.

Promotion blockers:
The contracts are MVP-specific until versioning, compatibility, and release policy exist.

### Package Boundary Card: PKG-2

Ladder level:
2.

Mission:
Own registry-side validation and catalog behavior for workflow records.

Value / risk trace:
- Observable value enabled: invalid workflow recipes and profile references fail before a workflow starts.
- Risk retired: RISK-3, RISK-4.
- Validation evidence: VAL-2, VAL-4, EVD-2, EVD-4.
- Blocking unknowns: DEP-3.

Owns:
- Files/directories: `agent-config-registry/src/agent-config-registry/validation/**`, catalog integration modules, validation/catalog tests.
- Concepts: reference validation, missing-contract errors, prompt-only rejection, catalog metadata.
- Runtime responsibilities: local validation only.

Does not own:
- Explicitly excluded behavior: workflow execution, queue mutation, agent invocation, worktree writes.
- Responsibilities delegated elsewhere: contracts to PKG-1, runtime snapshot use to PKG-3.

Public interface:
- Exported types: validation result and error codes for workflow records.
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
- Required coordination before editing: validation result shape, public error codes, generated catalog fields.

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
- Blocking unknowns: DP-3.

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
Own the deterministic Temporal recipe workflow, run state, step cursor, queue item creation, and decision-signal validation.

Value / risk trace:
- Observable value enabled: recipe runs block and resume safely under Temporal-owned state.
- Risk retired: RISK-2.
- Validation evidence: VAL-1, VAL-5, VAL-6, EVD-1, EVD-5, EVD-6.
- Blocking unknowns: Q-1.

Owns:
- Files/directories: `workflow-temporal/src/workflows/**` recipe workflow files and workflow-focused tests.
- Concepts: run status, step status, gate status, queue item ID, gate revision, terminal states.
- Runtime responsibilities: deterministic orchestration only.

Does not own:
- Explicitly excluded behavior: agent SDK calls, registry fetches, worktree writes, triage packet generation.
- Responsibilities delegated elsewhere: activity execution to PKG-5, enforcement/worktree to PKG-6, triage to PKG-7.

Public interface:
- Exported types: workflow input, query state, signal payloads, workflow result.
- Exported functions/classes/components: workflow entrypoint.
- Events/messages/contracts: queue item and decision signal contracts.
- CLI/API surface: Temporal workflow type and query/signal names.

Allowed dependencies:
- May import: `@temporalio/workflow`, pure workflow contract modules, activity proxies.
- May call: Temporal condition/signal/query APIs and proxied activities.
- May read configuration from: workflow input only.

Forbidden dependencies:
- Must not import: Claudex, Codex, Claude SDKs, Node filesystem, Git, registry fetchers, process env.
- Must not call: side-effectful APIs during replay.
- Must not know about: protected path implementation details beyond snapshot policy values.

State boundary:
- Owns state: workflow run, step, gate, and queue correlation state.
- Reads state: pinned snapshot in workflow input and signal events.
- Mutates state: workflow-owned state only.
- Persistence responsibility: Temporal history and queryable state.

Agent ownership boundary:
- Agent editable paths: recipe workflow files, workflow contracts, workflow tests.
- Agent read-only paths: activity runner, registry modules, existing `hello-claudex` compatibility path unless explicitly assigned.
- Required coordination before editing: query/signal payloads and queue item contract.

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
- Must not call: approval signal APIs directly.
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
- Validation evidence: VAL-7, EVD-7.
- Blocking unknowns: none after DP-3.

Owns:
- Files/directories: worktree manager, artifact store, enforcement adapter, protected-path policy modules, negative tests.
- Concepts: allowed tools, skills, MCP servers, approval authority, protected paths, run worktree, read-only bundle.
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
- Must not call: approval signal mutation or registry validation as a side effect.
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
`npm test` from `workflow-temporal`, including negative protected-path tests.

Promotion blockers:
Local filesystem and tool restrictions are application-specific until an external policy engine exists.

### Package Boundary Card: PKG-7

Ladder level:
2.

Mission:
Own queue listing, triage packet generation, operator decision helpers, and runbook surfaces.

Value / risk trace:
- Observable value enabled: pending human approvals can be reviewed efficiently without implicit approval.
- Risk retired: RISK-1, RISK-2, Q-2.
- Validation evidence: VAL-9, EVD-9.
- Blocking unknowns: Q-2.

Owns:
- Files/directories: queue client helpers, triage packet modules, operator docs, triage tests.
- Concepts: review packets, grouping heuristic, operator decision target, queue item list filters.
- Runtime responsibilities: read queue state and emit derived artifacts only.

Does not own:
- Explicitly excluded behavior: changing workflow gate state, approving decisions, execution-profile schema.
- Responsibilities delegated elsewhere: queue state to PKG-4, enforcement to PKG-6.

Public interface:
- Exported types: queue item summary, triage packet, packet artifact ref.
- Exported functions/classes/components: queue list helper, triage packet builder.
- Events/messages/contracts: review packet artifact contract.
- CLI/API surface: operator commands or scripts for listing and packaging gates.

Allowed dependencies:
- May import: workflow client/query contracts, artifact writer with read-only output permissions.
- May call: Temporal queries and local artifact writes for packets.
- May read configuration from: explicit triage options.

Forbidden dependencies:
- Must not import: step adapter internals or worktree mutators.
- Must not call: approval/rejection/cancellation signal APIs from triage.
- Must not know about: provider session internals.

State boundary:
- Owns state: derived triage packet artifacts.
- Reads state: queryable queue item summaries and artifact refs.
- Mutates state: packet artifacts only.
- Persistence responsibility: review packet artifact files.

Agent ownership boundary:
- Agent editable paths: queue client, triage packet, docs, and triage tests.
- Agent read-only paths: workflow queue state contract and enforcement policy.
- Required coordination before editing: queue item summary and artifact schemas.

Validation command:
`npm test` from `workflow-temporal` plus 50-item triage measurement.

Promotion blockers:
Grouping heuristics are operator-specific and need broader use before reuse.

Dependency direction rules:
- Allowed direction: registry contracts -> registry validation; workflow snapshot resolver -> registry contract types; workflow interpreter -> snapshot contracts and activity proxies; activity runner -> execution context; triage -> workflow query contracts.
- Prohibited imports: workflow replay modules importing Node/registry/provider SDKs; registry modules importing workflow runtime code; triage importing decision-signal mutators.
- Allowed cross-boundary communication: typed contract exports, workflow start payloads, activity request/results, artifact refs, query results.
- Disallowed cross-boundary communication: deep private imports, shared mutable module state, implicit filesystem paths, prompt-only contracts.

State boundary rules:
- Package-owned state: registry catalog state belongs to the registry; run/gate/queue state belongs to Temporal workflow state; worktree and artifacts belong to run-scoped runtime storage; triage packets are derived artifacts.
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
- Triage code needs approval-signal authority.
- Two agents need to edit the same contract file in parallel.
- Validation requires full live provider execution when a fake or contract test should suffice.

N/A rationale:
N/A does not apply. Code, contracts, schema, package, and multi-agent implementation surfaces are affected.

Section status:
Complete.

## 8. Work Packages and Sequencing

Planning strategy:
Risk retirement with progressive value. WP-1 proves the critical path with fake steps. WP-2 and WP-3 harden source authority and workflow state. WP-4 blocks unsafe capability drift before real skills. WP-5 and WP-6 add real adapter and operator value. WP-7 performs activation, rollback, and handoff.

Critical path hypothesis:
A validated recipe snapshot can drive a deterministic Temporal workflow through fake step execution, durable gate creation, stale decision rejection, matching approval resume, and terminal completion.

First proving slice:
WP-1.

Validation cadence:
Each work package adds focused automated validation and records `EVD-*` evidence. Milestones require manual verification before dependent work proceeds.

Deferred completeness:
Hosted UI, provider breadth beyond Codex, advanced heuristics, public reusable packages, and general `AGENTS.md` merge behavior remain out of scope.

| ID | Objective | Owner | Package boundary | Editable paths | Read-only paths | Inputs | Outputs | Dependencies | Observable value enabled | Risk retired | Milestone gate | Validation checkpoint | Completion criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WP-1 | Implement fake recipe-to-gate proving slice. | Workflow implementation agent with registry reviewer support | PKG-1, PKG-3, PKG-4, PKG-5 | Narrow fixture/contracts/resolver/workflow/test paths in both repos | Existing `hello-claudex` code, registry docs | `SRC-1`, `SRC-2`, fake recipe fixture | Fake recipes start at least two workflow runs, create at least three queue items, reject stale, wrong-workflow, and wrong-queue-item decisions, resume only matching decisions, and complete | DEP-1, DEP-2, Q-1 decision | Proves critical recipe/gate/resume path before broad work | RISK-2, RISK-3 | MS-1 | VAL-1 | Automated fake vertical-slice tests and manual state inspection prove multi-run queue isolation and matching resume evidence. |
| WP-2 | Harden registry workflow records and compatibility. | Registry implementation agent | PKG-1, PKG-2 | `agent-config-registry` contracts, schemas, validation/catalog tests | `workflow-temporal` design and resolver tests | WP-1 fixture, registry MS-1 baseline | Validated recipe, step definition, execution-profile records and catalog metadata | DEP-3, DP-3 | Registry rejects invalid or prompt-only recipes | RISK-3, RISK-4 | MS-2 | VAL-2, VAL-4 | Existing registry tests remain green; new workflow validation tests pass; reviewer approves compatibility. |
| WP-3 | Build durable Temporal recipe workflow and approval queue semantics. | Workflow implementation agent | PKG-3, PKG-4 | `workflow-temporal/src/workflows/**`, workflow tests | Registry validation modules, activity runner internals | WP-1 and WP-2 contracts | Production-shaped recipe workflow state, queue item query, decision signals, retry policy, cancel/abandon semantics | MS-1, Q-1, DEP-4 | Queue state becomes durable and inspectable | RISK-2 | MS-3 | VAL-3, VAL-5, VAL-6, VAL-13, VAL-14 | Workflow bundle tests cover pinned snapshot, retry policy, stale decisions, cancel, abandon, provider-session loss, and query state. |
| WP-4 | Implement execution-profile enforcement and worktree/artifact containment. | Capability-policy implementation agent | PKG-6 | Enforcement, worktree, artifact modules and tests | Workflow queue contracts, registry profile contracts | WP-2 execution-profile schema; WP-3 state | Fail-closed execution context, run worktree allocation, read-only bundle, protected-path diff checks | MS-2 | Read-only and mutating execution profiles have enforceable runtime boundaries | RISK-1 | MS-3 | VAL-7 | Negative tests prove protected writes, disallowed tools, and approval authority fail. |
| WP-5 | Adapt the five known happy-path skills and consensus review shape. | Step adapter implementation agent | PKG-5, PKG-6 | Step adapter modules, fixtures, adapter tests | Skill source docs, registry contracts, workflow state | Approved profile enforcement and typed step contracts | Typed adapters for `linear-next-task`, `handoff-prompt`, `code-simplifier`, `organize-code-boundaries`, and `consensus-review`; fake fallbacks | MS-3, Q-4 | Recipe can represent and execute the intended workflow path | RISK-3 | MS-4 | VAL-8 | Adapter tests show typed inputs/outputs and consensus review uses read-only profile. |
| WP-6 | Implement queue triage and operator surfaces. | Operator tooling implementation agent | PKG-7 | Queue client, triage packet, docs, tests | Workflow queue contracts, enforcement modules | WP-3 queue state and WP-4 read-only profile | Queue listing, review packets, Q-2 storage decision from the 50-item measurement, runbook updates | MS-3 | Operator can triage pending decisions without implicit approval | RISK-1, RISK-2, Q-2 | MS-4 | VAL-9 | Triage packet generation is measured, read-only, resolves Q-2 before MS-4, and is manually approved. |
| WP-7 | Complete live opt-in smoke, rollback, Linear handoff, and final evidence. | Codex implementation agent and operator | PKG-3 through PKG-7 | Docs, evidence, smoke scripts, Linear updates | All implementation surfaces | WP-1 through WP-6 | Final evidence bundle, rollback drill, live opt-in smoke result, handoff record | MS-4 | MVP is activation-ready or explicitly blocked with evidence | RISK-1, RISK-2 | MS-5 | VAL-10, VAL-11, VAL-12 | Final gate evidence exists and Jason approves or rejects activation. |

Execution sequence:
1. Resolve entry gates and Q-1.
2. Execute WP-1 as the first proving slice.
3. Execute WP-2 and WP-3 after MS-1; WP-2 must stabilize registry contracts before WP-3 locks workflow snapshot shapes.
4. Execute WP-4 before any real skill adapter receives write-capable tools.
5. Execute WP-5 after MS-3 and Q-4; execute WP-6 after MS-3, using the VAL-9 50-item measurement to resolve Q-2 before MS-4. They may proceed in parallel only if they do not share editable paths and use approved queue/profile contracts.
6. Execute WP-7 after MS-4.

Parallelization rules:
Parallel work is prohibited before WP-1 approval. After MS-2, registry validation work and workflow queue work may proceed in parallel only when contract files are not shared. After MS-3, skill adapters and triage may proceed in parallel if neither changes queue item or execution-profile public contracts.

Integration points:
Registry contract exports feed recipe snapshots. Recipe snapshots feed workflow start. Workflow queue contracts feed triage. Execution-profile snapshots feed activity runner enforcement. Artifacts from activity runner and triage feed manual milestone verification.

Coordination triggers:
Changing any public recipe, step, execution profile, queue item, decision signal, artifact ref, or worktree allocation field requires pausing dependent packages, updating traceability, and recording a `DEV-*` if the change alters source-authority behavior.

Section status:
Complete.

## 9. Milestone Gates and Manual Verification

| ID | Gate objective | Covered work | Due point | Human verifier | Prerequisites | Review gate | Required evidence | Approval decision | Failure path |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MS-1 | Approve fake multi-run queue proof. | OBJ-1, OBJ-3, OBJ-4, WP-1, PKG-1, PKG-3, PKG-4, PKG-5 | Before WP-2 or WP-3 expands implementation | Jason Belmonti | VAL-1, EVD-1 | REV-1, REV-3 | EVD-1 | Approve / Reject / Conditional approval | Stop; revise recipe/gate model before broad implementation. |
| MS-2 | Approve registry workflow contracts. | OBJ-2, WP-2, PKG-1, PKG-2, SURF-1, SURF-2 | Before WP-4 and before real adapters reference execution profiles | Registry contract reviewer | VAL-2, VAL-4, EVD-2, EVD-4 | REV-2 | EVD-2, EVD-4 | Approve / Reject / Conditional approval | Stop registry integration; revise package-kind and schema strategy. |
| MS-3 | Approve queue safety and capability containment. | OBJ-3, OBJ-4, OBJ-5, OBJ-6, WP-3, WP-4, PKG-4, PKG-6 | Before WP-5 real skill adapters or WP-6 triage | Jason Belmonti and capability-policy reviewer | VAL-5, VAL-6, VAL-7, VAL-13, VAL-14, EVD-5, EVD-6, EVD-7, EVD-13, EVD-14 | REV-3, REV-4, REV-5 | EVD-5, EVD-6, EVD-7, EVD-13, EVD-14 | Approve / Reject / Conditional approval | Disable recipe-backed starts; keep fake slice only until defects are resolved. |
| MS-4 | Approve adapter and triage usability. | OBJ-1, OBJ-5, OBJ-7, WP-5, WP-6, PKG-5, PKG-7 | Before live opt-in smoke or final readiness | Jason Belmonti | VAL-8, VAL-9, EVD-8, EVD-9 | REV-4 | EVD-8, EVD-9 | Approve / Reject / Conditional approval | Remove real adapters from activation path; continue with fake recipe evidence only. |
| MS-5 | Approve MVP activation or rejection. | All objectives, WP-7, rollout, rollback, handoff | Before completion | Jason Belmonti | VAL-10, VAL-11, VAL-12, EVD-10, EVD-11, EVD-12 | REV-6 | EVD-10, EVD-11, EVD-12, handoff record | Approve / Reject / Conditional approval | Mark Not ready; keep recipe-backed starts disabled and preserve evidence. |

Manual verification guide:

| Step ID | Milestone | Operator action | Expected result | Evidence artifact |
| --- | --- | --- | --- | --- |
| MV-1 | MS-1 | Start at least two fake recipe workflow runs and query state while blocked. | Queries show pinned recipe snapshots, active steps, at least three total open queue item IDs, gate revisions, and fake artifact refs across the runs. | EVD-1 |
| MV-2 | MS-1 | Submit stale, wrong-workflow, and wrong-queue-item decision signals. | Workflows reject each invalid decision and remain blocked on the current queue item and gate revision. | EVD-1 |
| MV-3 | MS-1 | Submit matching approval decisions for the intended queue items. | Only the targeted workflows resume and reach terminal success through fake steps. | EVD-1 |
| MV-4 | MS-2 | Inspect registry contract and validation evidence. | Runtime `execution-profile` is distinct from sync `profile`; prompt-only and missing-reference recipes fail validation. | EVD-2, EVD-4 |
| MV-5 | MS-3 | Run read-only protected-path negative tests. | Write attempts fail before protected source, registry, or worktree paths change. | EVD-7 |
| MV-6 | MS-3 | Run cancel/abandon/stale decision cases. | Queue item and workflow states transition as specified; later decisions are rejected. | EVD-5, EVD-6 |
| MV-6A | MS-3 | Simulate provider-session loss before a resume attempt. | The workflow resumes from workflow-owned objective, summaries, human input, and artifact refs; prior provider session refs are treated only as hints and a new session hint is recorded when available. | EVD-13 |
| MV-6B | MS-3 | Run retry-policy cases for mutating and non-mutating steps. | Non-mutating steps retry according to the pinned policy; mutating steps do not auto-retry unless explicit idempotency is declared. | EVD-14 |
| MV-7A | MS-4 | Inspect or run the five happy-path step adapter evidence. | Each adapter exposes typed input, output, artifact, and gate contracts; `consensus-review` is bound to a read-only execution profile. | EVD-8, EVD-9 |
| MV-7 | MS-4 | Generate a triage packet from seed queue items. | Packet references still-open queue item IDs and does not approve, reject, cancel, or abandon any gate. | EVD-9 |
| MV-8 | MS-5 | Execute rollback drill. | New recipe-backed starts can be disabled, existing `agent.helloClaudex` or approved equivalent remains runnable, and failed worktrees/artifacts are preserved. | EVD-10, EVD-12 |
| MV-8A | MS-5 | Run the live opt-in smoke path under approved execution profiles. | The Codex-backed recipe path completes or reaches a documented gate without requesting broader permissions, and smoke logs identify the recipe snapshot and execution profile IDs. | EVD-12 |
| MV-8B | MS-5 | Review the final handoff and operator documentation. | Handoff includes start, query, list queue, decide, triage, cancel, abandon, rollback, disable-starts commands, Linear links, evidence paths, and known limitations. | EVD-11, handoff record |

Section status:
Complete.

## 10. Execution Controls and Drift Management

| ID | Trigger | Required action | Owner | Evidence |
| --- | --- | --- | --- | --- |
| CTRL-1 | Design source, Linear scope, or registry dependency changes before implementation. | Reconcile this spec and record a `DEV-*` if scope or sequencing changes. | Codex implementation agent | Updated spec section and EVD-0 note. |
| CTRL-2 | A workflow module needs a nondeterministic import. | Stop and move behavior into an activity, starter, or resolver outside workflow replay. | Workflow implementation agent | REV-3 import inspection. |
| CTRL-3 | A read-only profile requires a mutable worktree, shell write, patch, worker-agent, or approval authority. | Stop and revise profile or package boundary before execution continues. | Capability-policy reviewer | VAL-7 negative evidence. |
| CTRL-4 | Two work packages require the same editable contract path. | Serialize those packages or create an explicit coordination subtask before editing. | Codex implementation agent | Work package update and reviewer note. |
| CTRL-5 | Registry workflow records conflict with existing `profile` package semantics. | Pause WP-2 and resolve DP-3 with registry reviewer and Jason. | Registry implementation agent | EVD-4 decision record. |
| CTRL-6 | A milestone due point is reached without required evidence. | Stop dependent work until required evidence exists and the verifier approves or rejects. Conditional approval may only unblock explicitly named non-dependent work, must list missing `EVD-*` artifacts, and must keep any work depending on missing evidence stopped. | Assigned work package owner | Milestone approval record with conditional scope when applicable. |
| CTRL-7 | Live provider smoke requires broader permissions than the approved execution profile. | Abort live smoke and revise policy or mark activation Not ready. | Workflow operator | EVD-12 smoke log and REV-4 note. |

Deviation rules:
Any change to source authority, execution level, rollback posture, queue ownership, execution-profile policy, protected-path scope, package-kind semantics, or first proving slice shall be recorded as `DEV-*` with owner, approver, rationale, impact, and evidence before implementation continues.

Pause or escalation conditions:
Pause for any failed protected-path negative test, stale decision accepted as valid, workflow replay nondeterminism, unreviewed registry schema incompatibility, live provider auth leakage, missing milestone evidence, or Linear work created without the required headings.

Section status:
Complete.

## 11. Data, Schema, Config, and Contract Handling

| Change | Impact | Compatibility | Reversibility | Validation |
| --- | --- | --- | --- | --- |
| Add registry `workflow-recipe` records. | New configuration contract for ordered or branched workflow steps. | Existing registry package kinds must continue to validate and catalog unchanged. | Reversible by removing records and disabling recipe-backed starts. | VAL-2, VAL-4 |
| Add registry `step-definition` records. | Defines typed input, output, artifact, and gate contracts for recipe steps. | Existing skills are referenced by adapters; skill package content does not need immediate rewrite. | Reversible by removing step records and adapters. | VAL-2, VAL-8 |
| Add runtime `execution-profile` records. | Adds capability policy for tools, skills, MCP, approval authority, retry class, and filesystem policy. | Must be distinct from current sync `profile` package kind. | Reversible by disabling recipe-backed starts and removing records. | VAL-4, VAL-7, VAL-14 |
| Add recipe snapshot to workflow start/state. | New recipe-backed workflow start contract and query state. | Existing `agent.helloClaudex` remains compatible unless deviation approved. | Reversible by disabling new workflow type. | VAL-3, VAL-5 |
| Add approval queue item and decision signal contracts. | Enables durable gate listing and resume by queue item plus gate revision. | Version queue item payloads to protect long-running workflows. | Reversible for new runs; existing blocked runs can be cancelled or abandoned. | VAL-6 |
| Add run worktree and artifact metadata. | Records run-owned mutable path, read-only bundle path, and artifact refs. | Existing turn artifact refs can be extended without removing old fields. | Reversible by preserving artifacts and disabling worktree allocation for new recipe runs. | VAL-7, VAL-10 |
| Add triage packet artifact contract. | Stores derived review packets that reference queue items. | Queue item state remains authoritative; packets can be regenerated. | Reversible by deleting derived packets. | VAL-9, VAL-10 |

N/A rationale:
N/A does not apply. Data, schema, config, and contract changes are core to this execution.

Section status:
Complete.

## Layer 3: Validation, Release, and Handoff

## 12. Validation and Evidence Plan

| ID | Method | Claim verified | Timing | Owner | Evidence artifact |
| --- | --- | --- | --- | --- | --- |
| VAL-0 | Review / PM inspection | Entry readiness is recorded: `SRC-1` approval, spec approval, Q-1 and Q-3 decisions, Linear execution-control issue or project with required headings, DEP-3 registry baseline decision, and reviewer assignment. | Before implementation starts | Jason Belmonti and Codex implementation agent | EVD-0 |
| VAL-1 | Test / Manual | Fake recipe queue proof validates, starts at least two workflow runs, creates at least three queue items, rejects stale, wrong-workflow, and wrong-queue-item decisions, accepts only matching decisions, and completes targeted runs. | Pre-merge for WP-1 | Workflow implementation agent | EVD-1 |
| VAL-2 | Test / Review | Registry rejects missing step contracts, missing execution profiles, prompt-only outputs, unsupported schema versions, and invalid references. | Pre-merge for WP-2 | Registry implementation agent | EVD-2 |
| VAL-3 | Test | Running workflow uses pinned recipe snapshot and ignores later registry changes. | Pre-merge for WP-3 | Workflow implementation agent | EVD-3 |
| VAL-4 | Compatibility test | Existing `skill`, `agent-instructions`, and sync `profile` records remain valid; runtime `execution-profile` remains distinct. | Pre-merge for WP-2 | Registry contract reviewer | EVD-4 |
| VAL-5 | Test / Inspection | Workflow code remains deterministic and side effects stay inside activities, starters, or resolver code outside replay. | Pre-merge for WP-3 | Workflow implementation reviewer | EVD-5 |
| VAL-6 | Test | Decision signals validate workflow execution ID, queue item ID, gate revision, status, and terminal/abandoned cases. | Pre-merge for WP-3 | Workflow implementation agent | EVD-6 |
| VAL-7 | Negative test / Security review | Execution-profile enforcement blocks disallowed tools, MCP access, approval authority, and protected-path writes. | Pre-merge for WP-4 | Capability-policy reviewer | EVD-7 |
| VAL-8 | Test | Five happy-path step adapters use typed input/output/gate contracts and preserve artifact refs. | Pre-release | Step adapter implementation agent | EVD-8 |
| VAL-9 | Negative test / Measurement | Triage and consensus read-only profiles cannot mutate protected paths or queue state; 50 pending items package within 5 seconds on the local development machine. | Pre-release for WP-6 | Operator tooling agent | EVD-9 |
| VAL-10 | Manual / Inspection | Worktree allocation is one run to one mutable worktree, failed worktrees are preserved, and cleanup is explicit. | Pre-release | Workflow operator | EVD-10 |
| VAL-11 | Manual / Review | Operator docs and Linear handoff show how to start, inspect, approve, reject, abandon, triage, and roll back recipe-backed runs. | Pre-completion | Codex implementation agent | EVD-11 |
| VAL-12 | Live opt-in smoke / Rollback drill | One Codex-backed opt-in recipe path runs under approved profiles, and recipe-backed starts can be disabled while preserving legacy/equivalent behavior. | Pre-completion | Workflow operator | EVD-12 |
| VAL-13 | Test / Fault injection | Provider-session loss resumes from workflow-owned objective, summaries, human inputs, and artifact refs rather than provider-local session state; a new provider session hint is recorded when available. | Pre-merge for WP-3; repeat before live smoke if adapter behavior changes | Workflow implementation agent | EVD-13 |
| VAL-14 | Test | Non-mutating steps retry only according to pinned retry policy, while mutating steps do not auto-retry unless idempotency is explicitly declared. | Pre-merge for WP-3 | Workflow implementation agent | EVD-14 |

Section status:
Complete.

## 13. Review Plan

| ID | Reviewer | Review scope | Blocking? | Completion evidence |
| --- | --- | --- | --- | --- |
| REV-1 | Jason Belmonti | Source authority, Linear project/ticket structure, Q-1 decision, Q-3 decision, required task headings, and entry readiness. | Yes | VAL-0 approval and EVD-0. |
| REV-2 | Registry contract reviewer | Registry contracts, schema compatibility, validation, catalog, digest, and runtime `execution-profile` distinction. | Yes | MS-2 approval with EVD-2 and EVD-4. |
| REV-3 | Workflow implementation reviewer | Temporal determinism, recipe snapshot use, workflow imports, queue state, retry policy, provider-session fallback, and compiled bundle behavior. | Yes | MS-1/MS-3 approval with EVD-1, EVD-3, EVD-5, EVD-13, EVD-14. |
| REV-4 | Independent capability-policy reviewer | Execution-profile enforcement, read-only containment, protected-path checks, tool/MCP/skill authority, and approval authority. | Yes | MS-3/MS-4 approval with EVD-7 and EVD-9. |
| REV-5 | Workflow implementation reviewer | Queue item identity, stale decisions, retry behavior, cancel/abandon behavior, provider-session fallback, recovery, and artifact references. | Yes | EVD-6, EVD-13, and EVD-14 approval. |
| REV-6 | Jason Belmonti and operator reviewer | Operator docs, live smoke evidence, rollback drill, Linear handoff, and final readiness. | Yes | MS-5 approval with EVD-10 through EVD-12. |

Approval conditions:
Implementation may merge only when all due milestone gates have evidence, all blocking reviews are approved, no E3 heightened-control finding remains open, the existing `agent.helloClaudex` compatibility posture is documented, and rollback can be executed by the operator.

Section status:
Complete.

## 14. Rollout, Migration, Rollback, and Recovery

| ID | Action | Timing | Owner | Abort trigger | Evidence |
| --- | --- | --- | --- | --- | --- |
| REL-1 | Land recipe-backed workflow as a new workflow path or feature-gated starter without removing `agent.helloClaudex`. | WP-3 | Workflow implementation agent | Compiled bundle failure or nondeterministic import. | EVD-5 |
| REL-2 | Enable fake recipe runs only after MS-1 approval. | After WP-1 | Workflow operator | Stale decision accepted or queue query missing required fields. | EVD-1 |
| REL-3 | Enable real skill adapters only after MS-3 approval and Q-4 resolution. | After WP-4 | Capability-policy reviewer | Read-only protected-path negative test fails or typed adapter contracts are unresolved. | EVD-7 |
| REL-4 | Enable queue triage only after MS-4 approval. | After WP-6 | Workflow operator | Triage mutates queue state or fails the 50-item-within-5-seconds local measurement. | EVD-9 |
| REL-5 | Run live Codex opt-in smoke and rollback drill before completion. | WP-7 | Workflow operator | Live run requests broader permissions or rollback cannot disable new starts. | EVD-12 |

Rollback or containment plan:
Disable new recipe-backed starts, leave existing `agent.helloClaudex` or approved equivalent available, reject or abandon blocked recipe-backed runs through the workflow signal path, preserve run worktrees and artifacts for inspection, revert registry workflow records to the last validated commit, and remove triage/adapter activation from operator docs until the failed milestone is corrected.

Recovery limit:
Rollback is strong for new runs because recipe-backed starts are additive and can be disabled. Recovery is constrained for already-running workflows: they must be completed, cancelled, or abandoned through recorded workflow state rather than rewritten out of history.

Section status:
Complete.

## 15. Observability and Operational Readiness

| ID | Signal | Purpose | Consumer | Response |
| --- | --- | --- | --- | --- |
| OBS-1 | Recipe run query state | Shows snapshot ID, current step, status, queue item, gate revision, worktree/bundle path, and profile IDs. | Operator | Inspect before approving, rejecting, cancelling, or abandoning. |
| OBS-2 | Queue item count by status and age | Detects blocked workflow backlog. | Operator / triage | Generate triage packet or abandon stale work. |
| OBS-3 | Step transition audit | Records pending, running, blocked, completed, failed, cancelled, abandoned. | Reviewer / operator | Investigate failed runs and stale gates. |
| OBS-4 | Execution-profile enforcement failure | Proves disallowed tools or writes were blocked. | Capability-policy reviewer | Block milestone approval until expected and documented. |
| OBS-5 | Worktree allocation record | Maps run to mutable path, base ref, branch, and cleanup state. | Operator | Inspect failed work or run cleanup after approval. |
| OBS-6 | Triage packet artifact | Records grouping heuristic, queue item IDs, and decision targets. | Jason Belmonti | Review pending gates without switching full context for each run. |
| OBS-7 | Rollback drill record | Shows recipe-backed starts disabled and legacy/equivalent path preserved. | Jason Belmonti | Approve final activation or reject readiness. |

Operator actions:
Start fake or live opt-in recipe runs, query run state, list queue items, submit approval/rejection/cancel/abandon signals, generate triage packets, inspect artifacts and worktrees, disable recipe-backed starts, and revert registry workflow records to a validated commit.

Monitoring window:
For the MVP, monitor manually through the first live opt-in run and the next three local recipe-backed runs after activation. Any stale decision acceptance, protected-path mutation, or missing rollback path immediately suspends recipe-backed starts.

N/A rationale:
N/A does not apply because the change affects live local workflow operation.

Section status:
Complete.

## 16. Risks, Questions, Deviations, and Waivers

Risks:

| ID | Risk | Impact | Likelihood | Owner | Mitigation | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| RISK-1 | Execution-profile enforcement incomplete. | High | Medium | Capability-policy reviewer | Fail closed, deny-by-default profiles, read-only bundles, protected-path diff checks, independent review. | VAL-7, VAL-9 |
| RISK-2 | Queue item or gate revision correlation incorrect. | High | Medium | Workflow implementation agent | Include workflow execution ID, queue item ID, gate revision, and status checks in every decision. | VAL-1, VAL-6 |
| RISK-3 | Recipes become prompt-shaped blobs. | Medium | Medium | Registry implementation agent | Require typed step definitions, outputs, artifacts, and gate contracts; reject prompt-only records. | VAL-2, VAL-4, VAL-8 |
| RISK-4 | Registry baseline conflicts with workflow-specific records. | Medium | Medium | Registry contract reviewer | Resolve DP-3, preserve existing package-kind behavior, add compatibility tests. | VAL-2, VAL-4 |
| RISK-5 | Cross-repo implementation creates overlapping editable paths. | Medium | Medium | Codex implementation agent | Assign package ownership, serialize public contract edits, and trigger coordination on shared paths. | CTRL-4, REV-1 |
| RISK-6 | Live provider smoke expands permissions beyond MVP policy. | High | Low | Workflow operator | Keep live path opt-in, abort on permission drift, require REV-4 before activation. | VAL-7, VAL-12 |

Open questions:

| ID | Question | Owner | Due date | Blocking? | Resolution path |
| --- | --- | --- | --- | --- | --- |
| Q-1 | Should BEL-772 land before this work, or should this execution absorb and supersede BEL-772? | Jason Belmonti | Before implementation starts | Yes | Record decision in EVD-0 and update Linear scope. |
| Q-2 | Should queue listing stay in Temporal query state or use a derived local queue index? | Workflow implementation agent | Before MS-4 | No | Resolve during WP-6 by running the VAL-9 50-item seed measurement and choosing the least stateful option that meets triage needs. |
| Q-3 | Should registry workflow records be package kinds, catalog-only records, or another schema extension? | Registry contract reviewer | Before WP-2 starts | Yes for WP-2 | Decide at DP-3 with compatibility evidence. |
| Q-4 | What exact typed output contract is required for each of the five happy-path skills? | Step adapter implementation agent | Before WP-5 starts | Yes for WP-5 | Draft adapter contract table and validate with fake fixtures before real skills. |

Approved deviations:

| ID | Deviation | Owner | Approver | Rationale | Impact | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| None | No deviations approved. | N/A | N/A | N/A | N/A | N/A |

Approved waivers:

| ID | Waived rule or finding | Approver | Rationale | Boundary or expiry | Compensating control | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| None | No waivers approved. | N/A | N/A | N/A | N/A | N/A |

Section status:
Complete.

## 17. Execution Traceability Matrix

| Source, objective, or evidence-led claim | Change surfaces | Package boundaries | Work packages | Milestones | Controls | Validation | Review | Release or ops | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SRC-1 / OBJ-1 / Critical path | SURF-1, SURF-3, SURF-4 | PKG-1, PKG-3, PKG-4, PKG-5 | WP-1, WP-3, WP-5 | MS-1, MS-4 | CTRL-1, CTRL-2 | VAL-1, VAL-3, VAL-8 | REV-1, REV-3 | REL-1, OBS-1 | EVD-1, EVD-3, EVD-8 |
| SRC-5 / OBJ-2 / Typed registry contracts | SURF-1, SURF-2 | PKG-1, PKG-2 | WP-2 | MS-2 | CTRL-5 | VAL-2, VAL-4 | REV-2 | REL-2 | EVD-2, EVD-4 |
| OBJ-3 / Durable queue items | SURF-3, SURF-6 | PKG-4 | WP-1, WP-3 | MS-1, MS-3 | CTRL-6 | VAL-1, VAL-6 | REV-5 | OBS-1, OBS-2 | EVD-1, EVD-6 |
| OBJ-4 / Safe resume | SURF-3 | PKG-4 | WP-1, WP-3 | MS-1, MS-3 | CTRL-6 | VAL-1, VAL-6, VAL-13 | REV-3, REV-5 | OBS-3 | EVD-1, EVD-6, EVD-13 |
| OBJ-5 / Execution-profile enforcement | SURF-4, SURF-5 | PKG-6 | WP-4, WP-5 | MS-3, MS-4 | CTRL-3, CTRL-7 | VAL-7, VAL-9 | REV-4 | REL-3, OBS-4 | EVD-7, EVD-9 |
| OBJ-6 / Worktree containment | SURF-5 | PKG-6 | WP-4, WP-7 | MS-3, MS-5 | CTRL-3 | VAL-7, VAL-10, VAL-12 | REV-4, REV-6 | REL-5, OBS-5 | EVD-7, EVD-10, EVD-12 |
| OBJ-7 / Triage packets | SURF-6, SURF-8 | PKG-7 | WP-6 | MS-4 | CTRL-3, CTRL-6 | VAL-9 | REV-4 | REL-4, OBS-6 | EVD-9 |
| SRC-4 / SRC-6 / PM readiness | SURF-9 | N/A with PM rationale | WP-7 | Entry gate, MS-5 | CTRL-1, CTRL-6 | VAL-0, VAL-11 | REV-1, REV-6 | OBS-7 | EVD-0, EVD-11 |
| SRC-2 / SRC-3 / NG-2 / Provider-session non-authority | SURF-3, SURF-4, SURF-10 | PKG-3, PKG-4, PKG-5 | WP-1, WP-3, WP-5 | MS-1, MS-3, MS-4 | CTRL-2, CTRL-6 | VAL-5, VAL-8, VAL-13 | REV-3, REV-5 | REL-1, OBS-1, OBS-3 | EVD-5, EVD-8, EVD-13 |
| SRC-1 / SRC-3 / REQ-12 / Retry-policy recovery | SURF-3, SURF-4, SURF-5 | PKG-3, PKG-4, PKG-6 | WP-3, WP-4 | MS-3 | CTRL-2, CTRL-3, CTRL-6 | VAL-14 | REV-3, REV-5 | OBS-3, OBS-4 | EVD-14 |
| SRC-7 / Requested execution-spec artifact | SURF-8, SURF-9 | N/A with docs and PM rationale | WP-7 | Entry gate, MS-5 | CTRL-1, CTRL-6 | VAL-0, VAL-11 | REV-1, REV-6 | OBS-7 | EVD-0, EVD-11 |
| SURF-7 / Validation test surface | SURF-7 | PKG-1, PKG-2, PKG-3, PKG-4, PKG-5, PKG-6, PKG-7 | WP-1, WP-2, WP-3, WP-4, WP-5, WP-6, WP-7 | Entry gate, MS-1, MS-2, MS-3, MS-4, MS-5 | CTRL-1, CTRL-6 | VAL-0, VAL-1, VAL-2, VAL-3, VAL-4, VAL-5, VAL-6, VAL-7, VAL-8, VAL-9, VAL-10, VAL-11, VAL-12, VAL-13, VAL-14 | REV-1, REV-2, REV-3, REV-4, REV-5, REV-6 | REL-2, REL-3, REL-4, REL-5, OBS-7 | EVD-0, EVD-1, EVD-2, EVD-3, EVD-4, EVD-5, EVD-6, EVD-7, EVD-8, EVD-9, EVD-10, EVD-11, EVD-12, EVD-13, EVD-14 |
| RISK-1 | SURF-4, SURF-5, SURF-6 | PKG-6, PKG-7 | WP-4, WP-6 | MS-3, MS-4 | CTRL-3, CTRL-7 | VAL-7, VAL-9 | REV-4 | REL-3, REL-4 | EVD-7, EVD-9 |
| RISK-2 | SURF-3, SURF-6 | PKG-4, PKG-7 | WP-1, WP-3, WP-6 | MS-1, MS-3 | CTRL-6 | VAL-1, VAL-6, VAL-13 | REV-5 | OBS-1, OBS-3 | EVD-1, EVD-6, EVD-13 |
| RISK-3 | SURF-1, SURF-2, SURF-4 | PKG-1, PKG-2, PKG-5 | WP-2, WP-5 | MS-2, MS-4 | CTRL-5 | VAL-2, VAL-4, VAL-8 | REV-2, REV-4 | REL-2, REL-3 | EVD-2, EVD-4, EVD-8 |
| RISK-4 | SURF-1, SURF-2, SURF-9 | PKG-1, PKG-2 | WP-2 | MS-2 | CTRL-1, CTRL-5 | VAL-2, VAL-4 | REV-2 | REL-2 | EVD-2, EVD-4 |
| RISK-5 | SURF-1, SURF-2, SURF-3, SURF-4, SURF-5, SURF-6, SURF-7, SURF-8, SURF-9 | PKG-1, PKG-2, PKG-3, PKG-4, PKG-5, PKG-6, PKG-7 | WP-1, WP-2, WP-3, WP-4, WP-5, WP-6, WP-7 | Entry gate, MS-1, MS-2, MS-3, MS-4, MS-5 | CTRL-4, CTRL-6 | VAL-0, VAL-11 | REV-1, REV-2, REV-3, REV-4, REV-5, REV-6 | OBS-7 | EVD-0, EVD-11 |
| RISK-6 | SURF-4, SURF-5 | PKG-6 | WP-4, WP-7 | MS-3, MS-5 | CTRL-7 | VAL-7, VAL-12 | REV-4, REV-6 | REL-5, OBS-4, OBS-7 | EVD-7, EVD-12 |
| Q-1 / Entry sequencing | SURF-9, SURF-10 | PKG-4 | WP-1, WP-3 | Entry gate, MS-1 | CTRL-1 | VAL-0 | REV-1 | REL-1 | EVD-0 |
| Q-2 / Queue storage and index decision | SURF-6, SURF-8 | PKG-7 | WP-6 | MS-4 | CTRL-1, CTRL-6 | VAL-9 | REV-5 | OBS-2, OBS-6 | EVD-9 |
| Q-3 / Registry record strategy | SURF-1, SURF-2 | PKG-1, PKG-2 | WP-2 | MS-2 | CTRL-5 | VAL-2, VAL-4 | REV-2 | REL-2 | EVD-2, EVD-4 |
| Q-4 / Skill adapter output contracts | SURF-4, SURF-6, SURF-8 | PKG-5, PKG-6 | WP-5 | MS-4 | CTRL-1, CTRL-3 | VAL-8 | REV-4 | REL-3, OBS-3 | EVD-8 |

Section status:
Complete.

## 18. Final Execution Gate

Entry gate:
Not satisfied. Required before implementation starts: Jason approves `SRC-1`; Jason approves this execution spec or a revised version; Q-1 and Q-3 are resolved; a Linear execution-control issue or project exists with required headings and traceability; DEP-3 registry baseline decision is recorded; and an independent capability-policy reviewer is assigned.

Milestone approval gate:
MS-1 through MS-5 are fully specified with due points, verifiers, manual verification steps, required evidence, review gates, approval decisions, and failure paths. No milestone may be treated as approved until its named verifier records approval evidence.

Completion gate:
Completion requires all `WP-*` rows closed, all `VAL-*` checks passed or explicitly blocked, all `EVD-*` artifacts present, all blocking `REV-*` approvals recorded, no open E3 heightened-control findings, and all blocking `Q-*` rows resolved.

Release gate:
Activation requires MS-5 approval, successful rollback drill, live opt-in smoke evidence, recipe-backed starts disabled-by-default or otherwise operator-controlled, and documented preservation of `agent.helloClaudex` or an approved equivalent. If live smoke is explicitly deferred, activation is limited to the non-live fake recipe path and live provider-backed recipe starts must remain disabled until VAL-12 evidence is approved.

Handoff record:
The final handoff shall include the approved recipe and execution-profile IDs, workflow type and signal/query names, Linear issue/project links, evidence bundle path, rollback procedure, known limitations, open deferred work, and operator commands for start, query, list queue, decide, triage, cancel, abandon, and disable recipe-backed starts.

Final readiness state:
Not ready.

Section status:
Complete.
