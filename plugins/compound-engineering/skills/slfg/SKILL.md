---
name: slfg
description: Run the complete engineering pipeline from idea to PR with parallel execution via swarm agents. Same pipeline as lfg but parallelizes work and review phases for speed.
argument-hint: "[feature description]"
disable-model-invocation: true
---

Swarm-enabled LFG. Run these steps in order, parallelizing where indicated. Skills run in pipeline mode: skip workflow prompts (handoff menus, "what next?" options) but still ask content questions when requirements or scope are unclear.

## Brainstorm Phase

1. `/ce:brainstorm $ARGUMENTS`
   - Brainstorm runs in pipeline mode: it assesses whether requirements exploration is needed and either skips (if requirements are already clear) or runs brainstorm with content questions as needed and writes a requirements document. It will not present handoff options or invoke `/ce:plan` -- control returns here.

2. **Optional:** If the `ralph-loop` skill is available, run `/ralph-loop:ralph-loop "finish all slash commands" --completion-promise "DONE"` to iterate autonomously through the remaining steps. Brainstorm ran first because it may need user interaction; everything from here on is autonomous and benefits from ralph's fresh-context iteration. If not available or it fails, continue to step 3.

## Sequential Phase

3. `/ce:plan $ARGUMENTS`

   GATE: Verify that `ce:plan` produced a plan file in `docs/plans/`. If no plan file was created, run `/ce:plan $ARGUMENTS` again. Do NOT proceed until a written plan exists.

4. **Conditionally** run `/compound-engineering:deepen-plan`
   - Run only if the plan is `Standard` or `Deep`, touches a high-risk area (auth, security, payments, migrations, external APIs, significant rollout concerns), or still has obvious confidence gaps in decisions, sequencing, system-wide impact, risks, or verification
   - If deepen-plan ran, confirm the plan was deepened or judged sufficiently grounded before moving on
   - If skipped, note why and continue

5. `/ce:work` -- **Use swarm mode**: Make a Task list and launch an army of agent swarm subagents to build the plan

   GATE: Verify that implementation work was performed -- files were created or modified beyond the plan. Do NOT proceed if no code changes were made.

## Parallel Phase

After work completes, read `compound-engineering.local.md` frontmatter for `autopilot_features` settings (if missing, assume all enabled). Launch steps 6 and 7 as **parallel swarm agents** (both only need code to be written):

6. `/ce:review` -- catch issues before they ship
7. **Conditionally** run `/compound-engineering:test-browser` -- verify the feature works in a real browser. Skip if `autopilot_features.test_browser` is `false`. If the setting is missing, assume enabled.

Wait for both to complete before continuing.

## Finalize Phase

8. `/compound-engineering:resolve-todo-parallel` -- resolve findings from review and testing, compound on learnings, clean up completed todos
9. **Conditionally** run `/compound-engineering:feature-video` -- record a walkthrough and add to the PR. Skip if `autopilot_features.feature_video` is `false`. If the setting is missing, assume enabled. Also skip if the project has no browser-based UI (e.g., CLI tools, plugins, libraries, APIs).
10. Output `<promise>DONE</promise>` when all preceding steps are complete

Start with step 1 now.
