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
| Last updated | 2026-05-31 |
| Related docs | Current roadmap conversation on 2026-04-29; `docs/hello-claudex-mvp.md`; `agent-config-registry/docs/zero-dollar-agent-config-registry-design.md`; `agent-config-registry/docs/zero-dollar-agent-config-registry-execution.md` |
| Related tickets | BEL-910, BEL-1264 (Q-6) |

## 0. Executive Summary

Decision requested:
Approve with heightened controls

Problem summary:
Jason is unable to operate the desired long-running multi-skill agent workflow as a composable, low-context-switching system because workflow ordering, gate handling, approval packaging, and agent runtime constraints are not represented as durable typed objects, resulting in manual orchestration, unreliable review-context restriction, and human approvals that cannot be triaged across runs.

Proposed outcome:
A Temporal-backed agent workflow control plane executes pinned declarative recipes, resolves versioned step execution profiles from `agent-config-registry`, uses registry-derived project-shape transition metadata to prove which recipe steps compose, turns blocking gates into durable approval queue items, and lets a read-only triage agent package pending decisions for efficient human review.

Why now:
The current project has already proved the bounded Claudex turn boundary, durable workflow state, interactive human input, and worktree-friendly execution model; the next architectural decision is whether to harden those primitives into a reusable composable protocol before more one-off workflows accumulate.

Top risks or unknowns:
- RISK-1: Execution profile enforcement could be incomplete, allowing read-only review or triage steps to mutate protected paths or access unnecessary tools.
- RISK-2: Queue item identity or resume correlation could be wrong, causing an approval to resume the wrong workflow, step, or worktree.
- RISK-3: Declarative recipes could become prompt-shaped or project-shape-blind blobs instead of typed contracts, preventing reliable composition, bounded loops, validation, and triage.

Section status:
Complete

## Layer 1: Problem and Requirements

## 1. Problem Definition

Problem declaration:
Jason's agent execution system is unable to declaratively combine the desired long-term workflow from next-task selection through handoff, simplification, boundary organization, and consensus review because the current implementation exposes only a hard-coded bounded-turn workflow and the sibling registry currently stores skill, agent-instruction, and sync-profile primitives rather than executable workflow recipes, resulting in manual step chaining, high context switching at approval gates, and no enforceable per-step capability boundary.

Affected actors or systems:
Jason as operator and decision owner; Codex and Claudex agent runtimes; `workflow-temporal`; `agent-config-registry`; local git worktrees; Linear and GitHub context sources; Temporal server and UI; local filesystem install targets and working directories.

Current-state baseline:
Estimated current baseline as of 2026-05-01: 1 hard-coded Temporal agent workflow (`agent.helloClaudex`), 2 signals (`submitHumanInput`, `cancelRun`), 1 query (`getHelloClaudexState`), 5 desired happy-path skills, at least 3 gate classes (planning/decomposition, human approval, review rejection), 0 explicit project-shape contract records, 0 typed loop/guard transition fixtures, and 2 repositories that must coordinate (`workflow-temporal` and `agent-config-registry`).

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
| OBJ-6 | Define a registry-backed project-shape composition model that can prove required facts, produced facts, allowed reads, allowed writes, external materializer needs, and loop preconditions before runtime. | Q-6 and MVP contract review verify registry validation and catalog output can explain composition decisions without prompt inference. |
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
| `workflow-temporal` maintainer | Owns Temporal workflow contracts, state transitions, activities, Updates, queries, and signals. | Review |
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
| CON-10 | Constraint | Approval, rejection, and abandonment decisions must use Temporal Updates that return typed decision results rather than fire-and-forget signals. | Gate decisions need synchronous accepted, rejected, stale, or invalid feedback. | VAL-5 verifies Update validation, return values, and no stale state mutation. |
| CON-11 | Constraint | Cross-run queue discovery must use Temporal Visibility search attributes or a durable projection while workflow histories store compact artifact references rather than large review payloads. | Querying every workflow does not scale, and Temporal histories have payload and history-size limits. | VAL-18 verifies listing performance, compact histories, and projection rebuild behavior. |
| CON-12 | Constraint | Long-running agent and tool activities must heartbeat, expose a heartbeat timeout, and propagate cancellation into provider calls or child processes. | Temporal delivers activity cancellation through heartbeats. | VAL-13 verifies heartbeat-backed cancellation and provider abort behavior. |
| CON-13 | Constraint | Recipe interpreter changes that alter Temporal command sequences require saved-history replay testing and an explicit patching, workflow-type, or Worker Versioning decision. | Running workflows replay through old event histories after worker changes. | VAL-2 and VAL-19 verify replay compatibility and versioning controls. |
| CON-14 | Constraint | `agent-config-registry` is a static configuration compiler for the MVP, not a runtime workflow-state service or always-on microservice. | Keeps registry scope aligned with the zero-dollar/no-server posture while allowing schema complexity to grow behind a compiler boundary. | BEL-910, D-3, and VAL-12 verify no hosted registry service is introduced. |
| CON-15 | Constraint | Recipe transition legality must be derived from typed `ProjectShapeContract` records and recipe transition rules rather than authored as prompt guidance. | Composition must be machine-checkable before Temporal starts a run. | VAL-21 and VAL-22 verify transition and loop fixtures. |
| ASM-1 | Assumption | The first implementation can use local Temporal, local filesystem artifacts, and local registry checkouts before a hosted API exists. | Current `workflow-temporal` and registry designs are local-first. | Validate during MVP smoke test before expanding to remote triggers. |
| ASM-2 | Assumption | A typed project-shape contract layer around existing skills can be introduced without rewriting each skill body immediately. | Existing skills already have clear workflows, expected project effects, and output expectations, but not formal machine contracts. | VAL-1 starts with `ProjectShapeContract` records for the five known happy-path steps. |
| ASM-3 | Assumption | Queue triage can initially use heuristic grouping by repo, workflow recipe, gate type, risk, and age. | User asked for context-switch minimization or another heuristic. | VAL-9 compares generated grouping against operator review on a seed queue. |

Section status:
Complete

## 5. Requirements

| ID | Type | Priority | Requirement statement | Rationale | Verification |
| --- | --- | --- | --- | --- | --- |
| REQ-1 | Functional | Must | The system shall define workflow recipes as versioned declarative records with ordered steps, required project facts or views, produced project facts, execution profile references, and gate policies. | Composition must be data-driven rather than prompt-driven. | VAL-1 |
| REQ-2 | Reliability | Must | The system shall resolve and persist an immutable recipe snapshot before workflow execution starts. | Temporal replay and audit require stable execution inputs. | VAL-3 |
| REQ-3 | Functional | Must | The system shall require each composable step to advertise a stable `ProjectShapeContract` covering required project facts or views, allowed reads, allowed writes, produced project facts, artifact outputs, gate outputs, side-effect class, and execution-profile constraints. | Gates, triage, downstream steps, and protected write controls require typed project-state effects. | VAL-1 |
| REQ-4 | Security | Must | The system shall apply a validated execution profile to each step before invoking an agent activity. | Step execution must be restricted by declared capability policy. | VAL-4 |
| REQ-5 | Functional | Must | `workflow-temporal` shall execute recipe steps through bounded activities or child workflows while keeping agent SDK side effects outside deterministic workflow code. | This preserves the current Temporal boundary. | VAL-2 |
| REQ-6 | Functional | Must | The system shall convert every blocking step outcome into a durable approval queue item with a resume target, decision options, artifact references, and compact context summary. | Human-required work must be visible and triageable outside the running agent session. | VAL-8 |
| REQ-7 | Reliability | Must | The system shall resume a blocked workflow only after an explicit Temporal decision Update matches the workflow execution ID, queue item identifier, expected gate revision, and permitted decision type, returning a typed `DecisionResult`. | Approval must not resume the wrong workflow or stale gate state, and callers need synchronous confirmation. | VAL-5 |
| REQ-8 | Functional | Must | The queue triage agent shall package pending approval queue items into review packets without mutating workflow state or worktrees. | The morning review agent must reduce context switching without becoming an implicit approver. | VAL-9, VAL-10 |
| REQ-9 | Operability | Must | The system shall isolate mutating workflow execution in one explicit git worktree per workflow run. | Worktree isolation contains retries, review, and rollback. | VAL-6 |
| REQ-10 | Security | Must | Consensus review steps shall run under a read-only execution profile that blocks protected-path writes and excludes unrelated implementation skills. | Review context must be narrower than implementation context. | VAL-4, VAL-10 |
| REQ-11 | Operability | Must | The system shall expose queryable and listable state for runs, steps, gates, queue items, artifacts, execution profile identifiers, and visibility/search metadata. | Operators need direct inspection, cross-run discovery, and recovery paths. | VAL-7, VAL-8, VAL-18 |
| REQ-12 | Reliability | Must | The system shall support heartbeat-backed cancellation, safe retry of non-mutating steps, idempotency-scoped retry of explicitly idempotent mutating steps, and explicit abandonment of blocked workflows without relying on provider-local session continuity. | Recovery cannot depend on local SDK state, and retries must not duplicate side effects. | VAL-13, VAL-14, VAL-15, VAL-16, VAL-20 |
| REQ-13 | Compatibility | Must | Registry schema changes shall be versioned so existing pinned recipes remain executable after newer profiles are published. | Long-running workflows must survive registry evolution. | VAL-3, VAL-11 |
| REQ-14 | Performance | Should | Queue triage shall produce review packets for 50 pending items within 5 seconds on the local development machine. | Morning review must remain operationally useful for accumulated gates. | VAL-9 |
| REQ-15 | Operability | Must | The system shall keep Temporal workflow payloads compact by storing large logs, summaries, review packets, diffs, and provider transcripts outside workflow history and passing only artifact references through workflow state. | Temporal payload and history limits make large in-history agent artifacts unsafe. | VAL-18 |
| REQ-16 | Compatibility | Must | The system shall require replay compatibility tests and a Temporal versioning decision before any recipe-interpreter change that adds, removes, reorders, or changes activity or child-workflow commands. | Command-sequence changes can block in-flight workflows during replay. | VAL-2, VAL-19 |
| REQ-17 | Functional | Must | The registry shall define a `ProjectShapeContract` model shared by primitive steps and composite recipes, including required project facts or views, allowed reads, allowed writes, produced project facts, gate outputs, artifact outputs, side-effect class, execution-profile constraints, and loop participation flags. | Composite workflows must be reusable as steps without losing typed project-state boundaries. | VAL-21 |
| REQ-18 | Functional | Must | The registry validator or catalog builder shall derive project-shape transition diagnostics that classify step transitions by satisfied requirements, missing facts or views, forbidden writes, required external materializers, and rejected transitions with machine-readable reasons. | Operators and implementation agents need to know which workflows compose before runtime. | VAL-21 |
| REQ-19 | Reliability | Must | Recipe transitions that loop shall declare typed guard predicates, loop identity, carried state, maximum iterations, terminal fallback, and history-budget behavior. | Review/fix/review and other loops must be deterministic, bounded, and recoverable. | VAL-22 |

Section status:
Complete

## 6. Success Measures and Kill Criteria

| Measure | Baseline | Target or decision threshold | Evaluation date or decision event | Related IDs |
| --- | --- | --- | --- | --- |
| Five-step recipe representation | Current baseline is 0 typed recipes for the five-skill path. | One validated recipe represents `linear-next-task`, `handoff-prompt`, `code-simplifier`, `organize-code-boundaries`, and `consensus-review` without workflow-code step ordering. | MVP design and contract review. | OBJ-1, REQ-1, REQ-3 |
| Gate queue proof | Current baseline is `waiting_for_input` inside one workflow and no cross-run queue. | A fake-run smoke test creates at least 3 queue items across at least 2 workflow runs, lists them through the chosen visibility path, and resumes the correct blocked step by decision Update result. | MVP smoke test. | OBJ-2, OBJ-4, REQ-6, REQ-7, REQ-11 |
| Capability containment | Current baseline has no registry-enforced read-only review execution profile. | A consensus review step cannot write to protected worktree paths in an automated negative test. | Capability-policy review before implementation acceptance. | OBJ-5, REQ-4, REQ-10 |
| Triage usefulness | Current baseline is manual context switching across gates. | A triage run groups 50 seed queue items into review packets in under 5 seconds and preserves source links for each item. | MVP operator review. | OBJ-4, REQ-8, REQ-14 |
| Project-shape transition proof | Current baseline is 0 explicit project-shape contract records or fixtures. | Registry validation or catalog generation explains one satisfied transition, one missing-fact transition, one forbidden-write transition, one materializer-required external transform, one composite workflow-as-step, and one bounded loop recipe. | Q-6 / MS-2 registry review. | OBJ-6, REQ-17, REQ-18, REQ-19 |
| Kill criterion: prompt-shaped recipes | Current baseline depends on human prompt conventions. | Stop or redesign if a recipe cannot be validated without reading free-form prompt prose. | Before implementation proceeds beyond schema work. | REQ-1, REQ-3 |
| Kill criterion: unbounded or implicit loops | Current baseline has no typed loop semantics. | Stop or redesign if a loop can be expressed without max iterations, terminal fallback, typed guard predicates, and history-budget behavior. | Before enabling looping recipes. | REQ-19 |
| Kill criterion: unenforceable execution profiles | Current baseline has no execution profile enforcement boundary. | Stop or redesign if the runner cannot prove read-only execution profiles block protected-path writes before agent execution. | Before consensus-review automation is allowed. | REQ-4, REQ-10 |

Section status:
Complete

## Layer 1 Exit

Layer 1 status:
Complete

## Layer 2: Functional Specification

## 7. System Context and External Interfaces

System boundary:
The system includes declarative workflow recipe records, `ProjectShapeContract` records, optional external materializer definitions, registry validation and cataloging for recipes, project-shape transition metadata, execution profiles, a Temporal recipe interpreter, bounded agent step activities, durable approval queue state, artifact references, local worktree allocation, and a read-only triage agent. It excludes hosted multi-user workflow UI, public marketplace protocols, provider-native session storage, and an always-on registry microservice for the MVP.

External actors and systems:
Jason as operator; Codex/Claudex agent runtimes; Temporal server and worker; `agent-config-registry`; Linear and GitHub context systems; local filesystem and git worktrees; local CLI or API callers; Temporal UI.

Trust or control boundaries:
Boundary-1 exists between versioned registry configuration and runtime execution. Boundary-2 exists between deterministic Temporal workflow state and side-effectful agent activities. Boundary-3 exists between read-only review/triage profiles and write-capable implementation profiles. Boundary-4 exists between human approval decisions and workflow resume Updates. Boundary-5 exists between per-run worktrees and the source repository. Boundary-6 exists between compact workflow history state and large external artifacts.

| Interface | Owner | Consumer or dependency | Inputs | Outputs |
| --- | --- | --- | --- | --- |
| Registry recipe catalog | `agent-config-registry` | Workflow starter and recipe resolver | Recipe records, `ProjectShapeContract` records, step definitions, optional materializer definitions, execution profiles, validation metadata | Pinned recipe snapshot, execution profile identifiers, and derived project-shape transition diagnostics |
| Temporal workflow API | `workflow-temporal` | CLI, API caller, Temporal UI | Workflow start request, approval/rejection/abandonment decision Updates, cancellation requests or signals | Run state, step state, gate state, terminal result, typed `DecisionResult` |
| Agent step activity | `workflow-temporal` activity runtime | Claudex/Codex/Claude providers | Step request, execution profile, worktree path, prior summary, human input | Step result, gate request, artifact references, provider session hint |
| Approval queue query | `workflow-temporal` | Operator CLI or triage agent | Queue filters, recipe IDs, repo IDs, gate status, visibility search attributes | Pending queue item summaries and artifact references |
| Queue visibility projection | `workflow-temporal` | Operator CLI, triage agent, recovery tooling | Workflow status, gate status, queue item ID, repo ID, recipe ID, owner, risk, age, artifact references | Cross-run queue listing without querying every workflow execution |
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
| FLOW-3 | Operator approves, rejects, or abandons a pending gate. | The queue item is still open and the decision Update references the current workflow execution ID, queue item ID, gate revision, and permitted decision type. | The workflow returns a typed `DecisionResult`; accepted decisions resume the next permitted step, branch according to the recipe, or record a rejected, cancelled, abandoned, terminal, or blocked state, while stale or invalid decisions are rejected without state mutation. | REQ-7, REQ-12 |
| FLOW-4 | Morning triage starts. | At least one pending queue item exists. | The triage agent returns grouped review packets ordered by declared heuristic and performs no writes to workflow state, registry state, or worktrees. | REQ-8, REQ-11, REQ-14 |
| FLOW-5 | Consensus review step runs. | The recipe step references the read-only consensus review execution profile. | The step runs with review-only skills/tools and protected-path write attempts fail before any worktree mutation is committed. | REQ-4, REQ-10 |
| FLOW-6 | A registry execution profile is updated while a workflow is running. | The workflow already stored a pinned recipe snapshot. | The running workflow continues with the pinned snapshot and new runs may use the newer execution profile after validation. | REQ-2, REQ-13 |
| FLOW-7 | Registry project-shape transitions are evaluated before a recipe is published. | `ProjectShapeContract` records, optional materializer definitions, execution profiles, and recipe transitions are available in registry content. | The validator or catalog builder reports satisfied transitions, missing required facts or views, forbidden writes, required external materializers, and rejected loop transitions with reasons. | REQ-17, REQ-18, REQ-19 |
| FLOW-8 | A review/fix/review loop runs. | The recipe declares a loop ID, typed guard predicates over review and fix outputs, carried state, maximum iterations, terminal fallback, and history-budget policy. | The workflow repeats only while the guard remains true and the iteration limit is not reached; approval, max-iteration, or failure exits are recorded as typed outcomes. | REQ-19, REQ-15, REQ-16 |
| FUNC-1 | Recipe validation is requested. | Registry content is available locally or from an accepted commit. | The caller receives pass/fail validation with specific errors for missing project-shape contracts, execution profile references, gate policies, or schema versions. | REQ-1, REQ-3, REQ-13 |
| FUNC-2 | Run state is queried. | A workflow execution exists. | The caller receives current run status, active step, gate state, queue item IDs, artifacts, worktree path, execution profile identifiers, and current visibility metadata. | REQ-11 |
| FUNC-3 | Queue items are listed. | Queue state exists in workflow state, Temporal Visibility, or a durable projection. | The caller receives open, approved, rejected, cancelled, abandoned, and resolved item summaries with resume correlation metadata plus any derived review packet references without loading full provider sessions or large artifacts. | REQ-6, REQ-11, REQ-15 |
| FUNC-4 | A read-only execution profile is applied. | The step declares a read-only execution profile. | The activity runner refuses write-capable tools and rejects protected-path write attempts before they affect the active worktree. | REQ-4, REQ-10 |
| FUNC-5 | Workflow visibility is rebuilt or refreshed. | Workflow histories, artifact references, and visibility metadata are available. | The caller can rebuild the queue projection from workflow-owned state and artifacts, and listing 50 pending items still meets the local SLA. | REQ-11, REQ-14, REQ-15 |
| FUNC-6 | A workflow unit is inspected for reuse. | A primitive step or composite recipe record exists. | The caller receives exported required project facts or views, allowed reads, allowed writes, produced project facts, gate outputs, artifact outputs, side-effect class, and execution-profile constraints without loading free-form prompt bodies. | REQ-17, REQ-18 |

Section status:
Complete

## 9. State Model, Faults, and Misuse Cases

States and transitions:
Recipe state transitions are `draft` -> `validated` -> `published` -> `pinned snapshot` -> `superseded`. Run state transitions are `created` -> `running` -> `waiting_on_gate` -> `running` -> `completed`, `failed`, `cancelled`, or `abandoned`. Step state transitions are `pending` -> `running` -> `completed`, `blocked`, `failed`, `cancelled`, or `skipped`. Queue item state transitions are `open` -> `approved`, `rejected`, `cancelled`, `abandoned`, or `resolved`; `packaged` is not a queue item state. Review packet state transitions are `draft` -> `presented` -> `superseded`. Decision Update result states are `accepted`, `rejected`, `stale`, `invalid`, or `no_effect`. Triage writes only derived review packet artifacts that reference still-open queue item IDs and never mutates queue item status, gate revision, or workflow state.

| ID | Scenario | Expected behavior | Invariant maintained | Related IDs |
| --- | --- | --- | --- | --- |
| Fault-1 | Registry is unavailable after a workflow starts. | The workflow continues using the pinned recipe snapshot or fails only when a new run cannot resolve a recipe. | Running workflows do not depend on live registry reads. | REQ-2, REQ-13, FUNC-1 |
| Fault-2 | Provider session resume fails. | The activity starts from workflow-owned objective, summary, human inputs, and artifact references. | Provider sessions remain non-authoritative hints. | REQ-12, FLOW-3 |
| Fault-3 | Approval decision Update references a stale gate revision. | The Update returns a stale `DecisionResult`, keeps the queue item open, and performs no gate-progress transition; a separate audit entry may be appended only if it cannot resume or close the gate. | A decision cannot resume the wrong gate state. | REQ-7, FUNC-3 |
| Fault-4 | Triage packet generation fails halfway. | Queue items remain open, any partial packet artifact is discarded or superseded, and no workflow resumes. | Triage has no implicit approval power. | REQ-8, FLOW-4 |
| Fault-5 | A mutating step fails after modifying the run worktree. | The run records failure artifacts and keeps changes isolated in the per-run worktree for inspection or cleanup. | Source repo and other runs remain untouched. | REQ-9, REQ-12 |
| Fault-6 | A non-mutating step fails with a retryable provider or startup error. | The workflow retries according to the pinned retry policy, while the activity disables nested provider-client retries and records each Temporal attempt without changing protected paths. | Safe retries are limited to non-mutating execution profiles unless idempotency is explicitly declared. | REQ-12 |
| Fault-7 | Operator abandons a blocked workflow. | The workflow accepts an abandonment Update, records `abandoned`, closes the queue item, returns a typed `DecisionResult`, and rejects later decisions for that gate revision. | Abandoned gates cannot resume after operator intent changes. | REQ-12, FUNC-3 |
| Fault-8 | Queue or review context exceeds Temporal payload or history budget. | The activity stores large data as external artifacts, returns only artifact references, and the workflow either continues with compact state or continues-as-new when history limits approach the configured threshold. | Large agent artifacts do not pollute workflow history. | REQ-11, REQ-15 |
| Fault-9 | A looping recipe reaches its maximum iteration count before its success guard is satisfied. | The workflow follows the declared terminal fallback, records loop state and unresolved outputs as artifacts or queue context, and does not continue scheduling loop steps. | Loops remain bounded and operator-visible. | REQ-19, REQ-15 |
| Misuse-1 | A recipe assigns an implementation-write execution profile to a consensus review step. | Registry validation fails or capability-policy review blocks publication. | Review steps must use read-only capability boundaries. | REQ-4, REQ-10, FUNC-1 |
| Misuse-2 | A triage agent attempts to approve a queue item. | The system rejects the action because triage profile lacks approval-Update authority. | Human approval remains explicit. | REQ-7, REQ-8 |
| Misuse-3 | A recipe uses free-form prompt text as the only downstream output. | Validation fails because the step lacks produced project facts and gate contracts. | Composition depends on typed project-shape contracts. | REQ-1, REQ-3 |
| Misuse-4 | A recipe or runner assigns agent/provider/tool execution to a Local Activity. | Validation or implementation review blocks the change because agent execution requires regular durable activities or child workflows. | Long-running and side-effectful agent work must not rely on Local Activity durability tradeoffs. | REQ-5, REQ-12 |
| Misuse-5 | A mutating activity declares automatic retry without idempotency keys and retry error taxonomy. | Registry validation or activity-runner startup fails closed. | Retries must not duplicate external or filesystem side effects. | REQ-12 |
| Misuse-6 | A recipe tries to schedule a step whose required project facts or views are not available and no approved external materializer can supply them. | Registry validation fails and the project-shape diagnostics name the missing facts, missing views, or protected write violations. | Composition cannot depend on prompt inference. | REQ-17, REQ-18 |
| Misuse-7 | A recipe declares a loop without a maximum iteration count, terminal fallback, or typed guard predicate. | Registry validation fails before publication or workflow start. | Looping composition is bounded and deterministic. | REQ-19 |

Section status:
Complete

## 10. External Service Levels and Acceptance Cases

External service expectations:
The MVP is local-first. Querying an active run or pending queue should complete within 2 seconds for 50 active runs on the local development machine. Triage should produce review packets for 50 pending queue items within 5 seconds. A gate emitted by a completed step should be queryable within 30 seconds of activity completion. Approval, rejection, and abandonment Updates should return a typed decision result within 2 seconds when no workflow task backlog exists. Workflow state should store compact structured state and artifact references rather than provider transcripts, large logs, diffs, or review packets. Read-only execution profile protected-path write attempts must leave the active worktree unchanged.

| ID | Acceptance case | Expected result | Covers |
| --- | --- | --- | --- |
| ACC-1 | A five-step happy-path recipe is validated from registry content. | Validation passes and reports step IDs, execution profiles, required project facts or views, produced project facts, allowed reads, allowed writes, artifact outputs, gate outputs, side-effect class, and gate policies. | REQ-1, REQ-3, FUNC-1 |
| ACC-2 | A workflow starts from a pinned recipe and the registry execution profile changes before step 2. | The running workflow continues with the original snapshot and records the snapshot identifier in query state. | REQ-2, REQ-13, FLOW-6 |
| ACC-3 | A fake step returns an approval gate. | A queue item appears with resume target, decision options, context summary, and artifact references. | REQ-6, FLOW-2, FUNC-3 |
| ACC-4 | A stale approval decision Update is submitted after a newer gate revision exists. | The Update returns a stale `DecisionResult`, no gate state changes, and the workflow remains blocked on the current queue item. | REQ-7, Fault-3 |
| ACC-5 | A consensus review step attempts to write under a protected worktree path while using a read-only execution profile. | The write attempt fails and the worktree contents remain unchanged. | REQ-4, REQ-10, FLOW-5, FUNC-4 |
| ACC-6 | A triage run packages 50 pending queue items. | Review packets are returned within 5 seconds, reference still-open queue item IDs, and no queue item is approved, rejected, or otherwise state-mutated by triage. | REQ-8, REQ-14, FLOW-4 |
| ACC-7 | A mutating implementation step fails after edits. | The failed run preserves artifacts and worktree changes under the run worktree without touching other worktrees. | REQ-9, REQ-12, Fault-5 |
| ACC-8 | A provider session reference is unavailable on resume. | The next bounded turn still starts from workflow-owned state and records a new session hint if available. | REQ-12, Fault-2 |
| ACC-9 | Run state is queried while waiting on a gate. | The query returns active recipe snapshot, step status, queue item ID, gate type, artifact references, execution profile identifiers, and current visibility metadata. | REQ-11, FUNC-2 |
| ACC-10 | An active step is cancelled while an activity is running. | The runner heartbeats, receives cancellation, aborts provider calls or child processes when supported, records cancelled status, stops scheduling subsequent steps, and leaves any protected-path diff attached as an artifact. | REQ-12 |
| ACC-11 | A non-mutating step fails with a retryable startup error. | The workflow retries according to the pinned retry policy, nested client retries are disabled, and bounded attempts are recorded without changing protected paths. | REQ-12, Fault-6 |
| ACC-12 | A blocked workflow is abandoned before a decision is submitted. | The abandonment Update closes the queue item, the workflow records `abandoned`, and later approval or rejection Updates for that gate revision return rejected or stale results. | REQ-12, Fault-7 |
| ACC-13 | Fifty pending gate workflows are listed for triage. | Queue items are discoverable through Temporal Visibility search attributes or the durable projection within 2 seconds, and the projection can be rebuilt from workflow-owned state plus artifact references. | REQ-11, REQ-14, REQ-15, FUNC-5 |
| ACC-14 | A recipe-interpreter change adds, removes, reorders, or changes an activity or child-workflow command. | Saved-history replay tests fail until a patching, workflow-type, Worker Versioning, or termination/migration decision is documented and implemented. | REQ-16 |
| ACC-15 | A mutating activity with retry enabled is executed twice by Temporal after a worker failure. | The activity uses a stable idempotency key, duplicate side effects are avoided or detected, and retryable versus non-retryable errors follow the pinned taxonomy. | REQ-12 |
| ACC-16 | Registry catalog generation evaluates project-shape transition fixtures. | The output classifies one satisfied transition, one missing-fact transition, one forbidden-write transition, one materializer-required external transform, and one composite-workflow-as-step transition with reasons. | REQ-17, REQ-18, FLOW-7 |
| ACC-17 | A review/fix/review looping recipe is validated. | Validation passes only when typed guards, loop state, maximum iterations, terminal fallback, and compact artifact behavior are declared. | REQ-19, FLOW-8 |
| ACC-18 | A looping recipe omits max iterations or terminal fallback. | Validation fails before the recipe can be published or started. | REQ-19, Misuse-7 |

Section status:
Complete

## 11. Requirements-to-Behavior Traceability

| Requirement | Functional behaviors or flows | Acceptance coverage | Notes |
| --- | --- | --- | --- |
| REQ-1 | FLOW-1, FUNC-1 | ACC-1 | Recipe records are the composition surface. |
| REQ-2 | FLOW-1, FLOW-6 | ACC-2 | Snapshot pinning preserves Temporal determinism. |
| REQ-3 | FLOW-2, FUNC-1 | ACC-1, ACC-3 | `ProjectShapeContract` records are required for downstream composition and gates. |
| REQ-4 | FLOW-5, FUNC-4 | ACC-5 | Execution profiles are enforced before agent execution. |
| REQ-5 | FLOW-1 | ACC-2 | The existing bounded activity model is retained. |
| REQ-6 | FLOW-2, FUNC-3 | ACC-3, ACC-9 | Queue items are first-class gate records. |
| REQ-7 | FLOW-3, FUNC-3 | ACC-4 | Gate revision matching prevents stale resume. |
| REQ-8 | FLOW-4 | ACC-6 | Triage packages work but does not approve work. |
| REQ-9 | FLOW-1 | ACC-7 | Mutating runs are isolated in worktrees. |
| REQ-10 | FLOW-5, FUNC-4 | ACC-5 | Consensus review uses read-only execution profile restrictions. |
| REQ-11 | FUNC-2, FUNC-3, FUNC-5 | ACC-9, ACC-13 | Query and listing state supports operator inspection, cross-run discovery, and projection recovery. |
| REQ-12 | FLOW-3 | ACC-7, ACC-8, ACC-10, ACC-11, ACC-12, ACC-15 | Recovery does not depend on provider-local state and retryable mutating work is idempotency-scoped. |
| REQ-13 | FLOW-6, FUNC-1 | ACC-2 | Registry evolution must not break pinned runs. |
| REQ-14 | FLOW-4 | ACC-6 | Triage performance has a local bound. |
| REQ-15 | FUNC-3, FUNC-5 | ACC-13 | Queue and artifact handling stay within Temporal history and payload budgets. |
| REQ-16 | FLOW-1, FLOW-6 | ACC-14 | Interpreter evolution is gated by replay compatibility and versioning controls. |
| REQ-17 | FLOW-7, FUNC-6 | ACC-16 | Primitive steps and composite workflows share an exported project-shape contract interface. |
| REQ-18 | FLOW-7, FUNC-6 | ACC-16 | Project-shape transition legality is derived from typed contracts and explained before runtime. |
| REQ-19 | FLOW-8 | ACC-17, ACC-18 | Looping composition is explicit, bounded, and deterministic. |

Section status:
Complete

## Layer 2 Exit

Layer 2 status:
Complete

## Layer 3: Technical Specification

## 12. Architecture Overview

Architecture summary:
The architecture is a local-first control plane with `agent-config-registry` acting as a static configuration compiler that publishes validated declarative workflow recipes, `ProjectShapeContract` records, optional external materializer definitions, derived project-shape transition diagnostics, and execution profiles, while `workflow-temporal` executes a pinned recipe snapshot through a deterministic Temporal interpreter. Agent execution remains inside bounded regular activities or child workflows. Blocking outcomes produce durable queue items and visibility metadata. Human decisions are submitted through Temporal Updates that return typed results. A read-only triage agent reads pending queue items and emits review packets for the operator.

Major components and boundaries:
Major components are the registry recipe/execution-profile schema, `ProjectShapeContract` schema, optional external materializer schema, project-shape transition validator, registry validator/catalog, recipe resolver, Temporal recipe interpreter, step activity runner, execution profile enforcement layer, worktree manager, artifact store, approval queue model, decision Update handler, visibility/projection model, replay/versioning gate, and queue triage packager. Boundaries are registry config versus execution state, deterministic Temporal workflow code versus side-effectful activities, read-only review/triage profiles versus write-capable implementation profiles, queue presentation versus approval-Update authority, compact workflow state versus large artifact storage, and run worktree versus source repository.

Deployment or runtime placement:
Registry validation and catalog generation run in the sibling `agent-config-registry` repository. Temporal workflows, activities, queue state, Updates, queries, and visibility/projection maintenance run in `workflow-temporal`. Claudex/Codex/Claude execution runs only from Node regular activity processes or child-workflow branches that schedule regular activities. Worktree and artifact files live on the local filesystem. Triage runs as a read-only activity, CLI command, or separate agent invocation using queue visibility and query output.

Architecture rationale:
This satisfies REQ-1 through declarative recipe records, REQ-2 through pinned snapshots, REQ-5 through the existing bounded activity boundary, REQ-6 and REQ-7 through queue items plus decision Updates, REQ-8 through read-only packet generation, REQ-10 through execution profile enforcement, REQ-15 through compact artifact-reference state, REQ-16 through replay and versioning controls, and REQ-17 through REQ-19 through `ProjectShapeContract` records, derived project-shape transition diagnostics, optional external materializers, and bounded loop/guard transition rules.

Section status:
Complete

## 13. Technical Mechanisms and Allocation

| ID | Mechanism | Component or owner | Responsibility | Related behaviors |
| --- | --- | --- | --- | --- |
| TECH-1 | `WorkflowRecipe` schema | `agent-config-registry` | Define a non-installable `workflow-recipe` registry package kind with recipe ID, version, steps, transitions, exported `ProjectShapeContract`, gate policies, execution profile references, and supported schema version. | FUNC-1, FLOW-1 |
| TECH-2 | `StepDefinition` contract records | `agent-config-registry` | Define a non-installable `step-definition` registry package kind with stable required project facts or views, allowed reads, allowed writes, produced project facts, artifact outputs, gate outputs, side-effect class, and execution-profile contract metadata. | FUNC-1, FLOW-2 |
| TECH-3 | `ExecutionProfile` and capability policy schema | `agent-config-registry` | Define a new non-installable `execution-profile` registry record, distinct from the existing sync `profile` package kind, with allowed skills, tools, MCP access, provider options, protected-path policy, approval-Update authority, retry class, idempotency-key template, retry error taxonomy, and enforcement mode. | FUNC-1, FUNC-4, FLOW-5 |
| TECH-4 | Recipe resolver and snapshot builder | `workflow-temporal` client or starter | Resolve registry content to an immutable recipe snapshot before starting a run. | FLOW-1, FLOW-6 |
| TECH-5 | Temporal recipe interpreter | `workflow-temporal` workflow code | Execute step graph deterministically from stored snapshot, step states, decision Update events, search attributes, and compact artifact references. | FLOW-1, FLOW-3 |
| TECH-6 | Step activity runner | `workflow-temporal` activities | Invoke one bounded regular activity for an agent step with execution profile, worktree path or read-only bundle path, prior state references, heartbeat timeout, periodic heartbeat, provider abort propagation, and timeout/cancellation controls. | FLOW-5, FUNC-4 |
| TECH-7 | Execution profile enforcement layer | Activity runtime | Fail closed when an execution profile is missing or invalid; materialize an `AgentExecutionContext`; deny disallowed skills, tools, MCP servers, and approval-Update authority before launch; for read-only execution profiles, pass no mutable worktree path, expose only a generated read-only review bundle plus runner-owned artifact output, and compare protected paths after the turn. | FUNC-4, FLOW-5 |
| TECH-8 | Approval queue model | `workflow-temporal` workflow state, Temporal Visibility, or durable projection | Store queue item identity, gate revision, resume target, decision options, compact context, artifact refs, and search/projection fields. | FLOW-2, FUNC-3, FUNC-5 |
| TECH-9 | Approval decision Update handler | `workflow-temporal` workflow code | Validate queue item ID, gate revision, decision type, workflow status, and actor authority before resuming, then return a typed `DecisionResult`. Validators remain read-only and non-blocking. | FLOW-3, FUNC-3 |
| TECH-10 | Queue triage packager | Read-only triage agent or activity | Group queue items discovered via visibility/projection by repo, recipe, gate type, risk, dependency, age, or operator heuristic. | FLOW-4 |
| TECH-11 | Worktree manager | Activity runtime or workflow starter | Allocate, label, inspect, and clean one run worktree for mutating execution profiles. | FLOW-1 |
| TECH-12 | Artifact store and artifact references | Activity runtime | Persist step logs, summaries, review packets, and gate context under run-scoped paths. | FUNC-2, FUNC-3 |
| TECH-13 | Visibility and history-budget controller | `workflow-temporal` workflow code and activity runtime | Upsert queue-related search attributes, maintain or rebuild a durable projection if selected, enforce compact payload contracts, and continue-as-new or fail closed when history-budget thresholds are reached. | FUNC-3, FUNC-5 |
| TECH-14 | Activity retry and idempotency policy | Activity runtime and registry validation | Disable nested provider-client retries, classify retryable and non-retryable failures, require idempotency keys for retryable mutating activities, and record attempt metadata. | Fault-6, Misuse-5 |
| TECH-15 | Replay and versioning gate | `workflow-temporal` tests and release checklist | Run saved-history replay tests and require a patching, workflow-type, Worker Versioning, or termination/migration decision for command-sequence changes. | FLOW-6, ACC-14 |
| TECH-16 | `ProjectShapeContract` schema | `agent-config-registry` | Define the shared exported interface embedded by primitive step definitions and composite workflow recipes: required project facts or views, allowed reads, allowed writes, produced project facts, gate outputs, artifact outputs, side-effect class, outcome, execution-profile constraints, and loop participation flags. | FLOW-7, FUNC-6 |
| TECH-17 | External materializer records | `agent-config-registry` | Define optional non-installable materializer records for legacy or external transforms that cannot directly read from or write to the project shape without hiding conversion inside free-form prompt text. | FLOW-7, Misuse-6 |
| TECH-18 | Project-shape transition validator | `agent-config-registry` catalog builder | Derive satisfied, missing-fact, forbidden-write, materializer-required, and rejected composition diagnostics from `ProjectShapeContract` records, artifact requirements, gate coverage, and execution-profile constraints, then emit diagnostics in catalog output. | FLOW-7, ACC-16 |
| TECH-19 | Guarded loop transition model | `agent-config-registry` and `workflow-temporal` | Represent typed guard predicates, loop IDs, carried loop state, maximum iterations, terminal fallback, and history-budget behavior in recipe snapshots and deterministic interpreter state. | FLOW-8, ACC-17, ACC-18 |

Section status:
Complete

## 14. Data, Schemas, and Compatibility

| Change | Type | Compatibility impact | Reversibility | Mitigation |
| --- | --- | --- | --- | --- |
| Add `workflow-recipe` registry records | Schema / Config | New non-installable registry package kind must be ignored by older registry clients or gated by schema version. | Reversible | Use schema versioning, feature flags, and validation that rejects unsupported recipe versions. |
| Add `step-definition` records | Schema / Config | New non-installable registry package kind references existing skills and `ProjectShapeContract` metadata without changing skill package content. | Reversible | Keep step definitions additive and validate references before publication. |
| Add `execution-profile` registry records | Schema / Config | Existing `profile` package kind remains a sync manifest for install targets; `execution-profile` is a separate non-installable record kind used only for agent runtime capability policy. | Reversible | Add schema-versioned catalog support for `execution-profile`, reject recipes that reference sync profiles as execution profiles, and keep existing package-kind compatibility tests unchanged except for explicit unsupported-kind behavior. |
| Add embedded `projectShapeContract` schema fields | Schema / Config | Primitive steps and composite recipes gain exported project-shape contracts without creating standalone contract source records for the MVP. | Reversible | Keep the contract schema additive and pin resolved snapshots by digest. |
| Add optional external materializer records | Schema / Config | New non-installable registry package kind lets recipes use explicit typed legacy or external transforms only when direct project-shape reads and writes are not viable. | Reversible | Treat materializers as optional records; validation rejects recipes that require a materializer when none is declared. |
| Add derived project-shape transition catalog metadata | Catalog | Catalog output includes composition diagnostics derived from source records; it is rebuildable and not the source of truth. | Reversible | Regenerate from source records and keep transition output metadata-only. |
| Add guarded loop transition fields | Schema / Config | `workflow-recipe` transition schema can express bounded loops; existing non-loop recipes remain valid. | Reversible | Validation rejects loops missing guard predicates, max iterations, terminal fallback, or history-budget policy. |
| Add recipe snapshot to workflow input/state | API / Data | Workflow start contract changes for recipe-backed runs while `agent.helloClaudex` can remain as legacy MVP path. | Reversible | Introduce a new workflow type for recipe-backed runs instead of mutating the existing workflow contract in place. |
| Add approval queue item and decision Update contract | Data / API | New query and Update payloads must remain versioned for long-running workflows. | Reversible | Include queue item version, workflow execution ID, gate revision, decision type, actor, and `DecisionResult` version in every queue item and decision Update. |
| Add review packet artifact contract | Data | Triage output becomes a durable artifact referenced by queue item IDs. | Reversible | Store packets as derived artifacts that can be regenerated from queue state. |
| Add queue visibility fields | Visibility / Data | Search attributes or a durable projection become part of the operator listing path. | Reversible | Keep visibility/projection fields derivable from workflow state and artifact references. |
| Add compact artifact-reference contract | Data | Large provider outputs, diffs, logs, review packets, and transcripts cannot be embedded directly in workflow inputs, outputs, or mutable state. | Reversible | Store large content under run-scoped artifact paths and pass typed references through workflow history. |

Section status:
Complete

## 15. Control Logic and Non-Functional Controls

Control logic summary:
A workflow start request resolves a registry recipe to an immutable snapshot, allocates or receives a worktree according to execution profile requirements, initializes visibility metadata, and starts a Temporal recipe interpreter. Before publication or start, the registry compiler validates `ProjectShapeContract` records and derives project-shape transition diagnostics; runtime execution consumes the resolved snapshot rather than a live transition query. The interpreter schedules one step at a time unless the recipe explicitly declares fanout or a bounded loop. Each step activity receives only the required project facts or views, pinned execution profile, allowed worktree or read-only bundle path, prior summary references, and artifact refs needed for that step. Completed steps advance the recipe cursor according to typed transition guards and declared produced project facts. Blocked steps create approval queue items and upsert queue visibility metadata. Approval, rejection, and abandonment decisions are submitted only through Temporal Updates; accepted decisions require workflow execution ID, queue item ID, gate revision, actor authority, and decision type to match the active blocked state, and every Update returns a typed `DecisionResult`.

Project-shape composition model:
Workflow composition is project-shape contract based. Primitive steps and composite recipes export the same `ProjectShapeContract` shape. The registry validator or catalog builder derives transition diagnostics from required project facts or views, allowed reads, allowed writes, produced project facts, artifact requirements, gate handling, side-effect class, execution-profile constraints, and optional external materializers. Derived transitions are classified as satisfied, missing required fact or view, forbidden write, materializer-required, or rejected with reasons. The diagnostics are metadata-only, rebuildable from source records, and not runtime workflow state.

Decision Update validator model:
Decision Update validators are read-only and non-blocking. They may reject only malformed, undecodable, or schema-incompatible payloads before the Update event is written. Semantic decision failures, including unauthorized actors, missing queue item IDs, mismatched workflow execution IDs, unsupported decision types, stale gate revisions, and no-effect decisions, are handled by the Update handler so callers receive a typed `DecisionResult`. The handler performs any deterministic state transition and returns `accepted`, `rejected`, `stale`, `invalid`, or `no_effect` without calling activities, fetching registry state, or loading artifacts.

Concurrency and ordering model:
The MVP default is sequential execution. Fanout is allowed only for explicitly declared subworkflows such as consensus review. Consensus review should be represented as child workflows when reviewer branches need independent retry policies, cancellation behavior, partial-failure handling, or history isolation; a single step activity is acceptable only when the provider runner remains one bounded black-box turn with no independent branch lifecycle. Loops are allowed only through typed guard transitions with loop IDs, maximum iterations, carried state, and terminal fallback. A queue item has one active gate revision. A decision can affect only the workflow execution and gate revision named in the Update. Triage may read many queue items concurrently but has no write authority over workflow state.

Failure recovery model:
Read-only steps may be retried according to declared retry policy. Mutating steps use conservative retry defaults and may retry only when an idempotency key template and retry taxonomy are declared. Activity-level LLM, GitHub, Linear, filesystem, and provider client retries are disabled so Temporal owns the durable retry policy, retry visibility, and idempotency accounting. Retryable errors include rate limits, timeouts, transient network failures, and temporary server failures. Non-retryable errors include invalid inputs, authentication failures, missing resources, content or capability-policy violations, schema validation failures, and protected-path enforcement failures. Cancellation stops the active activity through heartbeat-backed delivery and provider abort propagation where supported. Provider session loss triggers fresh-session fallback when workflow-owned state is sufficient. Queue item projection can be rebuilt from workflow state and artifacts if derived storage is lost.

History and payload budget model:
Workflow history stores compact state, identifiers, decision results, search attributes, and artifact references. Large logs, summaries, provider transcripts, diffs, review packets, bundle contents, and gate packets live in the artifact store. The interpreter checks `continueAsNewSuggested` or a configured history-length threshold before long-running loops, queue-heavy phases, or large fanout aggregation. If a derived queue projection is selected, it is treated as rebuildable from workflow-owned state and artifact references.

Activity execution model:
Agent/provider/tool execution uses regular Temporal activities or child workflows that schedule regular activities. Local Activities are excluded for agent execution because they are unsuitable for long-running, side-effectful, cancellation-sensitive, and durability-sensitive work. Long-running activities declare `heartbeatTimeout`, heartbeat with progress metadata, read heartbeat details on retry when useful, and propagate cancellation through AbortSignals or child-process termination where the provider runtime supports it.

Replay and versioning model:
Recipe interpreter changes are classified before merge. Changes that do not alter activity or child-workflow command ordering can proceed with normal tests. Changes that add, remove, reorder, or change activity or child-workflow commands require saved-history replay tests using `Worker.runReplayHistory` and one explicit compatibility choice: Temporal patching API, new workflow type, Worker Versioning, or termination/migration of old executions. Worker versions must use traceable build IDs when Worker Versioning is enabled.

Execution profile enforcement model:
Capability enforcement is not prompt-based. Registry validation rejects recipes whose step type is incompatible with the referenced `execution-profile` record. The activity runner accepts only execution profile IDs and digests from the pinned recipe snapshot, constructs an `AgentExecutionContext`, and fails closed before provider launch when an allowlist, MCP server, skill, approval-Update authority, retry/idempotency policy, or filesystem policy is absent or incompatible. Read-only execution profiles receive no mutable worktree path and cannot expose shell, editor, patch, filesystem-write, mutation-capable MCP, worker-agent, or approval-Update capabilities. They operate from a generated review bundle and runner-owned artifact output path; the runner records and compares protected source, registry, and worktree paths before and after execution. Any protected-path diff under a read-only execution profile fails the step and triggers the rollback containment path. Mutating execution profiles are the only profiles allowed to receive a run worktree and write-capable tools.

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
| REQ-11 | TECH-5, TECH-8, TECH-12, TECH-13 | Query and listing state includes workflow, step, gate, queue, artifact, and visibility metadata. |
| REQ-12 | TECH-5, TECH-6, TECH-8, TECH-9, TECH-11, TECH-14 | Recovery uses workflow state, queue state, heartbeat-backed cancellation, retry/idempotency policy, and isolated worktrees. |
| REQ-13 | TECH-1, TECH-4 | Versioned schema and pinned snapshots preserve compatibility. |
| REQ-14 | TECH-10 | Triage packager is bounded and testable against seed queues. |
| REQ-15 | TECH-8, TECH-12, TECH-13 | Workflow state stays compact and large agent artifacts remain outside history. |
| REQ-16 | TECH-5, TECH-15 | Interpreter evolution is gated by replay tests and Temporal versioning strategy. |
| REQ-17 | TECH-16 | Primitive and composite workflow units export a shared `ProjectShapeContract` interface. |
| REQ-18 | TECH-17, TECH-18 | Project-shape transition legality is derived from source contracts and optional external materializers. |
| REQ-19 | TECH-5, TECH-13, TECH-19 | Looping recipes are bounded, typed, and history-budget aware. |

Section status:
Complete

## 16. Observability, Operations, Rollout, and Rollback

| Signal | Type | Purpose | Consumer |
| --- | --- | --- | --- |
| Run state query result | Audit | Shows recipe snapshot, current step, workflow status, worktree or read-only bundle path, and execution profile identifiers. | Operator and triage tooling |
| Queue item count by status | Metric | Detects gate backlog and blocked work accumulation. | Operator |
| Queue visibility search attributes | Visibility | Enables cross-run filtering by gate status, queue item ID, repo, recipe, owner, risk, age, and workflow status. | Operator, triage tooling, recovery tooling |
| Step transition log | Audit | Records pending, running, completed, blocked, failed, skipped, and cancelled transitions. | Operator and reviewer |
| Execution profile enforcement failure | Log / Audit | Proves blocked write/tool attempts and execution profile validation failures. | Capability-policy reviewer |
| Approval decision Update result | Audit | Records queue item ID, gate revision, decision type, actor, `DecisionResult`, and workflow result. | Operator and reviewer |
| Worktree allocation record | Audit | Maps workflow run to worktree path, base ref, branch, and cleanup state. | Operator |
| Triage packet artifact | Audit | Records grouping heuristic, included queue item IDs, and generated review packet path. | Operator |
| Activity heartbeat and cancellation record | Audit | Records heartbeat progress, heartbeat timeout, cancellation delivery, provider abort result, and cleanup outcome. | Operator and maintainer |
| Retry/idempotency record | Audit | Records idempotency key, Temporal attempt, retry class, non-retryable error type, and nested client retry setting. | Operator and maintainer |
| Replay compatibility result | Release gate | Records saved-history replay fixture, `Worker.runReplayHistory` result, and selected Temporal versioning strategy for command-sequence changes. | Maintainer and reviewer |
| History budget gauge | Metric | Tracks history length, artifact-reference count, continue-as-new triggers, and projection rebuild status. | Operator and maintainer |
| Registry project-shape transition diagnostics | Catalog output | Explains satisfied transitions, missing facts or views, forbidden writes, materializer-required external transforms, and composite-workflow-as-step transitions derived from `ProjectShapeContract` records and optional materializer records. | Registry reviewer and operator |
| Loop guard and iteration record | Audit | Records loop ID, iteration count, guard outcome, carried state reference, terminal fallback, and history-budget behavior. | Workflow reviewer and operator |

Rollout plan:
Phase 1 records Q-6 as superseding BEL-910/D-5, then defines registry schemas and validation for `ProjectShapeContract` records, recipes, step definitions, optional external materializers, project-shape transition diagnostics, loop/guard fields, and `execution-profile` records using fake steps only, including retry taxonomy and idempotency-key templates. Phase 2 adds a new recipe-backed Temporal workflow that runs fake activities, emits queue items, upserts queue visibility metadata, and resumes by decision Update. Phase 3 adds worktree allocation, heartbeat-backed cancellation, and execution profile enforcement for fake write/read-only steps. Phase 4 formalizes the five known skills as project-state step definitions and enforces regular-activity execution for agent/provider/tool steps. Phase 5 enables read-only queue triage and consensus review packaging, using child workflows when reviewer branches need independent lifecycle controls. Phase 6 runs live opt-in smoke tests against local provider auth and local worktrees. Every phase that changes the recipe interpreter includes saved-history replay verification before acceptance.

Rollback or containment plan:
Rollback trigger is any failed capability-policy negative test, stale gate resume defect, queue item identity collision, or unintended protected-path write from a read-only execution profile. Rollback action is to disable recipe-backed workflow starts, keep existing `agent.helloClaudex` MVP workflow available, preserve run worktrees for inspection, and revert registry recipe or execution profile publication to the last validated commit. Reversibility is strong for schema additions and workflow type additions because running recipe-backed workflows can be cancelled or abandoned without changing the legacy workflow path. If CND-1 resolves to evolving `agent.helloClaudex` in place, implementation cannot proceed until an equivalent rollback path preserves the last validated bounded-turn workflow behavior.

Operator actions:
Operators can start a recipe-backed run, query run state, list queue items through the chosen visibility path, generate triage packets, approve or reject queue items through decision Updates, cancel active runs, abandon blocked runs through decision Updates, inspect run artifacts, inspect run worktrees, inspect registry project-shape transition diagnostics, inspect loop iteration records, inspect replay/versioning gate results, and disable new recipe-backed starts by removing or pinning the registry execution profile used by the starter.

Section status:
Complete

## 17. Verification Strategy and Behavior-to-Mechanism Traceability

| ID | Verification method | What is verified | Related IDs |
| --- | --- | --- | --- |
| VAL-1 | Test / Inspection | Registry validation accepts the five-step happy-path recipe and rejects missing `ProjectShapeContract` records, missing execution profiles, unsupported schema versions, sync-profile misuse, and prompt-only outputs. | REQ-1, REQ-3, REQ-13, FUNC-1, TECH-1, TECH-2, TECH-3 |
| VAL-2 | Test / Inspection / Replay | Workflow code remains deterministic, workflow imports stay replay-safe, agent SDK execution stays inside regular activities or child workflows, and saved histories replay with `Worker.runReplayHistory`. | REQ-5, REQ-16, CON-2, CON-13, TECH-5, TECH-6, TECH-15 |
| VAL-3 | Test | Workflow start persists a pinned recipe snapshot and running workflows ignore later registry changes. | REQ-2, REQ-13, FLOW-6, TECH-4 |
| VAL-4 | Test / Security review | Execution profile enforcement blocks disallowed tools, MCP access, implementation skills, approval-Update authority, and protected-path writes for read-only execution profiles. | REQ-4, REQ-10, FUNC-4, TECH-3, TECH-7 |
| VAL-5 | Test | Approval, rejection, and abandonment Updates return typed `DecisionResult` values and resume only matching workflow execution, queue item ID, gate revision, actor authority, and decision type. | REQ-7, FLOW-3, TECH-9 |
| VAL-6 | Test / Inspection | Mutating runs allocate one explicit worktree and do not share active worktrees across runs. | REQ-9, TECH-11 |
| VAL-7 | Test / Manual | Run state queries expose recipe, step, gate, queue, artifact, worktree or read-only bundle, execution profile metadata, and current visibility/search metadata. | REQ-11, FUNC-2, TECH-5, TECH-8, TECH-12, TECH-13 |
| VAL-8 | Test | Blocking step outcomes produce durable queue items with required review and resume fields. | REQ-6, REQ-11, FLOW-2, FUNC-3, TECH-8 |
| VAL-9 | Test / Operator review | Triage packages 50 pending queue items discovered through the chosen visibility path within 5 seconds and preserves source links and decision targets. | REQ-8, REQ-14, FLOW-4, TECH-10 |
| VAL-10 | Negative test / Security review | Triage and consensus review execution profiles cannot approve gates or mutate protected source, registry, or worktree paths. | REQ-8, REQ-10, TECH-3, TECH-7, TECH-10 |
| VAL-11 | Compatibility test | New registry schema records are versioned and older pinned recipe snapshots remain executable. | REQ-13, TECH-1, TECH-4 |
| VAL-12 | Inspection | MVP rollout introduces no always-on hosted service dependency. | CON-9 |
| VAL-13 | Test | Active step cancellation is delivered through activity heartbeats, aborts provider calls or child processes where supported, records cancelled status, stops subsequent scheduling, and preserves protected-path diff artifacts. | REQ-12, TECH-5, TECH-6 |
| VAL-14 | Test | Non-mutating steps retry only according to pinned retry policy, while mutating steps do not auto-retry unless idempotency is explicitly declared. | REQ-12, TECH-3, TECH-5, TECH-6, TECH-14 |
| VAL-15 | Test | Abandoning a blocked workflow through a decision Update closes the queue item, records `abandoned`, returns a typed `DecisionResult`, and rejects later decisions for that gate revision. | REQ-12, TECH-8, TECH-9 |
| VAL-16 | Test | Provider-session loss resumes from workflow-owned objective, summaries, human inputs, and artifact references rather than provider-local session state. | REQ-12, CON-3, TECH-5, TECH-6 |
| VAL-17 | Rollback drill / Inspection | A failed capability-policy or stale-resume gate blocks launch, recipe-backed starts can be disabled, existing `agent.helloClaudex` behavior remains runnable, failed run worktrees are preserved, and registry recipe or execution profile publication can be reverted to the last validated commit. | HC-4, CND-1 |
| VAL-18 | Test / Inspection | Queue listing uses Temporal Visibility search attributes or the durable projection, 50 pending items meet the local listing SLA, workflow histories store compact artifact references, and projection rebuild or continue-as-new behavior is exercised. | REQ-11, REQ-14, REQ-15, CON-11, TECH-8, TECH-13 |
| VAL-19 | Release gate / Replay test | Any recipe-interpreter command-sequence change has saved-history replay evidence and an explicit patching, workflow-type, Worker Versioning, or termination/migration decision before merge. | REQ-16, CON-13, TECH-15 |
| VAL-20 | Test / Inspection | Activity retry policy disables nested provider-client retries, classifies retryable and non-retryable errors, and requires stable idempotency keys for retryable mutating activities. | REQ-12, TECH-3, TECH-14 |
| VAL-21 | Test / Inspection | Registry validation or catalog generation emits project-shape transition diagnostics for one satisfied transition, one missing-fact transition, one forbidden-write transition, one materializer-required external transform, and one composite-workflow-as-step transition, all derived from `ProjectShapeContract` records and optional materializer records. | REQ-17, REQ-18, CON-15, TECH-16, TECH-17, TECH-18 |
| VAL-22 | Test / Inspection | Registry validation accepts a bounded review/fix/review loop only when it declares typed guard predicates, loop ID, carried state, maximum iterations, terminal fallback, and history-budget behavior, and rejects loops missing those fields. | REQ-19, CON-15, TECH-19 |

Execution-spec mapping:
Design `VAL-21` maps to execution `VAL-19` / `EVD-19`; design `VAL-22` maps to execution `VAL-20` / `EVD-20`.

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
| REQ-11 | TECH-5, TECH-8, TECH-12, TECH-13 | VAL-7, VAL-8, VAL-18 |
| REQ-12 | TECH-5, TECH-6, TECH-8, TECH-9, TECH-11, TECH-14 | VAL-13, VAL-14, VAL-15, VAL-16, VAL-20 |
| REQ-13 | TECH-1, TECH-4 | VAL-3, VAL-11 |
| REQ-14 | TECH-10 | VAL-9 |
| REQ-15 | TECH-8, TECH-12, TECH-13 | VAL-18 |
| REQ-16 | TECH-5, TECH-15 | VAL-2, VAL-19 |
| REQ-17 | TECH-16 | VAL-21 |
| REQ-18 | TECH-17, TECH-18 | VAL-21 |
| REQ-19 | TECH-5, TECH-13, TECH-19 | VAL-22 |
| Rollback control | TECH-1, TECH-3, TECH-4, TECH-5, TECH-11 | VAL-17 |
| FUNC-1 | TECH-1, TECH-2, TECH-3 | VAL-1, VAL-11 |
| FUNC-2 | TECH-5, TECH-8, TECH-12, TECH-13 | VAL-7 |
| FUNC-3 | TECH-8, TECH-9, TECH-13 | VAL-5, VAL-8, VAL-18 |
| FUNC-4 | TECH-3, TECH-7 | VAL-4, VAL-10 |
| FUNC-5 | TECH-8, TECH-13 | VAL-18 |
| FUNC-6 | TECH-16, TECH-17, TECH-18 | VAL-21 |

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
| ALT-5: Hand-author step transition edges as source records | Could make transition output easy to inspect. | It makes source truth drift likely; transition legality should be derived from `ProjectShapeContract` records and optional external materializer records. |

Risks:

| ID | Statement | Likelihood | Consequence | Mitigation |
| --- | --- | --- | --- | --- |
| RISK-1 | Execution profile enforcement could be incomplete. | Medium | High | Use deny-by-default execution profiles, negative write tests, and independent capability-policy review before enabling review automation. |
| RISK-2 | Queue item identity or resume correlation could be wrong. | Medium | High | Use gate revision IDs, workflow execution IDs, decision audit events, and stale-decision negative tests. |
| RISK-3 | Recipes could become prompt-shaped blobs. | Medium | Medium | Make registry validation reject recipes without typed `ProjectShapeContract` records, produced project facts, protected write rules, and gate policies. |
| RISK-4 | Triage heuristics could optimize the wrong grouping. | Medium | Low | Store grouping rationale in review packet artifacts and keep heuristic configuration explicit. |
| RISK-5 | Mutating steps could leave worktrees dirty after failure. | Medium | Medium | Require one worktree per run, preserved failure artifacts, and explicit abandon/cleanup operator actions. |
| RISK-6 | Queue listing could become slow or history-heavy as blocked runs accumulate. | Medium | Medium | Use search attributes or a rebuildable projection, keep workflow state compact, and verify the 50-item listing SLA with history-budget checks. |
| RISK-7 | Retried mutating activities could duplicate external or filesystem side effects. | Medium | High | Require idempotency keys, explicit retry taxonomy, disabled nested client retries, and non-retryable classification for validation/auth/policy failures. |
| RISK-8 | Recipe-interpreter changes could break replay for in-flight workflows. | Medium | High | Require saved-history replay tests and patching, workflow-type, Worker Versioning, or migration decisions for command-sequence changes. |
| RISK-9 | Project-shape transition validation could turn the registry into an accidental runtime platform. | Medium | Medium | Keep the registry as a static compiler, derive metadata-only transition diagnostics, and defer any microservice until explicit service trigger conditions exist. |
| RISK-10 | Looping recipes could run indefinitely or hide unresolved review/fix findings. | Medium | High | Require typed guard predicates, maximum iterations, terminal fallback, compact artifacts, and continue-as-new/history-budget controls before enabling loop recipes. |

Open questions:

| ID | Question | Owner | Due date | Resolution plan |
| --- | --- | --- | --- | --- |
| Q-1 | Should queue state live only in Temporal workflow histories and queries, or should a derived local queue index be maintained for faster triage? | `workflow-temporal` maintainer | Before Phase 3 | Prototype both with 50 seed queue items during Phase 2 and choose the least stateful option that meets REQ-14. |

Resolved implementation decisions:

| ID | Decision | Rationale |
| --- | --- | --- |
| D-1 | `consensus-review` uses child workflows when reviewer branches need independent retry policies, cancellation behavior, partial-failure handling, or history isolation; a single step activity is allowed only for one bounded black-box provider turn. | This keeps fanout lifecycle, history growth, and failure isolation explicit without over-modeling simple runner calls. |
| D-2 | Agent/provider/tool execution does not use Local Activities. | Long-running, side-effectful, cancellation-sensitive work needs regular activity durability, visibility, timeout, heartbeat, and retry behavior. |
| D-3 | `agent-config-registry` remains a static configuration compiler for the MVP; no registry microservice is introduced. | Current requirements need deterministic validation, catalog generation, and pinned snapshots, not live registry state, auth, deployment, or remote availability. |
| D-4 | Step transition diagnostics are derived from `ProjectShapeContract` records and optional external materializer records rather than hand-authored as source truth. | Derived transition output keeps composition explainable while preventing source-of-truth drift. |
| D-5 | BEL-910 approved the earlier adapter-first registry approach on 2026-05-01; Q-6 supersedes that decision rather than editing BEL-910 in place. | Preserving BEL-910 as historical evidence keeps completed planning auditable while allowing the current design to pivot cleanly. |
| D-6 | Q-6 selects project-shape recipe composition as the source of truth: `workflow-recipe`, `step-definition`, and composite recipes expose embedded `ProjectShapeContract` data; optional external materializers are escape hatches only; loop/guard semantics remain fields on `workflow-recipe` transitions; project-shape transition output is derived catalog metadata only. | This reuses the existing package-kind/catalog/digest model for versioned source records, keeps install targets empty like sync `profile`, lets composite recipes compose as project-state steps, and avoids pairwise transform plumbing as the default composition model. |

Waivers: none

Final readiness statement:
Ready with heightened controls; BEL-910 remains resolved historical evidence and Q-6 supersedes D-5 for recipe composition. WP-2 may proceed when the remaining execution-spec entry dependencies, Q-6 approval, and registry dependency readiness are satisfied.

Section status:
Complete

## Final Consistency Gate

The problem is current and evidenced by the existing hard-coded workflow and the desired five-skill roadmap. Requirements define declarative recipes, pinned snapshots, typed project-state step contracts, exported `ProjectShapeContract` records, derived project-shape transition diagnostics, optional external materializers, bounded loop transitions, execution profile enforcement, queue items, decision Updates, triage packets, worktree isolation, visibility controls, compact artifact references, replay compatibility, and recovery. Layer 2 defines externally observable start, project-shape transition evaluation, bounded loop execution, gate, decision Update, triage, execution profile, queue listing, and registry-change behaviors. Layer 3 allocates mechanisms across `agent-config-registry`, `workflow-temporal`, activity runtime, worktree manager, artifact store, project-shape transition validation, visibility/projection controls, replay/versioning gates, and triage packager. Verification covers the highest-risk claims: execution profile enforcement, stale approval rejection, pinned snapshots, heartbeat-backed cancellation, retry/idempotency, abandonment, provider-session fallback, worktree isolation, project-shape transition fixture coverage, loop guard coverage, history-budget controls, replay compatibility, rollback, and no hosted dependency.

## Internal Review Record

| Field | Value |
| --- | --- |
| Document | Composable Agent Workflow Control Plane |
| Review date | 2026-05-31 |
| Moderator | Codex |
| Decision owner | Jason Belmonti |
| Proposed rigor level | `R3` |
| Reviewed rigor level | `R3` |
| Calibration result | Accept |
| Structural result | Pass after consensus revision, May 25 validation revision, and project-shape pivot revision |
| Semantic result | Pass after consensus revision, May 25 validation revision, and project-shape pivot revision |
| Traceability result | Pass after consensus revision, May 25 validation revision, and project-shape pivot revision |
| Verdict | Draft is ready for human review; requested decision remains `Approve with heightened controls` |
| Open findings | none |
| Resolved findings verified in this decision | ST-1, SM-1, TR-1, CR-1, CR-2, CR-3, PR-1, PR-2, TS-1, TS-2, TS-3, TS-4, TS-5, VR-1, VR-2, PSC-1, PSC-2, PSC-3 |
| Reviewed waivers | none |
| Required heightened controls | HC-1, HC-2, HC-3, HC-4, HC-5, HC-6, HC-7, HC-8 |
| Approval conditions | CND-1, CND-2, CND-3 |
| Top blockers | none |
| Required follow-ups | Resolve Q-1 before implementation reaches its named phase gate. |

### Review Findings Addressed

| Finding ID | Severity | Status | Section | Finding | Required action | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| ST-1 | Major | Resolved | 5, 11, 17 | Initial draft risked treating execution profiles as implementation detail rather than binding requirements. | Add explicit requirements and traceability for execution profile enforcement and read-only consensus review. | Codex |
| SM-1 | Major | Resolved | 9, 15, 16 | Initial draft needed stronger stale approval and wrong-resume controls. | Add gate revision, decision validation, stale-decision fault case, and verification. | Codex |
| TR-1 | Major | Resolved | 11, 17 | Initial draft had incomplete mapping from triage behavior to verification. | Add VAL-9, VAL-10, ACC-6, and mapping rows for REQ-8 and REQ-14. | Codex |
| CR-1 | Major | Resolved | 13, 15, 17 | Consensus review found the runtime enforcement boundary too generic for R3. | Define `ExecutionProfile`, specify fail-closed launch enforcement, read-only bundle behavior, protected-path diff checks, denied capabilities, and negative verification. | Codex |
| CR-2 | Major | Resolved | 10, 11, 17 | Consensus review found REQ-12 verification coverage incomplete. | Add recovery fault cases, ACC-10 through ACC-12, VAL-13 through VAL-16, and updated traceability for cancellation, retry, abandonment, and provider-session fallback. | Codex |
| CR-3 | Major | Resolved | 13, 14 | Consensus review found runtime profiles ambiguous relative to existing registry sync profiles. | Rename the capability record to `ExecutionProfile` and define `execution-profile` as a separate non-installable registry record distinct from the existing sync `profile` package kind. | Codex |
| PR-1 | Major | Resolved | 8, 9, 10 | PR review found queue packaging ambiguous relative to read-only triage and open-item approval. | Remove `packaged` as a queue item state and define review packet packaging as derived artifact metadata that references still-open queue item IDs without mutating workflow state. | Codex |
| PR-2 | Major | Resolved | 16, 17 | PR review found rollback named as a heightened control without verification coverage. | Add rollback drill verification, rollback traceability, HC-4, and a CND-1 guard for preserving equivalent legacy bounded-turn behavior. | Codex |
| TS-1 | Major | Resolved | 5, 8, 9, 13, 15, 17 | Temporal skill review found approval decisions modeled as fire-and-forget signals even though callers need synchronous stale/accepted feedback. | Replace decision-signal language with Temporal decision Updates, typed `DecisionResult`, read-only validators, and Update verification. | Codex |
| TS-2 | Major | Resolved | 4, 10, 13, 15, 16, 17 | Temporal skill review found cancellation underspecified because activity cancellation is delivered through heartbeats. | Add heartbeat timeout, periodic heartbeat, provider abort propagation, heartbeat-backed acceptance and verification. | Codex |
| TS-3 | Major | Resolved | 4, 8, 10, 13, 14, 15, 16, 17 | Temporal skill review found cross-run queue listing and history growth underspecified. | Add search attributes or durable projection, compact artifact-reference state, history-budget controls, continue-as-new threshold, and projection rebuild verification. | Codex |
| TS-4 | Major | Resolved | 4, 5, 13, 15, 17 | Temporal skill review found replay compatibility under-specified for recipe-interpreter changes. | Add saved-history replay tests, `Worker.runReplayHistory`, and explicit patching/workflow-type/Worker Versioning decision gates. | Codex |
| TS-5 | Major | Resolved | 9, 10, 13, 15, 17, 18 | Temporal skill review recommended stronger retry/idempotency, consensus fanout, and Local Activity controls. | Add idempotency keys, retry error taxonomy, disabled nested client retries, child-workflow fanout rule, and Local Activity exclusion for agent execution. | Codex |
| VR-1 | Major | Resolved | 16 | May 25 validation found the observability table did not match the controlled `Signal` column expected by the design validation profile. | Rename the first observability table column from `Operational record` to `Signal`. | Codex |
| VR-2 | Major | Resolved | 17 | May 25 validation found `FUNC-6` lacked direct behavior-to-mechanism verification coverage in section 17. | Add the `FUNC-6` traceability row mapping reuse inspection to `TECH-16`, `TECH-17`, `TECH-18`, and `VAL-21`. | Codex |
| PSC-1 | Major | Resolved | 2, 4, 5, 12, 13, 15 | Project-shape pivot review found the adapter-first composition model too broad relative to the execution-decomposer direction. | Replace pairwise step transform composition with `ProjectShapeContract` records over durable project facts, views, reads, writes, produced facts, artifacts, gates, side-effect class, and execution-profile constraints. | Codex |
| PSC-2 | Major | Resolved | 18 | Project-shape pivot review found BEL-910/D-5 completed under the prior model and should not be silently edited. | Add Q-6 as the superseding decision and preserve BEL-910/D-5 as historical evidence. | Codex |
| PSC-3 | Major | Resolved | 8, 10, 16, 17 | Project-shape pivot review found verification still centered on pairwise transform diagnostics. | Update acceptance, observability, VAL-21, and traceability to prove required facts are satisfied, produced facts are declared, protected writes are denied, bounded loops remain valid, and prompt-only implicit state is rejected. | Codex |

### Heightened Controls

| Control ID | Applies through | Control | Owner | Verification |
| --- | --- | --- | --- | --- |
| HC-1 | Implementation / Launch | Execution profiles use deny-by-default tool, skill, MCP, approval-Update authority, and protected-path write policy enforcement. | `agent-config-registry` maintainer and activity runtime owner | VAL-4, VAL-10 |
| HC-2 | Implementation / Launch | Approval resume requires workflow execution ID, queue item ID, and gate revision match. | `workflow-temporal` maintainer | VAL-5 |
| HC-3 | Implementation / Launch | Mutating steps require one explicit worktree per run and preserve failed worktrees for inspection. | Activity runtime owner | VAL-6 |
| HC-4 | Implementation / Launch | Recipe-backed starts must have a tested rollback path: disable new recipe-backed starts, preserve failed worktrees, keep or prove equivalent legacy bounded-turn behavior, and revert registry recipe or execution profile publication to the last validated commit. | `workflow-temporal` maintainer and `agent-config-registry` maintainer | VAL-17 |
| HC-5 | Implementation / Launch | Human gate decisions use Temporal Updates with typed `DecisionResult`; stale, invalid, unauthorized, and no-effect decisions must not resume a workflow. | `workflow-temporal` maintainer | VAL-5 |
| HC-6 | Implementation / Launch | Recipe-interpreter changes require saved-history replay evidence and an explicit Temporal versioning strategy before merge. | `workflow-temporal` maintainer | VAL-2, VAL-19 |
| HC-7 | Implementation / Launch | Agent activities require heartbeat-backed cancellation, idempotency-scoped retry policy, and compact artifact-reference state before live provider use. | Activity runtime owner | VAL-13, VAL-18, VAL-20 |
| HC-8 | Implementation / Launch | Registry workflow composition requires `ProjectShapeContract` records, derived project-shape transition diagnostics, optional external materializer constraints, and bounded loop/guard semantics before WP-2. | `agent-config-registry` maintainer | VAL-21, VAL-22 |

### Approval Conditions

| Condition ID | Required before | Condition | Owner |
| --- | --- | --- | --- |
| CND-1 | Implementation start | Approve whether the recipe-backed workflow is a new workflow type or an evolution of `agent.helloClaudex`; default recommendation is a new workflow type. | Jason Belmonti |
| CND-2 | Launch | Independent capability-policy reviewer signs off on read-only execution profile negative tests. | Independent capability-policy reviewer |
| CND-3 | Before WP-2 registry workflow records | Satisfied historically on 2026-05-01 by BEL-910 approval of D-5, then superseded by Q-6; any revision to `ProjectShapeContract` fields, optional external materializer records, derived project-shape transition output, loop/guard fields, pinned snapshot compatibility, or the no-microservice MVP boundary must update Q-6 or record an approved deviation. | Jason Belmonti and registry contract reviewer |
