# Evals

Behavioral evaluations for agents and skills shipped by this repo's plugins. **Repo-only — these do not ship with the plugin.**

## When to use this directory

Use `evals/` when validating behavior that is shaped by an agent or skill prompt and can only be measured by running an LLM. Examples:

- Confirming an agent adheres to a tool-call cap or stop-when-complete rule
- Comparing dispatch-prompt variants for token / wall-time efficiency
- Catching regressions where an agent's behavioral guardrails get unwound

For deterministic checks that do not need a live LLM (script output, parser correctness, manifest parity), use `tests/` and run via `bun test`.

## How evals run

Evals dispatch the target agent via the Agent tool from inside an active Claude Code session. They cannot run via `bun test` — there is no Agent tool in the test runner. Each eval is a self-contained directory with:

- `fixtures/` — synthetic inputs (e.g., session-file layouts under `~/.claude/projects/-tmp-eval-...`)
- `run.ts` (or `run.md`) — orchestration: set up fixtures, dispatch the agent, capture metrics, clean up, report
- `expected.md` — success criteria

Each eval cleans up its own fixtures on completion. No shared global state.

## How to dispatch — use the `skill-creator` pattern

**Always use the `skill-creator` skill (or its dispatch pattern) to run agent/skill evals.** Do not dispatch the typed agent (e.g., `Agent({subagent_type: "compound-engineering:ce-session-historian"})`) from inside the same session you are editing the agent in — that path runs the in-memory copy loaded at session start, not your edits.

Skill-creator's pattern: spawn a `general-purpose` subagent and inject the agent or skill definition's full content into the subagent's prompt at dispatch time. Each run sources content from the current filesystem, so iteration works within a single session. See `session-historian/run.md` for a worked example.

**Do NOT edit `~/.claude/plugins/cache/` or `~/.claude/plugins/marketplaces/` to try to force a reload.** Those paths are user machine state, not repo-managed; modifying them does not reliably bypass the in-session cache, can be silently overwritten by plugin updates, and is the wrong layer to test from. The skill-creator pattern sidesteps the cache without touching machine state.

If skill-creator is unavailable for some reason and you need to dispatch via the typed agent path, the only correct fallback is to exit and restart the Claude Code session so the new definition loads at next session boot. Prefer skill-creator over restart for fast iteration.

Mechanical changes (skill scripts like the `--keyword` mode on `extract-metadata.py`, parser logic, conversion code) do not have this restriction — `bun test` always runs the current source. Only LLM-driven agent or skill prose behavior is affected by the session-start cache.

## Running an eval

From within Claude Code in this repo, ask the agent to run a specific eval:

```
Run evals/session-historian/run.ts and report the results
```

The orchestration script handles fixture setup, agent dispatch, measurement, and cleanup.

## Why a top-level directory

Evals are conceptually distinct from `tests/` (deterministic, fast, runs in CI) and `scripts/release/` (build/release tooling). They cost real LLM tokens and wall time per run, which is why they live separately and are not invoked from `bun test`. The dedicated directory makes the shipping boundary explicit: `evals/` never lands in `~/.claude/plugins/cache/...` after a marketplace install.
