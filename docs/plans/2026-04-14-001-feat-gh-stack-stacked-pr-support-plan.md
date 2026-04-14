---
title: "feat: Add stacked PR support via gh-stack integration"
type: feat
status: active
date: 2026-04-14
---

# feat: Add stacked PR support via gh-stack integration

## Overview

Large PRs created by AI coding agents get shallow reviews and ship bugs. This plan adds stacked PR support across the compound-engineering plugin so developers can decompose big changes into small, reviewable PR chains using GitHub's `gh stack` CLI extension. The integration covers three scenarios: **retroactive splitting** (developer explicitly splits a big branch), **shipping-time suggestion** (agent detects a large change and suggests stacking), and (deferred) **planned stacking** during execution.

## Problem Frame

AI coding agents produce large, monolithic PRs. A developer vibe-codes a feature with `ce:work`, tests pass, and the result is an 800-line PR touching 40 files across 4 concerns. Reviewers either rubber-stamp it or delay reviewing for days. The code ships without real scrutiny.

GitHub's `gh stack` extension (currently in private preview) enables stacked PRs: a chain of small PRs where each targets the branch of the PR below it. CI runs against the final target, the GitHub UI shows a stack navigator, and merging one PR auto-rebases the rest. The missing piece is agent awareness -- the agent needs to know when to suggest stacking, how to split changes into a stack, and how to use `gh stack` commands for push/submit.

## Requirements Trace

- R1. A new `git-stack` skill that can split an existing branch into stacked PRs
- R2. `git-commit-push-pr` detects large changes and suggests stacking before creating a single PR
- R3. `git-commit-push-pr` uses `gh stack push`/`gh stack submit` when operating within an existing stack
- R4. `ce-work` and `ce-work-beta` offer stacking as a shipping option in Phase 4
- R5. `ce-setup` recommends installing the `gh stack` extension
- R6. All skills gracefully handle `gh stack` not being installed (hard gate in `git-stack`, soft suggestion elsewhere)
- R7. Stack detection uses a bundled script, not model reasoning, for mechanical state analysis

## Scope Boundaries

- No planned stacking during ce-work's execution loop (creating stack layers as implementation units complete). This requires changing the Phase 2 execution loop, which is the highest-risk area of the plugin. For reference, ce-work phases are: Phase 1 (setup), Phase 2 (execution loop -- agent writes code), Phase 3 (quality check), Phase 4 (shipping). This plan adds stacking at Phase 4 only.
- No auto-stacking without user consent. The agent suggests; the developer decides.
- No stack management beyond initial creation (rebasing within a stack, resolving cross-PR conflicts). `gh stack` handles this natively.
- No changes to `git-commit` -- it creates commits, which is orthogonal to PR stacking.

### Deferred to Separate Tasks

- Planned stacking during execution: future iteration after retroactive splitting is validated
- Stack-aware `resolve-pr-feedback`: propagating review fixes across dependent PRs in a stack

## Context & Research

### Relevant Code and Patterns

- **Pre-resolution pattern** for tool detection: `!`command -v X && echo "AVAILABLE" || echo "NOT_FOUND"`` -- used in `ce-work-beta` for Codex detection, directly applicable to gh-stack detection
- **Script-first architecture**: `ce-setup/scripts/check-health`, `git-worktree/scripts/worktree-manager.sh` -- deterministic analysis belongs in scripts, not model reasoning
- **Reference file extraction**: conditional content exceeding ~50 lines goes in `references/` per the Codex delegation best practices learning. Stacking workflow logic is conditional (only when user opts in) and will exceed 50 lines
- **Skill-to-skill delegation**: "load the `git-stack` skill" semantic wording pattern, used throughout ce-work and shipping workflow
- **Dependency declaration**: `check-health` deps array is pipe-delimited (`name|tier|install_cmd|url`), adding a tool requires one line
- **Dual-path context**: pre-resolved data for Claude Code + context fallback command for other platforms

### Institutional Learnings

- **State machine modeling** (`docs/solutions/skill-design/git-workflow-skills-need-explicit-state-machines-2026-03-27.md`): git workflow skills must model branch state explicitly. Stacked PRs add new dimensions: parent branch identity, stack ordering, stack membership. Each new state dimension multiplies the edge case surface.
- **Reference file extraction threshold** (`docs/solutions/best-practices/codex-delegation-best-practices-2026-04-01.md`): skill body content is carried in every subsequent message. Stacking logic is conditional and should live in reference files to avoid inflating non-stacking invocations.
- **Orchestration atomicity** (`docs/solutions/skill-design/beta-promotion-orchestration-contract.md`): cross-skill invocation changes must update callers atomically. The shipping workflow change (loading `git-stack` instead of `git-commit-push-pr`) is an orchestration contract change.
- **Script-first for deterministic work** (`docs/solutions/skill-design/script-first-skill-architecture.md`): git log parsing, stack detection, branch relationship analysis should be in bundled scripts, not model reasoning.

### External References

- gh-stack documentation: https://github.github.com/gh-stack/
- Key CLI commands: `gh stack init`, `gh stack add`, `gh stack push`, `gh stack submit`, `gh stack alias`
- Currently in private preview -- the extension may be installed but access not yet granted

## Key Technical Decisions

- **New standalone skill over extending existing**: Splitting a big branch into a stack is a fundamentally different operation from "commit and open a PR." It involves analyzing commit history, proposing layer boundaries, creating multiple branches, and submitting the whole stack. Cramming this into `git-commit-push-pr` would double that skill's complexity and violate its single-responsibility.

- **Retroactive splitting and shipping-time suggestion first, planned stacking deferred**: Retroactive splitting and shipping-time suggestion are additive -- they happen after execution, at shipping time. Planned stacking requires changing the ce-work execution loop, the riskiest part of the plugin. The original value proposition ("you already built the feature, now split it up") aligns with retroactive splitting.

- **Detection via gh extension list, not command -v**: `gh stack` is a gh CLI extension, not a standalone binary. `command -v gh-stack` will not work. Detection uses `gh extension list | grep gh-stack` for installation check, with a runtime `gh stack` command to verify access.

- **Recommended tier in ce-setup, not optional**: `gh stack` is broadly useful, zero-cost when installed but unused, and required for the agent to suggest stacking via shipping-time suggestion. `recommended` ensures it surfaces during setup.

- **Reference file extraction for all stacking logic**: Per the 50-line threshold learning, stacking workflow content in `git-commit-push-pr` and the splitting workflow in `git-stack` go in reference files. The main SKILL.md stays lean for non-stacking invocations.

- **Direct modification of stable skills (no beta)**: The changes to existing skills are additive and behind user opt-in (the agent asks, user confirms). The new `git-stack` skill is standalone. The risk profile does not warrant the beta framework overhead. The shipping workflow changes will be tested via frontmatter validation and manual verification.

## Open Questions

### Resolved During Planning

- **How to detect gh-stack installation?** `gh extension list 2>/dev/null | grep -q 'gh-stack'` for installation, `gh stack status` at runtime for access verification. Pre-resolution sentinel pattern: `GH_STACK_INSTALLED` / `GH_STACK_NOT_INSTALLED`.
- **What tier for ce-setup?** `recommended` -- broadly useful, zero-cost, enables agent suggestions.
- **Beta or direct?** Direct -- changes to existing skills are additive and behind user consent. New skill is standalone.

### Deferred to Implementation

- **Exact heuristics for "large change" suggestion threshold**: The right thresholds (file count, line count, concern count) depend on testing with real-world diffs. Start with reasonable defaults (20+ files AND 500+ lines AND 3+ distinct concerns -- all three must be met) and tune based on experience.
- **Partial file splitting**: The initial version assigns files to layers at the whole-file level. When the agent identifies a file whose changes span multiple concerns, it assigns the file to the layer that owns its primary concern and notes the cross-concern overlap in the PR description. Per-hunk splitting (via `git add -p` or diff reconstruction) is deferred to a follow-up iteration after the whole-file approach is validated.
- **Private preview access handling**: `gh stack` may be installed but return an access error. The runtime check (`gh stack status`) will surface this, but the exact error message format is not yet known.
- **Dependency readiness gate**: gh-stack is in private preview with no published GA timeline. Before starting Units 2-6, verify: (a) the CLI surface used in this plan is stable enough that preview-to-GA changes won't require rework, and (b) the implementer has access to test against. If either condition is unmet, ship Unit 1 + Unit 5's passive suggestion only and defer the full integration.

## Implementation Units

- [ ] **Unit 1: ce-setup -- Add gh-stack to check-health deps**

  **Goal:** Make `gh stack` discoverable during environment setup so developers learn about it and can install it.

  **Requirements:** R5

  **Dependencies:** None

  **Files:**
  - Modify: `plugins/compound-engineering/skills/ce-setup/scripts/check-health`

  **Approach:**
  Add one entry to the `deps` array. Gate on `gh` being present: since `gh stack` is a gh extension, it cannot be installed without the gh CLI. The detection command uses `gh extension list` instead of `command -v` because gh extensions are not standalone binaries.

  Override the standard `command -v` detection for this entry. The check-health script's detection loop uses `command -v "$name"`, which won't work for gh extensions. Add a narrow guard in the detection loop: if `$name` starts with `gh-`, detect via `gh extension list 2>/dev/null | grep -q "$name"` gated on `command -v gh`. This keeps the 4-field pipe format stable and generalizes to future gh extension deps. The detection loop change is small (~4 lines) but must be tested against all existing deps to verify no regression.

  **Patterns to follow:**
  - Existing `deps` array entries in `plugins/compound-engineering/skills/ce-setup/scripts/check-health`
  - The `has_brew` guard pattern for conditional checks

  **Test scenarios:**
  - Happy path: `gh` installed, `gh-stack` not installed -> script reports gh-stack as missing with install command `gh extension install github/gh-stack`
  - Happy path: `gh` installed, `gh-stack` installed -> script reports gh-stack as ok
  - Edge case: `gh` not installed -> script skips gh-stack check entirely (no confusing "install gh extension" when gh itself is missing)
  - Edge case: `gh` installed but no network -> install command fails gracefully with fallback URL

  **Verification:**
  - `bash plugins/compound-engineering/skills/ce-setup/scripts/check-health` runs without error and includes gh-stack in its output
  - Tool count in the summary line reflects the new dependency

---

- [ ] **Unit 2: git-stack skill -- Stack detection script**

  **Goal:** Create a deterministic script that analyzes git state for stacking: whether `gh stack` is available, whether the current branch is part of a stack, and a change summary suitable for proposing stack layers.

  **Requirements:** R6, R7

  **Dependencies:** None

  **Files:**
  - Create: `plugins/compound-engineering/skills/git-stack/scripts/stack-detect`

  **Approach:**
  The script runs three analysis passes and outputs structured, labeled sections:

  1. **Tool check**: `gh extension list | grep gh-stack` for installation, `gh stack status` for access
  2. **Stack state**: If on a branch, check if it's part of an existing stack (parse `gh stack status` output). Output one of: `NOT_IN_STACK`, `STACK_HEAD`, `STACK_MIDDLE`, `STACK_BOTTOM`. Per the state-machine learning, each state requires different routing in consuming skills (e.g., `gh stack push` behavior differs for head vs middle layers). Support a `--mock` flag or `STACK_DETECT_MOCK` env var to simulate gh-stack states for testing without the extension installed.
  3. **Change analysis**: When given a base branch argument, output summary stats (file count, line count, commit count, distinct directory prefixes as a rough signal for change spread -- not a reliable concern count, since a single feature often spans multiple directories)

  Output format: labeled sections with sentinel values, parseable by the skill without model reasoning. Example:
  ```
  === TOOL ===
  GH_STACK_INSTALLED
  === STACK_STATE ===
  NOT_IN_STACK
  === CHANGE_SUMMARY ===
  files: 35
  insertions: 620
  deletions: 180
  commits: 12
  directories: src/models, src/controllers, src/views, test/
  ```

  **Patterns to follow:**
  - `plugins/compound-engineering/skills/ce-setup/scripts/check-health` (structured shell output, sentinel values)
  - `plugins/compound-engineering/skills/git-worktree/scripts/worktree-manager.sh` (git state analysis in script)

  **Test scenarios:**
  - Happy path: gh-stack installed, on a feature branch with commits -> outputs all three sections with accurate data
  - Happy path: gh-stack installed, on a stack branch -> `STACK_STATE` section shows stack info
  - Edge case: gh-stack not installed -> `TOOL` section shows `GH_STACK_NOT_INSTALLED`, other sections still run (change analysis doesn't need gh-stack)
  - Edge case: gh not installed -> `TOOL` section shows `GH_NOT_INSTALLED`, graceful exit
  - Edge case: not in a git repo -> script exits with clear error
  - Edge case: no base branch argument -> skips change analysis section

  **Verification:**
  - Script is executable (`chmod +x`) and runs on macOS/Linux
  - Output is parseable by reading labeled sections

---

- [ ] **Unit 3: git-stack skill -- Core SKILL.md**

  **Goal:** Create the main skill file that enables developers to split an existing branch into stacked PRs or manage an existing stack.

  **Requirements:** R1, R6

  **Dependencies:** Unit 2

  **Files:**
  - Create: `plugins/compound-engineering/skills/git-stack/SKILL.md`

  **Approach:**
  The frontmatter should include `disable-model-invocation: true` to prevent auto-triggering on ambiguous input like "this PR is too big." The skill is invoked explicitly via `/git-stack` or delegated from `git-commit-push-pr`/shipping workflow. The splitting workflow's internal consent flow (user approves layer proposal) provides the second gate.

  The skill has two modes, detected from the user's input:

  - **Split mode** (default): "split this into stacked PRs", "stack my changes", "this PR is too big" -> analyze the current branch and decompose into a stack
  - **Manage mode**: "push the stack", "submit the stack", "stack status" -> run the corresponding `gh stack` command

  Structure:
  1. **Pre-resolution**: gh-stack availability check via the sentinel pattern
  2. **Availability gate**: If `GH_STACK_NOT_INSTALLED`, explain what gh-stack is, offer to install (`gh extension install github/gh-stack`), exit if declined
  3. **Mode routing**: Parse user intent into split or manage
  4. **Split mode**: Run `scripts/stack-detect` for change analysis, then load `references/splitting-workflow.md` for the full decomposition workflow
  5. **Manage mode**: Direct `gh stack` command execution (push, submit, status)

  Cross-platform interaction follows the standard pattern: `AskUserQuestion` with fallback to numbered options.

  **Patterns to follow:**
  - `plugins/compound-engineering/skills/git-commit-push-pr/SKILL.md` (pre-resolution, dual-path context, mode detection)
  - `plugins/compound-engineering/skills/ce-work-beta/SKILL.md` (availability gate with install offer, conditional reference loading)

  **Test scenarios:**
  - Happy path: gh-stack installed, user says "split this into stacked PRs" -> routes to split mode, runs stack-detect, loads splitting workflow
  - Happy path: gh-stack installed, user says "push the stack" -> routes to manage mode, runs `gh stack push`
  - Error path: gh-stack not installed, user declines install -> skill exits with pointer to `git-commit-push-pr`
  - Error path: gh-stack installed but no access (private preview) -> detect at runtime, explain the situation, suggest checking access
  - Edge case: on default branch with no feature work -> inform user there's nothing to stack

  **Verification:**
  - Frontmatter parses correctly (`bun test tests/frontmatter.test.ts`)
  - Skill loads without error in Claude Code
  - Pre-resolution sentinels resolve correctly

---

- [ ] **Unit 4: git-stack skill -- Splitting workflow reference**

  **Goal:** Define the full workflow for analyzing a branch and decomposing it into stacked PR layers.

  **Requirements:** R1

  **Dependencies:** Unit 3

  **Prerequisite:** Before implementing this unit, verify `gh stack` command signatures by running `gh stack --help`, `gh stack init --help`, `gh stack add --help`, and `gh stack submit --help`. The commands referenced below are based on external documentation for a private-preview extension and may differ from the actual CLI. Update command invocations to match verified signatures.

  **Files:**
  - Create: `plugins/compound-engineering/skills/git-stack/references/splitting-workflow.md`

  **Approach:**
  The splitting workflow has four phases:

  1. **Analyze**: Run `scripts/stack-detect` with the base branch. Read the full diff and commit history.

     **V1 strategy -- commit-based grouping (preferred):** Propose layers based on existing commit boundaries. Group consecutive commits that address the same concern. This is more deterministic (uses git cherry-pick ranges), preserves the developer's original intent, and avoids partial-file ambiguity.

     **V2 strategy -- semantic diff analysis (future):** The model identifies logical groupings by analyzing what the changes do semantically -- grouping by concern (data model, API, UI, infrastructure) rather than by file type. Defer this to a future iteration after commit-based splitting validates the workflow.

  2. **Propose layers**: Present a split plan to the developer. Each proposed layer includes:
     - Layer name and branch name (e.g., `feat/billing-data-model`)
     - Files in this layer
     - Estimated line count
     - What this layer accomplishes (one sentence)
     - Dependencies on prior layers

     Ask the developer to approve, adjust, or reject the proposal. Honor adjustments.

  3. **Create the stack**: Each layer branch is created on top of the previous one (layer 2 targets layer 1, etc.). For each approved layer, starting from the bottom:
     - `gh stack init <branch-name>` (first layer) or `gh stack add <branch-name>` (subsequent layers -- creates a branch from the current stack tip)
     - Check out only this layer's assigned files from the original branch: `git checkout <original-branch> -- <file1> <file2> ...`. Because the branch inherits the previous layer's commits, only files new to this layer need to be checked out
     - V1 constraint: assign each file to exactly one layer. When a file spans concerns, assign it to the layer where its primary changes belong and note cross-cutting nature in the PR description
     - Commit with a conventional message describing the layer
     - Verify the layer builds/passes basic checks before proceeding to the next

  4. **Submit**: `gh stack push` then `gh stack submit`. Each PR gets its own description following `git-commit-push-pr` writing principles, scoped to that layer's changes. The top-of-stack PR includes a note linking to the full stack.

  Include guidance on the "simplify and refactor" opportunity: as the agent constructs each layer, it can clean up code within that layer's scope -- removing dead imports, tightening interfaces, improving naming. This is the value highlighted in the original motivation.

  **Rollback protocol**: Before starting stack creation, record the original branch name and HEAD SHA. Complete all local branch construction and verify each layer before running `gh stack push` / `gh stack submit`. If any layer fails during local construction: report which branches were created, provide exact cleanup commands (branch deletion + return to original branch), and offer to abort (restoring original state) or adjust layer boundaries. Separating local construction from remote submission bounds failure blast radius to local state.

  **Patterns to follow:**
  - `plugins/compound-engineering/skills/ce-work-beta/references/codex-delegation-workflow.md` (conditional reference file with phased workflow)
  - `plugins/compound-engineering/skills/git-commit-push-pr/SKILL.md` Step 6 (PR description writing principles)

  **Test scenarios:**
  - Happy path: branch with 30 files across 3 concerns -> proposes 3 layers, user approves, stack created and submitted
  - Happy path: user adjusts proposal ("combine layers 1 and 2") -> adjusted split applied
  - Edge case: all changes in one concern -> suggest shipping as single PR instead of forcing a stack
  - Edge case: file appears in multiple proposed layers (partial changes) -> handle with selective checkout or hunk staging
  - Error path: test failure on intermediate layer -> pause, inform user, offer to adjust layer boundaries
  - Error path: merge conflict during file checkout -> inform user, suggest manual resolution or layer boundary adjustment

  **Verification:**
  - Reference file loads correctly from SKILL.md backtick path
  - Workflow phases are complete and sequenced correctly
  - PR description guidance aligns with git-commit-push-pr writing principles

---

- [ ] **Unit 5: git-commit-push-pr -- Stack awareness**

  **Goal:** Make `git-commit-push-pr` aware of stacked PRs: use `gh stack` commands when on a stack branch, and suggest stacking for large single-PR changes.

  **Requirements:** R2, R3, R6

  **Dependencies:** Unit 2 (detection patterns)

  **Files:**
  - Modify: `plugins/compound-engineering/skills/git-commit-push-pr/SKILL.md`
  - Create: `plugins/compound-engineering/skills/git-commit-push-pr/references/stack-aware-workflow.md`

  **Approach:**
  Two additions to the skill:

  **a. Pre-resolution addition** (SKILL.md, ~2 lines): Add a gh-stack detection pre-resolution alongside the existing context block:
  ```
  **gh-stack status:**
  !`gh extension list 2>/dev/null | grep -q gh-stack && echo "GH_STACK_INSTALLED" || echo "GH_STACK_NOT_INSTALLED"`
  ```

  **b. Stack-aware routing** (reference file, loaded conditionally): Between Step 5 (Push) and Step 6 (Write PR description), add a routing check:

  - If `GH_STACK_INSTALLED`: first check if the current branch is part of a stack (run `gh stack status` as a shell command -- do not use pre-resolution in the reference file). If in a stack, load `references/stack-aware-workflow.md` which replaces Steps 5-7 with `gh stack push` and `gh stack submit`. If NOT in a stack, check if the change is large (heuristic: 20+ files AND 500+ net lines AND 3+ distinct concerns) and suggest stacking. "This is a substantial change (N files, M lines across K areas). Splitting into stacked PRs makes review faster. Want to split? [Yes / No, ship as one PR]". If yes, load the `git-stack` skill. If no or gh-stack not installed, continue with single PR.
  - If `GH_STACK_NOT_INSTALLED` and the change triggers the large-change heuristic: mention the option with install path. "This change is large enough to benefit from stacked PRs. Install `gh stack` to enable this: `gh extension install github/gh-stack`". Then continue with single PR.

  Keep the SKILL.md changes minimal -- the pre-resolution line and a ~5-line routing stub that loads the reference file. All stack-aware logic lives in the reference file per the extraction threshold learning.

  **Patterns to follow:**
  - Existing pre-resolution block in `git-commit-push-pr/SKILL.md`
  - Reference file extraction pattern from `ce-work/references/shipping-workflow.md`
  - Large-change sizing from Step 6's sizing table

  **Test scenarios:**
  - Happy path: gh-stack installed, on a stack branch, changes to push -> uses `gh stack push` + `gh stack submit` instead of `git push` + `gh pr create`
  - Happy path: gh-stack installed, large change, user opts to stack -> loads git-stack skill
  - Happy path: gh-stack installed, small change -> no suggestion, normal single-PR flow
  - Happy path: gh-stack not installed, large change -> mentions gh-stack with install command, continues with single PR
  - Happy path: gh-stack not installed, small change -> no mention, normal flow
  - Edge case: already on a stack but changes are only to the current layer -> `gh stack push` for current layer only
  - Edge case: description-only update mode -> skip stack detection entirely (no changes to push)
  - Edge case: detached HEAD + gh-stack installed -> skip stack detection, defer to existing detached HEAD handling
  - Edge case: default branch + gh-stack installed + large change -> skip stack suggestion (must create feature branch first; stacking decision happens after)
  - Edge case: stack branch with no upstream -> verify `gh stack push` handles initial push
  - Edge case: shipping workflow passed "stacking_declined" context -> skip stacking suggestion entirely

  **Verification:**
  - Pre-resolution sentinel resolves correctly in both installed and uninstalled states
  - Existing non-stacking workflow is unaffected (no behavioral regression for the common case)
  - Reference file loads only when stack-related routing triggers
  - Frontmatter still parses correctly

---

- [ ] **Unit 6: Shipping workflow -- Stacking option at Phase 4**

  **Goal:** Give developers the option to ship as stacked PRs when ce-work finishes a substantial change.

  **Requirements:** R4, R6

  **Dependencies:** Unit 3 (git-stack skill exists)

  **Files:**
  - Modify: `plugins/compound-engineering/skills/ce-work/references/shipping-workflow.md`
  - Modify: `plugins/compound-engineering/skills/ce-work-beta/references/shipping-workflow.md`

  **Approach:**
  Add a stacking decision point at the beginning of Phase 4 "Ship It", before step 1 (Prepare Evidence Context). The decision point:

  1. Inline a lightweight stacking pre-check (do not reference git-stack's scripts -- cross-skill file references are prohibited). The inline check runs: (a) `gh extension list 2>/dev/null | grep -q gh-stack` for installation, and (b) `git diff --stat <base>..HEAD` for change size. The full `stack-detect` analysis runs inside the git-stack skill after the user opts in.
  2. If `GH_STACK_INSTALLED` and the completed work is substantial (same heuristic as Unit 5: 20+ files AND 500+ lines AND 3+ distinct concerns), ask: "This change spans N files across K areas. Ship as a single PR or split into stacked PRs for easier review?"
     - **Single PR**: Continue with existing Phase 4 flow (load `git-commit-push-pr`)
     - **Stacked PRs**: Load the `git-stack` skill instead. Pass the plan summary as context so the splitting workflow can use it to inform layer boundaries.
  3. If `GH_STACK_NOT_INSTALLED`, skip the check entirely (no noise for developers without gh-stack)

  Both ce-work and ce-work-beta share identical shipping workflows, so the same change applies to both files. The stacking heuristic and messaging must remain consistent across all three locations: (1) `git-commit-push-pr/references/stack-aware-workflow.md`, (2) `ce-work/references/shipping-workflow.md`, (3) `ce-work-beta/references/shipping-workflow.md`. Add a sync-obligation comment at the top of the stacking section in each file listing the other two locations.

  Important: per the file-reference constraint in AGENTS.md, the shipping workflow cannot reference `git-stack/scripts/stack-detect` directly. Instead, inline the key detection commands (gh extension list check + basic change stats via git diff --stat) as a lightweight pre-check. The full analysis runs inside the git-stack skill after the user opts in.

  **Patterns to follow:**
  - Existing Phase 4 structure in `plugins/compound-engineering/skills/ce-work/references/shipping-workflow.md`
  - Skill loading pattern: "Load the `git-stack` skill"
  - Conditional flow from Phase 3 (Tier 1 vs Tier 2 review decision)

  **Test scenarios:**
  - Happy path: gh-stack installed, large change, user chooses stacked PRs -> loads git-stack skill with plan context
  - Happy path: gh-stack installed, large change, user chooses single PR -> continues with git-commit-push-pr as before
  - Happy path: gh-stack installed, small change -> no suggestion, proceeds directly to git-commit-push-pr
  - Happy path: gh-stack not installed -> no mention of stacking, normal flow
  - Edge case: user invoked ce-work with a bare prompt (no plan file) -> stacking suggestion still works, but layer proposal is based on diff analysis alone rather than plan units

  **Verification:**
  - Both shipping workflow files (ce-work and ce-work-beta) contain identical stacking logic
  - Existing single-PR flow is unaffected when stacking is not chosen
  - The stacking option only appears when both gh-stack is installed and the change is substantial

---

- [ ] **Unit 7: Plugin README and validation**

  **Goal:** Update the plugin README to document the new git-stack skill and run release validation.

  **Requirements:** None (documentation housekeeping)

  **Dependencies:** Units 1-6

  **Files:**
  - Modify: `plugins/compound-engineering/README.md`

  **Approach:**
  - Add `git-stack` to the appropriate category table in the README (Git Workflow section alongside git-commit, git-commit-push-pr, git-worktree, git-clean-gone-branches)
  - Update the skill count in the plugin description
  - Run `bun run release:validate` to verify plugin/marketplace consistency
  - Run `bun test tests/frontmatter.test.ts` to verify all YAML frontmatter parses correctly

  **Patterns to follow:**
  - Existing skill entries in `plugins/compound-engineering/README.md`

  **Test scenarios:**
  - Happy path: `bun run release:validate` passes with updated counts
  - Happy path: `bun test tests/frontmatter.test.ts` passes for new SKILL.md
  - Edge case: skill count in plugin.json description needs updating -> update to match

  **Verification:**
  - All validation commands pass
  - README accurately reflects the new skill

## System-Wide Impact

- **Interaction graph:** The new `git-stack` skill is invoked from two entry points: directly by the user, or delegated from `git-commit-push-pr` / shipping workflow. It does not call back into those skills -- the relationship is one-directional. `ce-setup` is independent (discovery-time only).
- **Error propagation:** If `gh stack` commands fail (network, access, conflict), the git-stack skill handles the error locally and offers fallback to single-PR workflow. Errors do not propagate to calling skills.
- **State lifecycle risks:** Stack creation involves multiple branch operations. If the process fails mid-stack (e.g., conflict on layer 3 of 4), the partially created stack branches remain. The skill should report what was created and offer cleanup guidance.
- **API surface parity:** The stacking suggestion appears in both `git-commit-push-pr` (direct invocation) and shipping workflow (ce-work invocation). The heuristic and messaging should be consistent across both entry points.
- **Double-suggestion prevention:** When the shipping workflow (Unit 6) asks about stacking and the user declines, the subsequent `git-commit-push-pr` load must not re-ask. The shipping workflow should pass a "stacking_declined" context signal when loading `git-commit-push-pr`, and the stack-aware routing in Unit 5 should skip the suggestion when this signal is present.
- **Unchanged invariants:** The existing single-PR workflow in `git-commit-push-pr` is unaffected. The stacking option is purely additive -- it only activates when gh-stack is installed AND the user opts in. Non-stacking invocations pay only the cost of one pre-resolution line.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| gh-stack is in private preview -- developers may install it but lack access | Runtime `gh stack status` check after installation check. Clear error message with link to request access. Pin to a specific extension version via `gh extension install github/gh-stack --pin <tag>` when a stable tag exists. |
| Partial stack creation failure (conflict or error mid-stack) | Report what was created, offer cleanup guidance, preserve original branch as fallback |
| Large-change heuristic is too aggressive (suggests stacking on every PR) | Start conservative (20+ files AND 500+ lines AND 3+ concerns). Tune based on feedback. All three conditions must be met. |
| Cross-skill file reference constraint prevents sharing stack-detect script | Inline lightweight detection in shipping workflow; full analysis runs inside git-stack skill |
| gh-stack CLI interface changes during private preview | Use `gh stack` (full form) everywhere, not `gs` alias. Centralize all `gh stack` command invocations in `references/splitting-workflow.md` so CLI changes require a single-file update. Verify commands via `--help` before implementing. |
| No automated test coverage for stack-dependent code paths | `stack-detect` script supports `--mock` flag to simulate gh-stack states for testing. Add contract tests verifying pre-resolution sentinels produce valid output. |
| Maintenance surface across 7+ files for gh-stack CLI changes | Authoritative detection logic lives in `stack-detect` script. Shipping workflow inline check is intentionally minimal (single command) and should not be extended. Sync obligation documented in each file. |

## Sources & References

- External docs: https://github.github.com/gh-stack/
- Related learnings: `docs/solutions/skill-design/git-workflow-skills-need-explicit-state-machines-2026-03-27.md`
- Related learnings: `docs/solutions/best-practices/codex-delegation-best-practices-2026-04-01.md`
- Related learnings: `docs/solutions/skill-design/script-first-skill-architecture.md`
- Related learnings: `docs/solutions/skill-design/beta-promotion-orchestration-contract.md`
