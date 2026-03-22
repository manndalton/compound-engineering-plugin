---
name: resolve-todo-parallel
description: Resolve all pending CLI todos using parallel processing, compound on lessons learned, then clean up completed todos.
argument-hint: "[optional: specific todo ID or pattern]"
---

Resolve all TODO comments using parallel processing, document lessons learned, then clean up completed todos.

## Workflow

### 1. Analyze

Get all unresolved TODOs from the /todos/*.md directory

If any todo recommends deleting, removing, or gitignoring files in `docs/brainstorms/`, `docs/plans/`, or `docs/solutions/`, skip it and mark it as `wont_fix`. These are compound-engineering pipeline artifacts that are intentional and permanent.

### 2. Plan

Create a task list of all unresolved items grouped by type (e.g., `TaskCreate` in Claude Code, `update_plan` in Codex). Analyze dependencies and prioritize items that others depend on. For example, if a rename is needed, it must complete before dependent items. Output a mermaid flow diagram showing execution order — what can run in parallel, and what must run first.

### 3. Implement (PARALLEL)

Spawn a `compound-engineering:workflow:pr-comment-resolver` agent for each unresolved item.

If there are 3 items, spawn 3 agents — one per item. Prefer running all agents in parallel; if the platform does not support parallel dispatch, run them sequentially respecting the dependency order from step 2.

### 4. Commit & Resolve

- Commit changes
- Remove the TODO from the file, and mark it as resolved.
- Push to remote

GATE: STOP. Verify that todos have been resolved and changes committed. Do NOT proceed to step 5 if no todos were resolved.

### 5. Compound on Lessons Learned

Load the `ce:compound` skill to document what was learned from resolving the todos.

The todo resolutions often surface patterns, recurring issues, or architectural insights worth capturing. This step ensures that knowledge compounds rather than being lost.

GATE: STOP. Verify that the compound skill produced a solution document in `docs/solutions/`. If no document was created (user declined or no non-trivial learnings), continue to step 6.

### 6. Clean Up Completed Todos

List all todos and identify those with `done` or `resolved` status, then delete them to keep the todo list clean and actionable.

After cleanup, output a summary:

```
Todos resolved: [count]
Lessons documented: [path to solution doc, or "skipped"]
Todos cleaned up: [count deleted]
```
