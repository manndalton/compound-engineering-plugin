# Install Strategy Inventory

Last verified: 2026-04-19

This document records the intended install model by harness. The current priority is separating native marketplace installs from custom Bun installs so CE does not create duplicate or shadowing skills across tools.

## Summary

| Harness | Intended install path | Custom Bun install? | Legacy cleanup needed? | Notes |
| --- | --- | --- | --- | --- |
| Claude Code | Native plugin marketplace using existing `.claude-plugin/marketplace.json` and `plugins/compound-engineering/.claude-plugin/plugin.json` | No | Only for old/manual non-native installs, if any | Current repo shape already satisfies Claude Code. |
| GitHub Copilot CLI | Native plugin marketplace using the same existing `.claude-plugin` metadata | No, CE plugin install/convert target removed | Yes, before or during migration from previous `.github/` custom installs | Tested manually: Copilot can install from the existing CE marketplace and load agents. |
| Factory Droid | Native plugin marketplace pointed at the CE GitHub repository | No, CE plugin install/convert target removed | Yes, before or during migration from previous `~/.factory` custom installs | Droid docs say Claude Code plugins install directly and are translated automatically; `ce-doc-review` was manually tested in Droid. |
| OpenCode | Custom CE install to `~/.config/opencode/{skills,agents,commands,plugins}` plus merged `opencode.json` | Yes | Yes, every install | OpenCode plugins are JS/TS or npm hooks/tools, not a Claude-compatible marketplace install path for CE's full plugin payload. |
| Codex | Custom CE install to `~/.codex/skills/compound-engineering/<skill>` | Yes, until Codex has a simple distributed plugin marketplace/install flow | Yes, every install | Avoid `~/.agents/skills` so Codex installs do not shadow Copilot's native plugin skills. Current output converts Claude agents into generated Codex skills; TOML custom agents remain a future migration option. |
| Gemini CLI | Custom CE install to `~/.gemini/{skills,agents,commands}` for now; native extension packaging remains a future distribution option | Yes, until Gemini extension distribution is solved | Yes, every install | Avoid `~/.agents/skills`; write normalized Gemini agents to `~/.gemini/agents`. |

Deprecated targets:

- Windsurf is no longer an active CE install, convert, or sync target. `cleanup --target windsurf` remains available only to back up old CE-owned files from previous Bun installs under `~/.codeium/windsurf/` or workspace `.windsurf/`.

Removed capabilities:

- Personal Claude Code home sync (`bunx @every-env/compound-plugin sync`) has been removed. Syncing arbitrary `~/.claude` skills, commands, agents, and MCP config across unrelated harnesses is not a bounded compatibility surface; CE only supports installing the CE plugin and cleaning up old CE-owned artifacts.

## Global Decision: Avoid `~/.agents` For CE-Owned Installs

Do not install CE-owned skills or agents into `~/.agents` for normal target installs.

Several harnesses read `~/.agents/skills`, but Copilot CLI gives personal/project skill roots precedence over plugin skills. A CE skill written for Codex, Gemini, Pi, or another target into `~/.agents/skills` can silently shadow the same skill from Copilot's native plugin install. That makes `~/.agents` unsafe as a shared CE-managed install root.

Use target-owned roots instead:

```text
OpenCode: ~/.config/opencode/skills/<skill>/SKILL.md
          ~/.config/opencode/agents/<agent>.md
          ~/.config/opencode/commands/*.md
          ~/.config/opencode/opencode.json

Codex:  ~/.codex/skills/compound-engineering/<skill>/SKILL.md
        Future option: ~/.codex/agents/<ce-agent>.toml

Gemini: ~/.gemini/skills/<skill>/SKILL.md
        ~/.gemini/agents/<agent>.md
        ~/.gemini/commands/*.toml

Copilot: managed by native plugin install under ~/.copilot
Droid:   managed by native plugin install under ~/.factory for user scope
```

`~/.agents/skills` remains a cleanup target only, because prior CE installs or experiments may have left shadowing skills there.

## Claude Code

### Decision

Claude Code is already satisfied by the current repo layout:

- Root marketplace: `.claude-plugin/marketplace.json`
- Plugin root: `plugins/compound-engineering/`
- Plugin manifest: `plugins/compound-engineering/.claude-plugin/plugin.json`
- Plugin components: `agents/`, `skills/`, `commands/`, and related files under the plugin root

Users install with:

```text
/plugin marketplace add EveryInc/compound-engineering-plugin
/plugin install compound-engineering
```

No custom Bun install or conversion should be used for Claude Code.

### Cleanup

Native Claude plugin installs are owned by Claude Code. The CE cleanup command should not delete Claude Code's plugin cache. It should only handle explicitly known old/manual CE artifacts if we discover any historical non-native Claude install path.

## GitHub Copilot CLI

### Decision

Copilot should use native plugin install, not `bunx @every-env/compound-plugin install compound-engineering --to copilot`.
The custom Copilot plugin install/convert target has been removed from the CLI target registry.

Copilot CLI can read:

- Marketplace manifests from `.claude-plugin/marketplace.json`
- Plugin manifests from `.claude-plugin/plugin.json`
- Plugin agents from the plugin `agents/` directory
- Plugin skills from the plugin `skills/` directory

Users install inside Copilot CLI with:

```text
/plugin marketplace add EveryInc/compound-engineering-plugin
/plugin install compound-engineering@compound-engineering-plugin
```

Shell equivalents:

```bash
copilot plugin marketplace add EveryInc/compound-engineering-plugin
copilot plugin install compound-engineering@compound-engineering-plugin
```

Do not add a parallel `.github/plugin/marketplace.json`, `.github/plugin/plugin.json`, or generated `agents-copilot/` directory unless a real compatibility failure appears. Manual testing showed Copilot can install from the existing CE marketplace and load CE agents.

Copilot skill conflicts are not displayed like Codex duplicate skills. Copilot deduplicates skills by the `name` field in `SKILL.md` using first-found-wins precedence. Project and personal skill locations, including `~/.agents/skills`, load before plugin skills. Therefore a stale `~/.agents/skills/ce-plan/SKILL.md` with `name: ce-plan` would shadow the plugin's `ce-plan` and the plugin skill would be silently ignored.

### Cleanup

The old custom Copilot target wrote generated files under `.github/`-style output. Users who installed that way should run CE legacy cleanup before or during migration so they do not have duplicate agents or skills from both the old Bun output and the native plugin.

For Copilot, "duplicate" often means silent shadowing rather than two visible entries. Cleanup must remove CE-owned stale skills from project and personal skill roots before switching to native plugin install, otherwise users can appear to have the native plugin installed while actually running an old flat skill.

Run:

```bash
bunx @every-env/compound-plugin cleanup --target copilot
```

The cleanup command backs up known CE-owned Copilot artifacts such as:

- Generated `.github/agents/*.agent.md` files from old installs
- Generated `.github/skills/*/SKILL.md` directories from old installs
- Generated `~/.copilot/{agents,skills}` files from personal old installs
- Shared `~/.agents/skills/*` CE skills that would shadow native Copilot plugin skills
- Any tracked install-manifest entries from the old writer

It must not delete user-authored `.github/agents` or `.github/skills` content unless manifest/history proves CE ownership.

## Factory Droid

### Decision

Droid should use native plugin marketplace install, not `bunx @every-env/compound-plugin install compound-engineering --to droid`.
The custom Droid plugin install/convert target has been removed from the CLI target registry.

Users install with:

```bash
droid plugin marketplace add https://github.com/EveryInc/compound-engineering-plugin
droid plugin install compound-engineering@compound-engineering-plugin
```

Factory's docs describe GitHub marketplace installation, user/project/org plugin scopes, and direct Claude Code plugin compatibility. They explicitly say Droid can install a Claude Code plugin directly and automatically translate the format. Manual testing on 2026-04-19 confirmed Droid could run `ce-doc-review` from the CE plugin and load both the skill and agents.

This means Droid is now in the same category as Claude Code and Copilot for CE distribution: use the native marketplace/plugin install path, not a generated custom Bun install.

### Cleanup

The old custom Droid target wrote CE-owned artifacts under `~/.factory`, especially:

- `~/.factory/skills/*`
- `~/.factory/droids/*.md`
- `~/.factory/commands/*.md`
- any CE install manifest or managed backup directory created by the old writer

Before users migrate from the old Bun install to the native Droid plugin, legacy cleanup should remove or back up CE-owned generated files so the native plugin is not shadowed by stale local artifacts.

Run:

```bash
bunx @every-env/compound-plugin cleanup --target droid
```

The cleanup command must not delete Droid's native plugin cache or user-authored Droid files. It should only remove artifacts proven to be CE-owned by an install manifest, known historical CE names, or generated CE metadata.

## OpenCode

### Current Platform Facts

OpenCode's current install/discovery model is file-based:

- Skills are direct child directories with `SKILL.md` under `.opencode/skills/<name>/`, `~/.config/opencode/skills/<name>/`, `.claude/skills/<name>/`, `~/.claude/skills/<name>/`, `.agents/skills/<name>/`, or `~/.agents/skills/<name>/`.
- Agents can be configured in `opencode.json` or as Markdown files under `~/.config/opencode/agents/` or `.opencode/agents/`.
- Commands can be configured in `opencode.json` or as Markdown files under `~/.config/opencode/commands/` or `.opencode/commands/`.
- Plugins are JavaScript/TypeScript modules loaded from `.opencode/plugins/` or `~/.config/opencode/plugins/`, or npm packages listed in the `plugin` option in `opencode.json`.

OpenCode has a plugin system, but it is not equivalent to Claude/Copilot/Droid plugin marketplaces. The official docs describe JS/TS hooks, custom tools, local plugin files, and npm package loading. They do not document a native marketplace command that can point at the CE GitHub repository, read `.claude-plugin/marketplace.json`, and install CE skills/agents/commands as a complete plugin.

### Decision

Keep the custom CE OpenCode writer for now:

```text
~/.config/opencode/opencode.json
~/.config/opencode/skills/<skill>/SKILL.md
~/.config/opencode/agents/<agent>.md
~/.config/opencode/commands/*.md
~/.config/opencode/plugins/*.ts
~/.config/opencode/compound-engineering/install-manifest.json
```

This matches OpenCode's documented global config root and lets CE convert the full Claude-authored payload: skills, agents, commands, hooks/plugins, and MCP config. An npm OpenCode plugin could be useful later for hooks/tools, but it would not replace the need to place CE skills and agents into OpenCode's discovery roots unless OpenCode adds a richer package/install surface.

Avoid `~/.agents/skills` for CE-managed OpenCode installs for the same reason as Codex and Gemini: OpenCode can read that shared root, but Copilot can also read it and shadow native plugin skills.

### Cleanup

The OpenCode custom writer should continue to track and clean CE-owned files on every install:

- Old CE-owned `~/.config/opencode/skills/*`
- Old CE-owned `~/.config/opencode/agents/*`
- Old CE-owned `~/.config/opencode/commands/*`
- Old CE-owned `~/.config/opencode/plugins/*`
- Old CE-owned shared skills under `~/.agents/skills/*` from previous experiments or installs
- Manifest-tracked files that disappeared because a skill, agent, or command was renamed or removed

## Codex

### Current Platform Facts

Current Codex docs describe user skills under `~/.agents/skills` and repo skills under `.agents/skills`. Codex also reads admin skills from `/etc/codex/skills` and system skills bundled by OpenAI. Codex supports symlinked skill folders and follows symlink targets.

Empirical note: Codex also still discovers legacy `~/.codex/skills` entries. On 2026-04-18, we created the same skill name in both `~/.agents/skills/ce-duplicate-discovery-smoke` and `~/.codex/skills/ce-duplicate-discovery-smoke`; the Codex skill picker showed both entries.

Despite current Codex docs favoring `~/.agents/skills`, CE should not write there because those files can shadow Copilot's native plugin skills. CE should use the Codex-specific compatibility root:

```text
~/.codex/skills/compound-engineering/<skill-name>/SKILL.md
```

This shape keeps CE Codex skills isolated from Copilot/Gemini shared discovery roots while still giving Codex a namespaced skill pack.

Codex also has custom agents and a plugin model:

- Custom agents are standalone TOML files under `~/.codex/agents/` or `.codex/agents/`.
- Each custom agent requires `name`, `description`, and `developer_instructions`.
- Codex only spawns subagents when explicitly asked.

Codex plugins exist, but current public distribution is still local/personal:

- Repo marketplace: `$REPO_ROOT/.agents/plugins/marketplace.json`
- Personal marketplace: `~/.agents/plugins/marketplace.json`
- Typical personal plugin storage: `~/.codex/plugins/<plugin-name>`
- Installed plugin cache: `~/.codex/plugins/cache/<marketplace>/<plugin>/<version>/`
- Official public plugin publishing is still marked as coming soon.

This means Codex has a plugin model, but not yet a Copilot-style "point at GitHub marketplace repo and install globally" distribution path that is good enough to replace our CE custom install for normal users.

### What Superpowers Does

Superpowers' Codex install guide is a skill-discovery install, not a Codex plugin install:

```bash
git clone https://github.com/obra/superpowers.git ~/.codex/superpowers
mkdir -p ~/.agents/skills
ln -s ~/.codex/superpowers/skills ~/.agents/skills/superpowers
```

The real content lives under:

```text
~/.codex/superpowers
```

The discovery entry lives under:

```text
~/.agents/skills/superpowers -> ~/.codex/superpowers/skills
```

So `~/.codex/superpowers` is the backing store, and `~/.agents/skills/superpowers` is a symlink used to make Codex discover the skills. Their migration instructions also remove an old bootstrap block from `~/.codex/AGENTS.md`, which implies an earlier non-skill-discovery install path.

This is useful, but it has tradeoffs we should not copy blindly:

- It requires users to clone and update a Git repo manually.
- It uses a namespaced subfolder under `~/.agents/skills`.
- It is optimized for Codex, but `~/.agents/skills` can shadow Copilot native plugin skills.
- It works for pass-through source skills, but CE's Codex target also generates target-specific artifacts from agents/commands, transforms content, writes prompt wrappers, and manages cleanup. A raw clone plus symlink would still need a generation/cleanup step unless we intentionally drop those converted artifacts.

The useful part to emulate is the idea of isolating a plugin's files under a named folder. The part to avoid is writing CE-owned files into `~/.agents/skills` or requiring a manual clone/update workflow for normal users.

### Subfolder Decision

Do not use `~/.agents/skills` for CE Codex installs. Even if Codex discovers it, Copilot also reads it and will let those skills shadow native plugin skills.

For CE's Codex target, use a Codex-specific namespaced folder:

```text
~/.codex/skills/compound-engineering/<skill-name>/SKILL.md
```

This is not the documented modern Codex skill path, so the implementation should keep a smoke test for current Codex discovery behavior. The tradeoff is intentional: we prefer a Codex-only compatibility path over writing to a shared root that breaks Copilot plugin isolation.

### Source-of-Truth Decision

For Codex, `~/.codex` is the durable source of truth for CE-owned Codex artifacts. Keep all generated Codex artifacts under Codex-owned roots and track them with a manifest:

```text
~/.codex/skills/compound-engineering/<skill-name>/SKILL.md
~/.codex/compound-engineering/install-manifest.json
```

Do not create symlinks from `~/.agents/skills` to these Codex-owned files.

### Intended CE Codex Plan

For now:

- Keep a custom CE Codex install path.
- Run legacy cleanup on every custom Codex install.
- Install generated/converted skills under `~/.codex/skills/compound-engineering/<skill-name>/SKILL.md`.
- Continue converting Claude Markdown agents to generated Codex skills in this branch.
- Treat flat Codex custom-agent TOML files under `~/.codex/agents/<ce-agent-name>.toml` as a follow-up migration option, not current output.
- If that migration lands, use direct `~/.codex/agents/*.toml` files because current Codex docs describe one standalone TOML file per agent under `~/.codex/agents/` or `.codex/agents/`; do not assume nested agent directories are discovered.
- If that migration lands, name converted agents with a CE/category prefix, for example `ce-review-correctness-reviewer` or `ce-research-repo-research-analyst`, and rewrite skill orchestration text to spawn those names.
- Track generated skills in `~/.codex/compound-engineering/install-manifest.json`; extend the manifest for generated agents only if TOML custom-agent output is implemented.
- Keep Codex-only artifacts under `~/.codex`, such as prompt wrappers, `config.toml` MCP entries, and any future Codex TOML custom agents.
- Keep current `Task`/agent reference rewrites pointed at generated Codex skills until a TOML custom-agent migration is implemented.
- Track an install manifest so removed skills and renamed skills can be cleaned later.
- Track historical CE artifacts from git history so old flat installs, prompt files, and converted-agent skills can be cleaned safely.

Do not require users to clone the CE repo for Codex. The CLI should continue to fetch/install from the package or branch source, then write the local Codex-compatible output.

### Smoke Test Result

On 2026-04-18, we verified the proposed Codex split with a local smoke test:

```text
~/.agents/skills/ce-codex-agent-smoke/SKILL.md
~/.codex/agents/ce-codex-agent-smoke.toml
```

The skill explicitly asked Codex to spawn the `ce_codex_agent_smoke` custom agent. Codex discovered the skill, spawned the TOML custom agent, waited for completion, and returned the expected marker:

```text
CODEX_TOML_AGENT_SMOKE_OK
```

This confirms the intended CE Codex architecture is viable: workflow skills can invoke Claude-authored agents converted to Codex TOML custom agents in `~/.codex/agents`. The skill root should now be moved from the tested `~/.agents/skills` path to the isolated CE path under `~/.codex/skills/compound-engineering`.

On the same day, we verified duplicate discovery behavior by installing two skills with the same `name`:

```text
~/.agents/skills/ce-duplicate-discovery-smoke/SKILL.md
~/.codex/skills/ce-duplicate-discovery-smoke/SKILL.md
```

Codex displayed both skill entries in the picker, one from `~/.agents/skills` and one from `~/.codex/skills`. This confirms that any old CE skills left in either root can cause visible duplicates. Cleanup must remove CE-owned stale skills from both `~/.agents/skills` and legacy flat `~/.codex/skills` before writing the namespaced `~/.codex/skills/compound-engineering` install.

Also on 2026-04-18, we tested nested skill discovery across Codex, Copilot, and Gemini with three shapes:

```text
~/.agents/skills/ce-flat-discovery-smoke/SKILL.md
~/.agents/skills/ce-nested-pack/ce-nested-discovery-smoke/SKILL.md
~/.agents/skills/ce-symlink-pack -> ~/.agents/ce-discovery-packs/ce-symlink-pack/skills
```

Results:

| Harness | Flat direct skill | Regular nested skill | Superpowers-style symlink pack |
| --- | --- | --- | --- |
| Codex | Worked | Worked | Worked |
| Copilot CLI | Worked | Not found | Not found |
| Gemini CLI | Worked | Not found | Not found |

Conclusion for shared skill roots: cross-harness `~/.agents/skills` installs only work portably when skills are direct children:

```text
~/.agents/skills/<skill-name>/SKILL.md
```

But CE should no longer install there because Copilot plugin skills can be shadowed by `~/.agents/skills`. Treat these results as cleanup/discovery context, not the target install shape.

### Future Codex Plugin Option

Revisit Codex native plugins when one of these becomes true:

- Official public plugin directory publishing is available.
- Codex supports a simple remote GitHub marketplace install flow comparable to Copilot.
- We decide that a documented "copy marketplace.json into `~/.agents/plugins` and install from the directory" flow is acceptable for CE users.

Until then, Codex native plugins are useful for local development and testing, but not the primary user install path.

## Gemini CLI

### Current Platform Facts

Gemini has two relevant install surfaces:

1. Shared/user skills:
   - Workspace skills: `.gemini/skills/` or `.agents/skills/`
   - User skills: `~/.gemini/skills/` or `~/.agents/skills/`
   - Extension skills bundled inside installed extensions
2. Extensions:
   - Installed with `gemini extensions install <source>`
   - `<source>` can be a GitHub repository URL or a local path
   - Gemini copies the extension during installation
   - Installed extensions live under `~/.gemini/extensions`
   - `gemini extensions link <path>` symlinks a local development extension for immediate iteration

Gemini extension roots require `gemini-extension.json`. An extension can bundle:

- `skills/<skill-name>/SKILL.md`
- `commands/*.toml`
- `agents/*.md` for preview subagents
- `GEMINI.md` context via `contextFileName`
- MCP server config
- hooks
- policies
- themes

For remote distribution and public gallery discovery, Gemini requires `gemini-extension.json` at the absolute root of the GitHub repository or release archive. `gemini extensions install <source>` accepts a GitHub repository URL or local path, but the documented and locally verified command does not include a monorepo `--path` option for extension installs.

Gemini subagents are Markdown files with YAML frontmatter. Local user/project agents are documented under:

```text
~/.gemini/agents/*.md
.gemini/agents/*.md
```

Extension subagents are documented under:

```text
<extension-root>/agents/*.md
```

The shared `.agents/*` alias is documented for skills, not subagents.

Gemini CLI 0.38.2 implementation confirms this: user agents resolve to `~/.gemini/agents`, project agents resolve to `.gemini/agents`, while shared aliases exist only for skill directories (`~/.agents/skills` and `.agents/skills`). Do not use `~/.agents/agents` as a shared CE agent install root for Gemini.

### Discovery Test Result

On 2026-04-18, we tested Gemini shared skill discovery with three shapes:

```text
~/.agents/skills/ce-flat-discovery-smoke/SKILL.md
~/.agents/skills/ce-nested-pack/ce-nested-discovery-smoke/SKILL.md
~/.agents/skills/ce-symlink-pack -> ~/.agents/ce-discovery-packs/ce-symlink-pack/skills
```

Gemini discovered only the flat direct skill. It did not discover the regular nested skill or the Superpowers-style symlink pack.

If `~/.agents/skills` is used manually, Gemini-compatible skills must be direct children:

```text
~/.agents/skills/<skill-name>/SKILL.md
```

CE should not use that path for managed Gemini installs because it can shadow Copilot plugin skills.

### Intended CE Gemini Plan

For now, keep a custom CE Gemini install path and write directly to Gemini-owned roots:

```text
~/.gemini/skills/<skill-name>/SKILL.md
~/.gemini/agents/<agent-name>.md
~/.gemini/commands/*.toml
~/.gemini/compound-engineering/install-manifest.json
```

The Gemini writer should copy pass-through skills to `~/.gemini/skills`, generate normalized flat Gemini subagents in `~/.gemini/agents`, and write command TOML files under `~/.gemini/commands` if CE ships commands again.

Native Gemini extension packaging remains a future distribution option. It would require a generated extension root with `gemini-extension.json` at the repository/release archive root; current Gemini extension install does not support a documented monorepo `--path` flow.

Open questions to validate in implementation:

- Whether Gemini supports any undocumented repository subdirectory syntax for extensions. Current docs and local help only show whole GitHub repository URLs or local paths.
- Whether the current Claude plugin root can also be a valid Gemini extension root by adding `gemini-extension.json`, or whether Gemini-specific generated payload should live in a separate extension directory. Current evidence favors a generated/normalized payload because Gemini only loads direct `agents/*.md` files, CE agents are nested under category directories, and some CE agent frontmatter contains Claude-only fields.
- Whether Gemini preview subagents are enabled by default for all users or require settings in some versions/environments.
- How Gemini extension subagent invocation names map from nested Claude agent paths.

### Cleanup

The Gemini custom writer must clean old CE-owned artifacts so users do not see duplicates or stale converted-agent skills.

Cleanup should cover:

- Old CE-owned `.gemini/skills/*`
- Old CE-owned `.gemini/agents/*`
- Old CE-owned `.gemini/commands/*`
- Old CE-owned `~/.gemini/skills/*`
- Old CE-owned `~/.gemini/agents/*`
- Old CE-owned `~/.gemini/commands/*`
- Any CE-owned flat shared skills under `~/.agents/skills/*` from older experiments or installs
- Any future CE-owned extension install if we need to uninstall/reinstall a broken pre-release

## Sources

- Claude/Copilot marketplace metadata: `.claude-plugin/marketplace.json`
- Claude plugin manifest: `plugins/compound-engineering/.claude-plugin/plugin.json`
- Copilot plugin reference: `https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference`
- Copilot CLI plugins overview: `https://docs.github.com/en/copilot/concepts/agents/copilot-cli/about-cli-plugins`
- Factory Droid plugin configuration: `https://docs.factory.ai/cli/configuration/plugins`
- Factory Droid plugin build guide: `https://docs.factory.ai/guides/building/building-plugins`
- OpenCode config: `https://opencode.ai/docs/config/`
- OpenCode skills: `https://opencode.ai/docs/skills`
- OpenCode agents: `https://opencode.ai/docs/agents/`
- OpenCode commands: `https://opencode.ai/docs/commands/`
- OpenCode plugins: `https://opencode.ai/docs/plugins/`
- Codex skills: `https://developers.openai.com/codex/skills`
- Codex plugin build/distribution docs: `https://developers.openai.com/codex/plugins/build`
- Superpowers Codex install guide: `https://github.com/obra/superpowers/blob/main/.codex/INSTALL.md`
- Gemini extension reference: `https://geminicli.com/docs/extensions/reference/`
- Gemini extension build guide: `https://geminicli.com/docs/extensions/writing-extensions/`
- Gemini skills: `https://geminicli.com/docs/cli/skills/`
- Gemini subagents: `https://geminicli.com/docs/core/subagents/`
- Gemini subagents announcement: `https://developers.googleblog.com/subagents-have-arrived-in-gemini-cli/`
