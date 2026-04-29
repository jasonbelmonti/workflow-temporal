# Composable Agent Workflow Control Plane Design

## Document Control

| Field | Value |
| --- | --- |
| Title | Composable Agent Workflow Control Plane |
| Status | In Review |
| Rigor level | `R3` |
| Rigor justification | This design introduces a durable internal control plane for agent execution, human approval gates, workflow resumption, execution profile enforcement, and local write containment. It changes agent authorization and capability behavior by restricting tools, skills, MCP access, and protected filesystem writes per step. Failure could resume the wrong workflow, allow a review step to mutate a repository, or hide approval-required work from the operator. Heightened controls are required around execution profile enforcement, queue item integrity, worktree isolation, and rollback. |
| Author(s) | Codex |
| Reviewers | Jason Belmonti; Codex implementation reviewer; independent capability-policy reviewer |
| Decision owner | Jason Belmonti |
| Target milestone or release | Composable workflow MVP |
| Last updated | 2026-04-29 |
| Related docs | Current roadmap conversation on 2026-04-29; `docs/hello-claudex-mvp.md`; `agent-config-registry/docs/zero-dollar-agent-config-registry-design.md`; `agent-config-registry/docs/zero-dollar-agent-config-registry-execution.md` |
| Related tickets | None |

## 0. Executive Summary

Decision requested:
Approve with heightened controls

Problem summary:
Jason is unable to operate the desired long-running multi-skill agent workflow as a composable, low-context-switching system because workflow ordering, gate handling, approval packaging, and agent runtime constraints are not represented as durable typed objects, resulting in manual orchestration, unreliable review-context restriction, and human approvals that cannot be triaged across runs.

Proposed outcome:
A Temporal-backed agent workflow control plane executes pinned declarative recipes, resolves versioned step execution profiles from `agent-config-registry`, turns blocking gates into durable approval queue items, and lets a read-only triage agent package pending decisions for efficient human review.

Why now:
The current project has already proved the bounded Claudex turn boundary, durable workflow state, signal-driven human input, and worktree-friendly execution model; the next architectural decision is whether to harden those primitives into a reusable composable protocol before more one-off workflows accumulate.

Top risks or unknowns:
- RISK-1: Execution profile enforcement could be incomplete, allowing read-only review or triage steps to mutate protected paths or access unnecessary tools.
- RISK-2: Queue item identity or resume correlation could be wrong, causing an approval to resume the wrong workflow, step, or worktree.
- RISK-3: Declarative recipes could become prompt-shaped blobs instead of typed contracts, preventing reliable composition, validation, and triage.

Section status:
Complete

## Layer 1: Problem and Requirements

## 1. Problem Definition

Problem declaration:
Jason's agent execution system is unable to declaratively combine the desired long-term workflow from next-task selection through handoff, simplification, boundary organization, and consensus review because the current implementation exposes only a hard-coded bounded-turn workflow and the sibling registry currently stores skill, agent-instruction, and sync-profile primitives rather than executable workflow recipes, resulting in manual step chaining, high context switching at approval gates, and no enforceable per-step capability boundary.

Affected actors or systems:
Jason as operator and decision owner; Codex and Claudex agent runtimes; `workflow-temporal`; `agent-config-registry`; local git worktrees; Linear and GitHub context sources; Temporal server and UI; local filesystem install targets and working directories.

Current-state baseline:
Estimated current baseline as of 2026-04-29: 1 hard-coded Temporal agent workflow (`agent.helloClaudex`), 2 signals (`submitHumanInput`, `cancelRun`), 1 query (`getHelloClaudexState`), 5 desired happy-path skills, at least 3 gate classes (planning/decomposition, human approval, review rejection), and 2 repositories that must coordinate (`workflow-temporal` and `agent-config-registry`).

Evidence or source:
Direct roadmap conversation on 2026-04-29; `docs/hello-claudex-mvp.md` lines 5-12, 21-23, 181-194, and 215-223; `src/workflows/hello-claudex-contract.ts`; `src/workflows/hello-claudex.ts`; `agent-config-registry/docs/zero-dollar-agent-config-registry-design.md`; `agent-config-registry/src/agent-config-registry/contracts/packages.ts`; `agent-config-registry/src/agent-config-registry/contracts/targets.ts`.

Consequence of inaction:
If this decision is deferred past the next multi-step workflow implementation, step ordering, approval semantics, and tool restrictions will likely harden through bespoke prompt conventions and workflow-specific code by the next implementation milestone.

Decision deadline or trigger:
Before implementing any workflow that composes `linear-next-task`, `handoff-prompt`, `code-simplifier`, `organize-code-boundaries`, and `consensus-review` as more than a manually run sequence.

Section status:
Complete

## 2. Objectives and Non-Objectives

| ID | Statement | Measurement or decision horizon |
| --- | --- | --- |
| OBJ-1 | Define a durable composable workflow protocol that can represent the current five-skill happy path and future step sequences as versioned declarative recipes. | MVP design review is acceptable when the happy path can be represented without hard-coding step order in workflow code. |
| OBJ-2 | Preserve Temporal as the canonical owner of execution state, gate state, and resume state. | MVP implementation review verifies that running workflows use pinned recipe snapshots and do not depend on provider-local sessions for correctness. |
| OBJ-3 | Use `agent-config-registry` as the versioned source for recipes, step definitions, `execution-profile` records, and capability policy metadata. | Registry review verifies cataloged execution profile records can be pinned by digest or commit and validated before use. |
| OBJ-4 | Convert human-required gates into durable approval queue items that can be triaged across workflow runs. | Queue review verifies pending gates can be listed, grouped, approved, rejected, or cancelled without reading provider-local session state. |
| OBJ-5 | Enforce narrow per-step execution profiles, especially read-only review and triage profiles. | Security/capability review verifies consensus review and triage cannot mutate protected worktree paths or receive unnecessary MCP/tool access. |
| NG-1 | This effort will not build a hosted multi-user workflow product. | Out of scope for the composable workflow MVP. |
| NG-2 | This effort will not replace Temporal with a custom scheduler. | Temporal remains the durable orchestration runtime for this project. |
| NG-3 | This effort will not make provider-native session IDs authoritative workflow state. | Provider sessions remain best-effort resume hints only. |
| NG-4 | This effort will not implement a general `AGENTS.md` merge engine. | Whole-file or profile-based agent configuration remains owned by `agent-config-registry` scope decisions. |
| NG-5 | This effort will not require an always-on paid application server for the MVP. | Local Temporal, Git-backed registry state, and local operator workflows remain acceptable for MVP. |

Section status:
Complete

## 3. Stakeholders and Decision Authorities

| Stakeholder or role | Interest | Required action |
| --- | --- | --- |
| Jason Belmonti | Owns the desired UX, approval semantics, workflow policy, and final implementation decision. | Approve |
| Codex implementation agent | Needs executable requirements, package boundaries, and validation gates before implementation. | Review |
| Independent capability-policy reviewer | Reviews tool, skill, MCP, and write-permission restrictions before rollout. | Review |
| Workflow operator | Needs reliable queue triage, clear review packets, and safe resume controls. | Consult |
| `workflow-temporal` maintainer | Owns Temporal workflow contracts, state transitions, activities, queries, and signals. | Review |
| `agent-config-registry` maintainer | Owns registry schema, execution profile validation, catalog generation, and pinned config distribution. | Review |
| GitHub and Linear integrations | Provide external context and work item state for some recipe steps. | Inform |

Decision owner:
Jason Belmonti

Section status:
Complete

## 4. Constraints, Invariants, and Assumptions

| ID | Type | Statement | Source or rationale | Validation or resolution plan |
| --- | --- | --- | --- | --- |
| CON-1 | Invariant | Temporal workflow state is the source of truth for run status, step cursor, gate state, and resume correlation. | `hello-claudex-mvp.md` establishes workflow-owned durable state. | VAL-2, VAL-5, and VAL-8 verify workflow-owned state and resume behavior. |
| CON-2 | Constraint | Temporal workflow code must remain deterministic and must not import Claudex, Codex, Claude SDKs, or registry-fetching code that can change during replay. | Temporal runtime constraint and current MVP boundary. | VAL-2 and VAL-7 inspect imports and replay-safe workflow code. |
| CON-3 | Invariant | Provider session references are resume hints and are not sufficient for correctness. | `hello-claudex-mvp.md` session semantics. | VAL-16 tests resume after missing provider session state by using workflow-owned summaries and artifacts. |
| CON-4 | Constraint | Running workflows must use a recipe snapshot pinned by registry commit, digest, or equivalent immutable identifier. | Prevents nondeterministic execution from live config drift. | VAL-3 verifies pinned recipe snapshot persistence and replay behavior. |
| CON-5 | Constraint | Mutating steps must run in one explicit git worktree per workflow execution. | Local repo safety and retry containment. | VAL-6 verifies worktree allocation and no cross-run path sharing for mutating profiles. |
| CON-6 | Constraint | Read-only execution profiles must prevent writes to protected source, registry, and worktree paths while omitting unnecessary write-capable tools and skills. | Required for consensus review and queue triage safety. | VAL-4 and VAL-10 verify negative write attempts fail. |
| CON-7 | Constraint | `agent-config-registry` remains the versioned source for recipes, step definitions, `execution-profile` records, and capability policies. | The sibling project is intended to store versioned agent configurations. | VAL-1 and VAL-3 verify registry schema and pinning behavior. |
| CON-8 | Constraint | Approval queue records must contain enough context for triage without loading full provider sessions. | Morning review UX requires durable, compact packaging. | VAL-8 and VAL-9 verify queue item and review packet completeness. |
| CON-9 | Constraint | The MVP must operate without a new always-on paid server. | Continues the zero-dollar operating preference from registry design. | VAL-12 verifies no hosted service dependency is introduced. |
| ASM-1 | Assumption | The first implementation can use local Temporal, local filesystem artifacts, and local registry checkouts before a hosted API exists. | Current `workflow-temporal` and registry designs are local-first. | Validate during MVP smoke test before expanding to remote triggers. |
| ASM-2 | Assumption | A typed contract layer around existing skills can be introduced without rewriting each skill body immediately. | Existing skills already have clear workflows and output expectations, but not formal machine contracts. | VAL-1 starts with adapter records for the five known happy-path steps. |
| ASM-3 | Assumption | Queue triage can initially use heuristic grouping by repo, workflow recipe, gate type, risk, and age. | User asked for context-switch minimization or another heuristic. | VAL-9 compares generated grouping against operator review on a seed queue. |

Section status:
Complete

## 5. Requirements

| ID | Type | Priority | Requirement statement | Rationale | Verification |
| --- | --- | --- | --- | --- | --- |
| REQ-1 | Functional | Must | The system shall define workflow recipes as versioned declarative records with ordered steps, typed inputs, typed outputs, execution profile references, and gate policies. | Composition must be data-driven rather than prompt-driven. | VAL-1 |
| REQ-2 | Reliability | Must | The system shall resolve and persist an immutable recipe snapshot before workflow execution starts. | Temporal replay and audit require stable execution inputs. | VAL-3 |
| REQ-3 | Functional | Must | The system shall require each composable step to advertise a stable input contract, output contract, gate contract, and artifact contract. | Gates, triage, and downstream steps require typed outputs. | VAL-1 |
| REQ-4 | Security | Must | The system shall apply a validated execution profile to each step before invoking an agent activity. | Step execution must be restricted by declared capability policy. | VAL-4 |
| REQ-5 | Functional | Must | `workflow-temporal` shall execute recipe steps through bounded activities or child workflows while keeping agent SDK side effects outside deterministic workflow code. | This preserves the current Temporal boundary. | VAL-2 |
| REQ-6 | Functional | Must | The system shall convert every blocking step outcome into a durable approval queue item with a resume target, decision options, artifact references, and compact context summary. | Human-required work must be visible and triageable outside the running agent session. | VAL-8 |
| REQ-7 | Reliability | Must | The system shall resume a blocked workflow only after receiving an explicit decision signal that matches the queue item identifier and expected gate revision. | Approval must not resume the wrong workflow or stale gate state. | VAL-5 |
| REQ-8 | Functional | Must | The queue triage agent shall package pending approval queue items into review packets without mutating workflow state or worktrees. | The morning review agent must reduce context switching without becoming an implicit approver. | VAL-9, VAL-10 |
| REQ-9 | Operability | Must | The system shall isolate mutating workflow execution in one explicit git worktree per workflow run. | Worktree isolation contains retries, review, and rollback. | VAL-6 |
| REQ-10 | Security | Must | Consensus review steps shall run under a read-only execution profile that blocks protected-path writes and excludes unrelated implementation skills. | Review context must be narrower than implementation context. | VAL-4, VAL-10 |
| REQ-11 | Operability | Must | The system shall expose queryable state for runs, steps, gates, queue items, artifacts, and execution profile identifiers. | Operators need direct inspection and recovery paths. | VAL-7, VAL-8 |
| REQ-12 | Reliability | Must | The system shall support cancellation, safe retry of non-mutating steps, and explicit abandonment of blocked workflows without relying on provider-local session continuity. | Recovery cannot depend on local SDK state. | VAL-13, VAL-14, VAL-15, VAL-16 |
| REQ-13 | Compatibility | Must | Registry schema changes shall be versioned so existing pinned recipes remain executable after newer profiles are published. | Long-running workflows must survive registry evolution. | VAL-3, VAL-11 |
| REQ-14 | Performance | Should | Queue triage shall produce review packets for 50 pending items within 5 seconds on the local development machine. | Morning review must remain operationally useful for accumulated gates. | VAL-9 |

Section status:
Complete

## 6. Success Measures and Kill Criteria

| Measure | Baseline | Target or decision threshold | Evaluation date or decision event | Related IDs |
| --- | --- | --- | --- | --- |
| Five-step recipe representation | Current baseline is 0 typed recipes for the five-skill path. | One validated recipe represents `linear-next-task`, `handoff-prompt`, `code-simplifier`, `organize-code-boundaries`, and `consensus-review` without workflow-code step ordering. | MVP design and contract review. | OBJ-1, REQ-1, REQ-3 |
| Gate queue proof | Current baseline is `waiting_for_input` inside one workflow and no cross-run queue. | A fake-run smoke test creates at least 3 queue items across at least 2 workflow runs and resumes the correct blocked step by queue item ID. | MVP smoke test. | OBJ-2, OBJ-4, REQ-6, REQ-7 |
| Capability containment | Current baseline has no registry-enforced read-only review execution profile. | A consensus review step cannot write to protected worktree paths in an automated negative test. | Capability-policy review before implementation acceptance. | OBJ-5, REQ-4, REQ-10 |
| Triage usefulness | Current baseline is manual context switching across gates. | A triage run groups 50 seed queue items into review packets in under 5 seconds and preserves source links for each item. | MVP operator review. | OBJ-4, REQ-8, REQ-14 |
| Kill criterion: prompt-shaped recipes | Current baseline depends on human prompt conventions. | Stop or redesign if a recipe cannot be validated without reading free-form prompt prose. | Before implementation proceeds beyond schema work. | REQ-1, REQ-3 |
| Kill criterion: unenforceable execution profiles | Current baseline has no execution profile enforcement boundary. | Stop or redesign if the runner cannot prove read-only execution profiles block protected-path writes before agent execution. | Before consensus-review automation is allowed. | REQ-4, REQ-10 |

Section status:
Complete

## Layer 1 Exit

Layer 1 status:
Complete

## Layer 2: Functional Specification

## 7. System Context and External Interfaces

System boundary:
The system includes declarative workflow recipe records, registry validation and cataloging for recipes and execution profiles, a Temporal recipe interpreter, bounded agent step activities, durable approval queue state, artifact references, local worktree allocation, and a read-only triage agent. It excludes hosted multi-user workflow UI, public marketplace protocols, and provider-native session storage.

External actors and systems:
Jason as operator; Codex/Claudex agent runtimes; Temporal server and worker; `agent-config-registry`; Linear and GitHub context systems; local filesystem and git worktrees; local CLI or API callers; Temporal UI.

Trust or control boundaries:
Boundary-1 exists between versioned registry configuration and runtime execution. Boundary-2 exists between deterministic Temporal workflow state and side-effectful agent activities. Boundary-3 exists between read-only review/triage profiles and write-capable implementation profiles. Boundary-4 exists between human approval decisions and workflow resume signals. Boundary-5 exists between per-run worktrees and the source repository.

| Interface | Owner | Consumer or dependency | Inputs | Outputs |
| --- | --- | --- | --- | --- |
| Registry recipe catalog | `agent-config-registry` | Workflow starter and recipe resolver | Recipe records, step definitions, execution profiles, validation metadata | Pinned recipe snapshot and execution profile identifiers |
| Temporal workflow API | `workflow-temporal` | CLI, API caller, Temporal UI | Workflow start request, approval decision signals, cancellation signals | Run state, step state, gate state, terminal result |
| Agent step activity | `workflow-temporal` activity runtime | Claudex/Codex/Claude providers | Step request, execution profile, worktree path, prior summary, human input | Step result, gate request, artifact references, provider session hint |
| Approval queue query | `workflow-temporal` | Operator CLI or triage agent | Queue filters, recipe IDs, repo IDs, gate status | Pending queue item summaries and artifact references |
| Triage packet output | Queue triage agent | Jason as operator | Pending queue item summaries and heuristic policy | Grouped review packets with decision targets |
| Local worktree interface | Worktree manager | Agent activities and operator | Repo root, branch base, run ID, write policy | Isolated working directory and cleanup metadata |
| External PM/source context | Linear and GitHub | Step activities using approved execution profiles | Issue, PR, repo, comment, and status reads or writes allowed by execution profile | Source-grounded task context and review evidence |

Section status:
Complete

## 8. Operational Scenarios and Functional Behavior

| ID | Trigger | Preconditions | Behavior or outcome | Related requirements |
| --- | --- | --- | --- | --- |
| FLOW-1 | Operator starts a recipe-backed agent run. | A recipe exists in the registry and validates against the supported schema version. | The caller observes a Temporal run with a pinned recipe snapshot, initial step state, execution profile references, and queryable run metadata. | REQ-1, REQ-2, REQ-5, REQ-11 |
| FLOW-2 | A step returns a blocking gate request. | The workflow is running and the step contract permits that gate type. | The operator observes a durable approval queue item with decision options, artifact references, compact context, and the workflow state moves to a blocked gate state. | REQ-3, REQ-6, REQ-11 |
| FLOW-3 | Operator approves or rejects a pending gate. | The queue item is still open and the decision signal references the current gate revision. | The workflow either resumes the next permitted step, branches according to the recipe, or records a rejected/cancelled terminal or blocked state. | REQ-7, REQ-12 |
| FLOW-4 | Morning triage starts. | At least one pending queue item exists. | The triage agent returns grouped review packets ordered by declared heuristic and performs no writes to workflow state, registry state, or worktrees. | REQ-8, REQ-11, REQ-14 |
| FLOW-5 | Consensus review step runs. | The recipe step references the read-only consensus review execution profile. | The step runs with review-only skills/tools and protected-path write attempts fail before any worktree mutation is committed. | REQ-4, REQ-10 |
| FLOW-6 | A registry execution profile is updated while a workflow is running. | The workflow already stored a pinned recipe snapshot. | The running workflow continues with the pinned snapshot and new runs may use the newer execution profile after validation. | REQ-2, REQ-13 |
| FUNC-1 | Recipe validation is requested. | Registry content is available locally or from an accepted commit. | The caller receives pass/fail validation with specific errors for missing step contracts, execution profile references, gate policies, or schema versions. | REQ-1, REQ-3, REQ-13 |
| FUNC-2 | Run state is queried. | A workflow execution exists. | The caller receives current run status, active step, gate state, queue item IDs, artifacts, worktree path, and execution profile identifiers. | REQ-11 |
| FUNC-3 | Queue items are listed. | Queue state exists in Temporal or its durable projection. | The caller receives open, approved, rejected, cancelled, and resolved item summaries with resume correlation metadata plus any derived review packet references. | REQ-6, REQ-11 |
| FUNC-4 | A read-only execution profile is applied. | The step declares a read-only execution profile. | The activity runner refuses write-capable tools and rejects protected-path write attempts before they affect the active worktree. | REQ-4, REQ-10 |

Section status:
Complete

## 9. State Model, Faults, and Misuse Cases

States and transitions:
Recipe state transitions are `draft` -> `validated` -> `published` -> `pinned snapshot` -> `superseded`. Run state transitions are `created` -> `running` -> `waiting_on_gate` -> `running` -> `completed`, `failed`, `cancelled`, or `abandoned`. Step state transitions are `pending` -> `running` -> `completed`, `blocked`, `failed`, `cancelled`, or `skipped`. Queue item state transitions are `open` -> `approved`, `rejected`, `cancelled`, or `resolved`; `packaged` is not a queue item state. Review packet state transitions are `draft` -> `presented` -> `superseded`. Triage writes only derived review packet artifacts that reference still-open queue item IDs and never mutates queue item status, gate revision, or workflow state.

| Scenario | Expected behavior | Invariant maintained | Related IDs |
| --- | --- | --- | --- |
| Fault-1 | Registry is unavailable after a workflow starts. | The workflow continues using the pinned recipe snapshot or fails only when a new run cannot resolve a recipe. | Running workflows do not depend on live registry reads. | REQ-2, REQ-13, FUNC-1 |
| Fault-2 | Provider session resume fails. | The activity starts from workflow-owned objective, summary, human inputs, and artifact references. | Provider sessions remain non-authoritative hints. | REQ-12, FLOW-3 |
| Fault-3 | Approval signal references a stale gate revision. | The workflow rejects the signal and keeps the queue item open or records a stale-decision audit event. | A decision cannot resume the wrong gate state. | REQ-7, FUNC-3 |
| Fault-4 | Triage packet generation fails halfway. | Queue items remain open, any partial packet artifact is discarded or superseded, and no workflow resumes. | Triage has no implicit approval power. | REQ-8, FLOW-4 |
| Fault-5 | A mutating step fails after modifying the run worktree. | The run records failure artifacts and keeps changes isolated in the per-run worktree for inspection or cleanup. | Source repo and other runs remain untouched. | REQ-9, REQ-12 |
| Fault-6 | A non-mutating step fails with a retryable provider or startup error. | The workflow retries according to the pinned retry policy and records each attempt without changing protected paths. | Safe retries are limited to non-mutating execution profiles unless idempotency is explicitly declared. | REQ-12 |
| Fault-7 | Operator abandons a blocked workflow. | The workflow records `abandoned`, closes the queue item, and rejects later decisions for that gate revision. | Abandoned gates cannot resume after operator intent changes. | REQ-12, FUNC-3 |
| Misuse-1 | A recipe assigns an implementation-write execution profile to a consensus review step. | Registry validation fails or capability-policy review blocks publication. | Review steps must use read-only capability boundaries. | REQ-4, REQ-10, FUNC-1 |
| Misuse-2 | A triage agent attempts to approve a queue item. | The system rejects the action because triage profile lacks approval-signal authority. | Human approval remains explicit. | REQ-7, REQ-8 |
| Misuse-3 | A recipe uses free-form prompt text as the only downstream output. | Validation fails because the step lacks typed output and gate contracts. | Composition depends on typed contracts. | REQ-1, REQ-3 |

Section status:
Complete

## 10. External Service Levels and Acceptance Cases

External service expectations:
The MVP is local-first. Querying an active run or pending queue should complete within 2 seconds for 50 active runs on the local development machine. Triage should produce review packets for 50 pending queue items within 5 seconds. A gate emitted by a completed step should be queryable within 30 seconds of activity completion. Read-only execution profile protected-path write attempts must leave the active worktree unchanged.

| ID | Acceptance case | Expected result | Covers |
| --- | --- | --- | --- |
| ACC-1 | A five-step happy-path recipe is validated from registry content. | Validation passes and reports step IDs, execution profiles, input/output contracts, and gate policies. | REQ-1, REQ-3, FUNC-1 |
| ACC-2 | A workflow starts from a pinned recipe and the registry execution profile changes before step 2. | The running workflow continues with the original snapshot and records the snapshot identifier in query state. | REQ-2, REQ-13, FLOW-6 |
| ACC-3 | A fake step returns an approval gate. | A queue item appears with resume target, decision options, context summary, and artifact references. | REQ-6, FLOW-2, FUNC-3 |
| ACC-4 | A stale approval decision is submitted after a newer gate revision exists. | The decision is rejected and the workflow remains blocked on the current queue item. | REQ-7, Fault-3 |
| ACC-5 | A consensus review step attempts to write under a protected worktree path while using a read-only execution profile. | The write attempt fails and the worktree contents remain unchanged. | REQ-4, REQ-10, FLOW-5, FUNC-4 |
| ACC-6 | A triage run packages 50 pending queue items. | Review packets are returned within 5 seconds, reference still-open queue item IDs, and no queue item is approved, rejected, or otherwise state-mutated by triage. | REQ-8, REQ-14, FLOW-4 |
| ACC-7 | A mutating implementation step fails after edits. | The failed run preserves artifacts and worktree changes under the run worktree without touching other worktrees. | REQ-9, REQ-12, Fault-5 |
| ACC-8 | A provider session reference is unavailable on resume. | The next bounded turn still starts from workflow-owned state and records a new session hint if available. | REQ-12, Fault-2 |
| ACC-9 | Run state is queried while waiting on a gate. | The query returns active recipe snapshot, step status, queue item ID, gate type, artifacts, and execution profile identifiers. | REQ-11, FUNC-2 |
| ACC-10 | An active step is cancelled while an activity is running. | The runner receives cancellation, records cancelled status, stops scheduling subsequent steps, and leaves any protected-path diff attached as an artifact. | REQ-12 |
| ACC-11 | A non-mutating step fails with a retryable startup error. | The workflow retries according to the pinned retry policy and records bounded attempts without changing protected paths. | REQ-12, Fault-6 |
| ACC-12 | A blocked workflow is abandoned before a decision is submitted. | The queue item closes, the workflow records `abandoned`, and later approval or rejection signals for that gate revision are rejected. | REQ-12, Fault-7 |

Section status:
Complete

## 11. Requirements-to-Behavior Traceability

| Requirement | Functional behaviors or flows | Acceptance coverage | Notes |
| --- | --- | --- | --- |
| REQ-1 | FLOW-1, FUNC-1 | ACC-1 | Recipe records are the composition surface. |
| REQ-2 | FLOW-1, FLOW-6 | ACC-2 | Snapshot pinning preserves Temporal determinism. |
| REQ-3 | FLOW-2, FUNC-1 | ACC-1, ACC-3 | Step contracts are required for downstream composition and gates. |
| REQ-4 | FLOW-5, FUNC-4 | ACC-5 | Execution profiles are enforced before agent execution. |
| REQ-5 | FLOW-1 | ACC-2 | The existing bounded activity model is retained. |
| REQ-6 | FLOW-2, FUNC-3 | ACC-3, ACC-9 | Queue items are first-class gate records. |
| REQ-7 | FLOW-3, FUNC-3 | ACC-4 | Gate revision matching prevents stale resume. |
| REQ-8 | FLOW-4 | ACC-6 | Triage packages work but does not approve work. |
| REQ-9 | FLOW-1 | ACC-7 | Mutating runs are isolated in worktrees. |
| REQ-10 | FLOW-5, FUNC-4 | ACC-5 | Consensus review uses read-only execution profile restrictions. |
| REQ-11 | FUNC-2, FUNC-3 | ACC-9 | Query state supports operator inspection. |
| REQ-12 | FLOW-3 | ACC-7, ACC-8, ACC-10, ACC-11, ACC-12 | Recovery does not depend on provider-local state. |
| REQ-13 | FLOW-6, FUNC-1 | ACC-2 | Registry evolution must not break pinned runs. |
| REQ-14 | FLOW-4 | ACC-6 | Triage performance has a local bound. |

Section status:
Complete

## Layer 2 Exit

Layer 2 status:
Complete

## Layer 3: Technical Specification

## 12. Architecture Overview

Architecture summary:
The architecture is a local-first control plane with `agent-config-registry` publishing validated declarative workflow recipes and execution profiles, and `workflow-temporal` executing a pinned recipe snapshot through a deterministic Temporal interpreter. Agent execution remains inside bounded activities or child workflows. Blocking outcomes produce durable queue items. A read-only triage agent reads pending queue items and emits review packets for the operator.

Major components and boundaries:
Major components are the registry recipe/execution-profile schema, registry validator/catalog, recipe resolver, Temporal recipe interpreter, step activity runner, execution profile enforcement layer, worktree manager, artifact store, approval queue model, approval signal handler, and queue triage packager. Boundaries are registry config versus execution state, deterministic workflow code versus side-effectful activities, read-only execution profiles versus write-capable execution profiles, queue presentation versus approval authority, and run worktree versus source repository.

Deployment or runtime placement:
Registry validation and catalog generation run in the sibling `agent-config-registry` repository. Temporal workflows, activities, queue state, and queries run in `workflow-temporal`. Claudex/Codex/Claude execution runs only from Node activity processes. Worktree and artifact files live on the local filesystem. Triage runs as a read-only activity, CLI command, or separate agent invocation using queue query output.

Architecture rationale:
This satisfies REQ-1 through declarative recipe records, REQ-2 through pinned snapshots, REQ-5 through the existing bounded activity boundary, REQ-6 and REQ-7 through queue items plus signals, REQ-8 through read-only packet generation, and REQ-10 through execution profile enforcement.

Section status:
Complete

## 13. Technical Mechanisms and Allocation

| ID | Mechanism | Component or owner | Responsibility | Related behaviors |
| --- | --- | --- | --- | --- |
| TECH-1 | `WorkflowRecipe` schema | `agent-config-registry` | Define recipe ID, version, steps, transitions, gate policies, execution profile references, and supported schema version. | FUNC-1, FLOW-1 |
| TECH-2 | `StepDefinition` contract records | `agent-config-registry` | Define stable step input, output, artifact, and gate contract metadata. | FUNC-1, FLOW-2 |
| TECH-3 | `ExecutionProfile` and capability policy schema | `agent-config-registry` | Define a new non-installable `execution-profile` registry record, distinct from the existing sync `profile` package kind, with allowed skills, tools, MCP access, provider options, protected-path policy, approval authority, retry class, and enforcement mode. | FUNC-1, FUNC-4, FLOW-5 |
| TECH-4 | Recipe resolver and snapshot builder | `workflow-temporal` client or starter | Resolve registry content to an immutable recipe snapshot before starting a run. | FLOW-1, FLOW-6 |
| TECH-5 | Temporal recipe interpreter | `workflow-temporal` workflow code | Execute step graph deterministically from stored snapshot, step states, and signal events. | FLOW-1, FLOW-3 |
| TECH-6 | Step activity runner | `workflow-temporal` activities | Invoke one bounded agent step with execution profile, worktree path or read-only bundle path, prior state, and timeout/cancellation controls. | FLOW-5, FUNC-4 |
| TECH-7 | Execution profile enforcement adapter | Activity runtime | Fail closed when an execution profile is missing or invalid; materialize an `AgentExecutionContext`; deny disallowed skills, tools, MCP servers, and approval-signal authority before launch; for read-only execution profiles, pass no mutable worktree path, expose only a generated read-only review bundle plus runner-owned artifact output, and compare protected paths after the turn. | FUNC-4, FLOW-5 |
| TECH-8 | Approval queue model | `workflow-temporal` workflow state or durable projection | Store queue item identity, gate revision, resume target, decision options, compact context, and artifact refs. | FLOW-2, FUNC-3 |
| TECH-9 | Approval signal handler | `workflow-temporal` workflow code | Validate queue item ID, gate revision, decision type, and workflow status before resuming. | FLOW-3, FUNC-3 |
| TECH-10 | Queue triage packager | Read-only triage agent or activity | Group queue items by repo, recipe, gate type, risk, dependency, age, or operator heuristic. | FLOW-4 |
| TECH-11 | Worktree manager | Activity runtime or workflow starter | Allocate, label, inspect, and clean one run worktree for mutating execution profiles. | FLOW-1 |
| TECH-12 | Artifact store and artifact references | Activity runtime | Persist step logs, summaries, review packets, and gate context under run-scoped paths. | FUNC-2, FUNC-3 |

Section status:
Complete

## 14. Data, Schemas, and Compatibility

| Change | Type | Compatibility impact | Reversibility | Mitigation |
| --- | --- | --- | --- | --- |
| Add `workflow-recipe` registry records | Schema / Config | New registry package kind or catalog record type must be ignored by older registry clients or gated by schema version. | Reversible | Use schema versioning, feature flags, and validation that rejects unsupported recipe versions. |
| Add `step-definition` records | Schema / Config | Existing skill packages remain unchanged; step definitions reference skills and adapter contracts. | Reversible | Keep step definitions additive and validate references before publication. |
| Add `execution-profile` registry records | Schema / Config | Existing `profile` package kind remains a sync manifest for install targets; `execution-profile` is a separate non-installable record kind used only for agent runtime capability policy. | Reversible | Add schema-versioned catalog support for `execution-profile`, reject recipes that reference sync profiles as execution profiles, and keep existing package-kind compatibility tests unchanged except for explicit unsupported-kind behavior. |
| Add recipe snapshot to workflow input/state | API / Data | Workflow start contract changes for recipe-backed runs while `agent.helloClaudex` can remain as legacy MVP path. | Reversible | Introduce a new workflow type for recipe-backed runs instead of mutating the existing workflow contract in place. |
| Add approval queue item contract | Data / API | New query and signal payloads must remain versioned for long-running workflows. | Reversible | Include queue item version and gate revision in every queue item and decision signal. |
| Add review packet artifact contract | Data | Triage output becomes a durable artifact referenced by queue item IDs. | Reversible | Store packets as derived artifacts that can be regenerated from queue state. |

Section status:
Complete

## 15. Control Logic and Non-Functional Controls

Control logic summary:
A workflow start request resolves a registry recipe to an immutable snapshot, allocates or receives a worktree according to execution profile requirements, and starts a Temporal recipe interpreter. The interpreter schedules one step at a time unless the recipe explicitly declares fanout. Each step activity receives only the step input, pinned execution profile, worktree or read-only bundle path, prior summaries, and artifact refs needed for that step. Completed steps advance the recipe cursor. Blocked steps create approval queue items. Decision signals are accepted only when queue item ID and gate revision match the active blocked state.

Concurrency and ordering model:
The MVP default is sequential execution. Fanout is allowed only for explicitly declared subworkflows such as consensus review. A queue item has one active gate revision. A decision can affect only the workflow execution and gate revision named in the signal. Triage may read many queue items concurrently but has no write authority over workflow state.

Failure recovery model:
Read-only steps may be retried according to declared retry policy. Mutating steps use conservative retry defaults and preserve artifacts and worktree state after failure. Cancellation stops the active activity through the existing cancellation boundary. Provider session loss triggers fresh-session fallback when workflow-owned state is sufficient. Queue item projection can be rebuilt from workflow state and artifacts if derived storage is lost.

Execution profile enforcement model:
Capability enforcement is not prompt-based. Registry validation rejects recipes whose step type is incompatible with the referenced `execution-profile` record. The activity runner accepts only execution profile IDs and digests from the pinned recipe snapshot, constructs an `AgentExecutionContext`, and fails closed before provider launch when an allowlist, MCP server, skill, approval authority, or filesystem policy is absent or incompatible. Read-only execution profiles receive no mutable worktree path and cannot expose shell, editor, patch, filesystem-write, mutation-capable MCP, worker-agent, or approval-signal capabilities. They operate from a generated review bundle and runner-owned artifact output path; the runner records and compares protected source, registry, and worktree paths before and after execution. Any protected-path diff under a read-only execution profile fails the step and triggers the rollback containment path. Mutating execution profiles are the only profiles allowed to receive a run worktree and write-capable tools.

| Requirement | Mechanism | Notes |
| --- | --- | --- |
| REQ-1 | TECH-1 | Recipe validation proves the composition surface is structured data. |
| REQ-2 | TECH-4, TECH-5 | Snapshot is stored before workflow scheduling begins. |
| REQ-3 | TECH-2 | Step definitions prevent untyped prompt-only composition. |
| REQ-4 | TECH-3, TECH-7 | Execution profile enforcement occurs before agent invocation. |
| REQ-5 | TECH-5, TECH-6 | Workflow code orchestrates; activity code performs side effects. |
| REQ-6 | TECH-8, TECH-12 | Queue items contain resume and review context. |
| REQ-7 | TECH-9 | Gate revision checks prevent stale decision application. |
| REQ-8 | TECH-10 | Triage reads queue state and writes only derived review packet artifacts. |
| REQ-9 | TECH-11 | Mutating execution profile execution requires a per-run worktree. |
| REQ-10 | TECH-3, TECH-7 | Consensus review execution profile declares and enforces read-only behavior. |
| REQ-11 | TECH-5, TECH-8, TECH-12 | Query state includes workflow, step, gate, queue, and artifact metadata. |
| REQ-12 | TECH-5, TECH-6, TECH-8, TECH-9, TECH-11 | Recovery uses workflow state, queue state, cancellation signals, retry policy, and isolated worktrees. |
| REQ-13 | TECH-1, TECH-4 | Versioned schema and pinned snapshots preserve compatibility. |
| REQ-14 | TECH-10 | Triage packager is bounded and testable against seed queues. |

Section status:
Complete

## 16. Observability, Operations, Rollout, and Rollback

| Signal | Type | Purpose | Consumer |
| --- | --- | --- | --- |
| Run state query result | Audit | Shows recipe snapshot, current step, workflow status, worktree or read-only bundle path, and execution profile identifiers. | Operator and triage tooling |
| Queue item count by status | Metric | Detects gate backlog and blocked work accumulation. | Operator |
| Step transition log | Audit | Records pending, running, completed, blocked, failed, skipped, and cancelled transitions. | Operator and reviewer |
| Execution profile enforcement failure | Log / Audit | Proves blocked write/tool attempts and execution profile validation failures. | Capability-policy reviewer |
| Approval decision audit event | Audit | Records queue item ID, gate revision, decision type, actor, and workflow result. | Operator and reviewer |
| Worktree allocation record | Audit | Maps workflow run to worktree path, base ref, branch, and cleanup state. | Operator |
| Triage packet artifact | Audit | Records grouping heuristic, included queue item IDs, and generated review packet path. | Operator |

Rollout plan:
Phase 1 defines registry schemas and validation for recipes, step definitions, and `execution-profile` records using fake steps only. Phase 2 adds a new recipe-backed Temporal workflow that runs fake activities, emits queue items, and resumes by decision signal. Phase 3 adds worktree allocation and execution profile enforcement for fake write/read-only steps. Phase 4 adapts the five known skills into typed step definitions. Phase 5 enables read-only queue triage and consensus review packaging. Phase 6 runs live opt-in smoke tests against local provider auth and local worktrees.

Rollback or containment plan:
Rollback trigger is any failed capability-policy negative test, stale gate resume defect, queue item identity collision, or unintended protected-path write from a read-only execution profile. Rollback action is to disable recipe-backed workflow starts, keep existing `agent.helloClaudex` MVP workflow available, preserve run worktrees for inspection, and revert registry recipe or execution profile publication to the last validated commit. Reversibility is strong for schema additions and workflow type additions because running recipe-backed workflows can be cancelled or abandoned without changing the legacy workflow path. If CND-1 resolves to evolving `agent.helloClaudex` in place, implementation cannot proceed until an equivalent rollback path preserves the last validated bounded-turn workflow behavior.

Operator actions:
Operators can start a recipe-backed run, query run state, list queue items, generate triage packets, approve or reject queue items, cancel active runs, abandon blocked runs, inspect run artifacts, inspect run worktrees, and disable new recipe-backed starts by removing or pinning the registry execution profile used by the starter.

Section status:
Complete

## 17. Verification Strategy and Behavior-to-Mechanism Traceability

| ID | Verification method | What is verified | Related IDs |
| --- | --- | --- | --- |
| VAL-1 | Test / Inspection | Registry validation accepts the five-step happy-path recipe and rejects missing step contracts, missing execution profiles, unsupported schema versions, sync-profile misuse, and prompt-only outputs. | REQ-1, REQ-3, REQ-13, FUNC-1, TECH-1, TECH-2, TECH-3 |
| VAL-2 | Test / Inspection | Workflow code remains deterministic and agent SDK execution stays inside activities or child workflows. | REQ-5, CON-2, TECH-5, TECH-6 |
| VAL-3 | Test | Workflow start persists a pinned recipe snapshot and running workflows ignore later registry changes. | REQ-2, REQ-13, FLOW-6, TECH-4 |
| VAL-4 | Test / Security review | Execution profile enforcement blocks disallowed tools, MCP access, implementation skills, approval authority, and protected-path writes for read-only execution profiles. | REQ-4, REQ-10, FUNC-4, TECH-3, TECH-7 |
| VAL-5 | Test | Approval decision signals resume only matching workflow execution, queue item ID, and gate revision. | REQ-7, FLOW-3, TECH-9 |
| VAL-6 | Test / Inspection | Mutating runs allocate one explicit worktree and do not share active worktrees across runs. | REQ-9, TECH-11 |
| VAL-7 | Test / Manual | Run state queries expose recipe, step, gate, queue, artifact, worktree or read-only bundle, and execution profile metadata. | REQ-11, FUNC-2, TECH-5, TECH-8, TECH-12 |
| VAL-8 | Test | Blocking step outcomes produce durable queue items with required review and resume fields. | REQ-6, REQ-11, FLOW-2, FUNC-3, TECH-8 |
| VAL-9 | Test / Operator review | Triage packages 50 pending queue items within 5 seconds and preserves source links and decision targets. | REQ-8, REQ-14, FLOW-4, TECH-10 |
| VAL-10 | Negative test / Security review | Triage and consensus review execution profiles cannot approve gates or mutate protected source, registry, or worktree paths. | REQ-8, REQ-10, TECH-3, TECH-7, TECH-10 |
| VAL-11 | Compatibility test | New registry schema records are versioned and older pinned recipe snapshots remain executable. | REQ-13, TECH-1, TECH-4 |
| VAL-12 | Inspection | MVP rollout introduces no always-on hosted service dependency. | CON-9 |
| VAL-13 | Test | Active step cancellation propagates to the activity runner, records cancelled status, stops subsequent scheduling, and preserves protected-path diff artifacts. | REQ-12, TECH-5, TECH-6 |
| VAL-14 | Test | Non-mutating steps retry only according to pinned retry policy, while mutating steps do not auto-retry unless idempotency is explicitly declared. | REQ-12, TECH-3, TECH-5, TECH-6 |
| VAL-15 | Test | Abandoning a blocked workflow closes the queue item, records `abandoned`, and rejects later decisions for that gate revision. | REQ-12, TECH-8, TECH-9 |
| VAL-16 | Test | Provider-session loss resumes from workflow-owned objective, summaries, human inputs, and artifact references rather than provider-local session state. | REQ-12, CON-3, TECH-5, TECH-6 |
| VAL-17 | Rollback drill / Inspection | A failed capability-policy or stale-resume gate blocks launch, recipe-backed starts can be disabled, existing `agent.helloClaudex` behavior remains runnable, failed run worktrees are preserved, and registry recipe or execution profile publication can be reverted to the last validated commit. | HC-4, CND-1 |

| Behavior or requirement | Mechanisms | Verification |
| --- | --- | --- |
| REQ-1 | TECH-1 | VAL-1 |
| REQ-2 | TECH-4, TECH-5 | VAL-3 |
| REQ-3 | TECH-2 | VAL-1 |
| REQ-4 | TECH-3, TECH-7 | VAL-4, VAL-10 |
| REQ-5 | TECH-5, TECH-6 | VAL-2 |
| REQ-6 | TECH-8, TECH-12 | VAL-8 |
| REQ-7 | TECH-9 | VAL-5 |
| REQ-8 | TECH-10 | VAL-9, VAL-10 |
| REQ-9 | TECH-11 | VAL-6 |
| REQ-10 | TECH-3, TECH-7 | VAL-4, VAL-10 |
| REQ-11 | TECH-5, TECH-8, TECH-12 | VAL-7, VAL-8 |
| REQ-12 | TECH-5, TECH-6, TECH-8, TECH-9, TECH-11 | VAL-13, VAL-14, VAL-15, VAL-16 |
| REQ-13 | TECH-1, TECH-4 | VAL-3, VAL-11 |
| REQ-14 | TECH-10 | VAL-9 |
| Rollback control | TECH-1, TECH-3, TECH-4, TECH-5, TECH-11 | VAL-17 |
| FUNC-1 | TECH-1, TECH-2, TECH-3 | VAL-1, VAL-11 |
| FUNC-2 | TECH-5, TECH-8, TECH-12 | VAL-7 |
| FUNC-3 | TECH-8, TECH-9 | VAL-5, VAL-8 |
| FUNC-4 | TECH-3, TECH-7 | VAL-4, VAL-10 |

Section status:
Complete

## 18. Alternatives, Risks, Open Questions, and Final Exit

Alternatives considered:

| Alternative | Reason considered | Reason rejected |
| --- | --- | --- |
| ALT-1: Manually chained skills | Lowest initial implementation work. | It preserves high context switching and cannot enforce per-step capability policy. |
| ALT-2: One large prompt for the whole happy path | Appears simple and keeps orchestration inside one agent turn. | It makes gates, contracts, retries, triage, and execution profile enforcement opaque. |
| ALT-3: Store live queue state in `agent-config-registry` | Keeps workflow-related data in one Git-backed place. | The registry is appropriate for versioned configuration, not fast-changing workflow state. |
| ALT-4: Build a hosted workflow service immediately | Could provide a richer UX sooner. | The existing local Temporal and zero-dollar registry direction is sufficient to prove the control-plane model. |

Risks:

| ID | Statement | Likelihood | Consequence | Mitigation |
| --- | --- | --- | --- | --- |
| RISK-1 | Execution profile enforcement could be incomplete. | Medium | High | Use deny-by-default execution profiles, negative write tests, and independent capability-policy review before enabling review automation. |
| RISK-2 | Queue item identity or resume correlation could be wrong. | Medium | High | Use gate revision IDs, workflow execution IDs, decision audit events, and stale-decision negative tests. |
| RISK-3 | Recipes could become prompt-shaped blobs. | Medium | Medium | Make registry validation reject recipes without typed step contracts, output contracts, and gate policies. |
| RISK-4 | Triage heuristics could optimize the wrong grouping. | Medium | Low | Store grouping rationale in review packet artifacts and keep heuristic configuration explicit. |
| RISK-5 | Mutating steps could leave worktrees dirty after failure. | Medium | Medium | Require one worktree per run, preserved failure artifacts, and explicit abandon/cleanup operator actions. |

Open questions:

| ID | Question | Owner | Due date | Resolution plan |
| --- | --- | --- | --- | --- |
| Q-1 | Should queue state live only in Temporal workflow histories and queries, or should a derived local queue index be maintained for faster triage? | `workflow-temporal` maintainer | Before Phase 3 | Prototype both with 50 seed queue items during Phase 2 and choose the least stateful option that meets REQ-14. |
| Q-2 | Should `consensus-review` be represented as one step with fanout internals or as a recipe subworkflow using fanout and aggregate primitives? | Decision owner | Before Phase 4 | Compare contract clarity during step-definition design and choose before adapting the real skill. |

Waivers: none

Final readiness statement:
Ready with heightened controls

Section status:
Complete

## Final Consistency Gate

The problem is current and evidenced by the existing hard-coded workflow and the desired five-skill roadmap. Requirements define declarative recipes, pinned snapshots, typed step contracts, execution profile enforcement, queue items, triage packets, worktree isolation, and recovery. Layer 2 defines externally observable start, gate, resume, triage, execution profile, and registry-change behaviors. Layer 3 allocates mechanisms across `agent-config-registry`, `workflow-temporal`, activity runtime, worktree manager, artifact store, and triage packager. Verification covers the highest-risk claims: execution profile enforcement, stale approval rejection, pinned snapshots, cancellation, retry, abandonment, provider-session fallback, worktree isolation, rollback, and no hosted dependency.

## Internal Review Record

| Field | Value |
| --- | --- |
| Document | Composable Agent Workflow Control Plane |
| Review date | 2026-04-29 |
| Moderator | Codex |
| Decision owner | Jason Belmonti |
| Proposed rigor level | `R3` |
| Reviewed rigor level | `R3` |
| Calibration result | Accept |
| Structural result | Pass after consensus revision |
| Semantic result | Pass after consensus revision |
| Traceability result | Pass after consensus revision |
| Verdict | Draft is ready for human review; requested decision remains `Approve with heightened controls` |
| Open findings | none |
| Resolved findings verified in this decision | ST-1, SM-1, TR-1, CR-1, CR-2, CR-3, PR-1, PR-2 |
| Reviewed waivers | none |
| Required heightened controls | HC-1, HC-2, HC-3, HC-4 |
| Approval conditions | CND-1, CND-2 |
| Top blockers | none |
| Required follow-ups | Resolve Q-1 and Q-2 before implementation reaches their named phase gates. |

### Review Findings Addressed

| Finding ID | Severity | Status | Section | Finding | Required action | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| ST-1 | Major | Resolved | 5, 11, 17 | Initial draft risked treating execution profiles as implementation detail rather than binding requirements. | Add explicit requirements and traceability for execution profile enforcement and read-only consensus review. | Codex |
| SM-1 | Major | Resolved | 9, 15, 16 | Initial draft needed stronger stale approval and wrong-resume controls. | Add gate revision, decision signal validation, stale-decision fault case, and verification. | Codex |
| TR-1 | Major | Resolved | 11, 17 | Initial draft had incomplete mapping from triage behavior to verification. | Add VAL-9, VAL-10, ACC-6, and mapping rows for REQ-8 and REQ-14. | Codex |
| CR-1 | Major | Resolved | 13, 15, 17 | Consensus review found the runtime enforcement boundary too generic for R3. | Define `ExecutionProfile`, specify fail-closed launch enforcement, read-only bundle behavior, protected-path diff checks, denied capabilities, and negative verification. | Codex |
| CR-2 | Major | Resolved | 10, 11, 17 | Consensus review found REQ-12 verification coverage incomplete. | Add recovery fault cases, ACC-10 through ACC-12, VAL-13 through VAL-16, and updated traceability for cancellation, retry, abandonment, and provider-session fallback. | Codex |
| CR-3 | Major | Resolved | 13, 14 | Consensus review found runtime profiles ambiguous relative to existing registry sync profiles. | Rename the capability record to `ExecutionProfile` and define `execution-profile` as a separate non-installable registry record distinct from the existing sync `profile` package kind. | Codex |
| PR-1 | Major | Resolved | 8, 9, 10 | PR review found queue packaging ambiguous relative to read-only triage and open-item approval. | Remove `packaged` as a queue item state and define review packet packaging as derived artifact metadata that references still-open queue item IDs without mutating workflow state. | Codex |
| PR-2 | Major | Resolved | 16, 17 | PR review found rollback named as a heightened control without verification coverage. | Add rollback drill verification, rollback traceability, HC-4, and a CND-1 guard for preserving equivalent legacy bounded-turn behavior. | Codex |

### Heightened Controls

| Control ID | Applies through | Control | Owner | Verification |
| --- | --- | --- | --- | --- |
| HC-1 | Implementation / Launch | Execution profiles use deny-by-default tool, skill, MCP, approval-authority, and protected-path write policy enforcement. | `agent-config-registry` maintainer and activity runtime owner | VAL-4, VAL-10 |
| HC-2 | Implementation / Launch | Approval resume requires workflow execution ID, queue item ID, and gate revision match. | `workflow-temporal` maintainer | VAL-5 |
| HC-3 | Implementation / Launch | Mutating steps require one explicit worktree per run and preserve failed worktrees for inspection. | Activity runtime owner | VAL-6 |
| HC-4 | Implementation / Launch | Recipe-backed starts must have a tested rollback path: disable new recipe-backed starts, preserve failed worktrees, keep or prove equivalent legacy bounded-turn behavior, and revert registry recipe or execution profile publication to the last validated commit. | `workflow-temporal` maintainer and `agent-config-registry` maintainer | VAL-17 |

### Approval Conditions

| Condition ID | Required before | Condition | Owner |
| --- | --- | --- | --- |
| CND-1 | Implementation start | Approve whether the recipe-backed workflow is a new workflow type or an evolution of `agent.helloClaudex`; default recommendation is a new workflow type. | Jason Belmonti |
| CND-2 | Launch | Independent capability-policy reviewer signs off on read-only execution profile negative tests. | Independent capability-policy reviewer |
