---
name: lfg
description: Run the complete engineering pipeline from idea to PR -- brainstorm, plan, implement, review, test, and record. Use when you have a feature description and want end-to-end execution.
argument-hint: "[feature description]"
disable-model-invocation: true
---

Execute every step below in order. The early phases (brainstorm, plan) exist to prevent wasted implementation work, so they must complete before coding begins. Skills run in pipeline mode: skip workflow prompts (handoff menus, "what next?" options) but still ask content questions when requirements or scope are unclear.

1. `/ce:brainstorm $ARGUMENTS`

   Brainstorm runs in pipeline mode: it assesses whether requirements exploration is needed and either skips (if requirements are already clear) or runs brainstorm with content questions as needed and writes a requirements document. It will not present handoff options or invoke `/ce:plan` -- control returns here.

2. **Optional:** If the `ralph-loop` skill is available, run `/ralph-loop:ralph-loop "finish all slash commands" --completion-promise "DONE"` to iterate autonomously through the remaining steps. Brainstorm ran first because it may need user interaction; everything from here on is autonomous and benefits from ralph's fresh-context iteration. If not available or it fails, continue to step 3.

3. `/ce:plan $ARGUMENTS`

   GATE: Verify that `ce:plan` produced a plan file in `docs/plans/`. If no plan file was created, run `/ce:plan $ARGUMENTS` again. Do NOT proceed until a written plan exists.

4. **Conditionally** run `/compound-engineering:deepen-plan`

   Run only if the plan is `Standard` or `Deep`, touches a high-risk area (auth, security, payments, migrations, external APIs, significant rollout concerns), or still has obvious confidence gaps in decisions, sequencing, system-wide impact, risks, or verification.

   GATE: If deepen-plan ran, confirm the plan was deepened or judged sufficiently grounded. If skipped, briefly note why and proceed.

5. `/ce:work`

   GATE: Verify that implementation work was performed -- files were created or modified beyond the plan. Do NOT proceed if no code changes were made.

6. `/ce:review` -- catch issues before they ship

7. `/compound-engineering:test-browser` -- verify the feature works in a real browser

8. `/compound-engineering:resolve-todo-parallel` -- resolve findings from review and testing, compound on learnings, clean up completed todos

9. **Conditionally** run `/compound-engineering:feature-video` -- record a walkthrough and add to the PR. Skip if the project has no browser-based UI (e.g., CLI tools, plugins, libraries, APIs).

10. Output `<promise>DONE</promise>` when all preceding steps are complete

Start with step 1 now.
