---
title: Evidence capture — bash to Python refactor
status: draft
branch: tmchow/generalize-evidence-capture
---

# Evidence Capture: Bash → Python Refactor

## Problem

The evidence-capture skill has too much deterministic logic encoded as agent instructions. The agent reads tier reference files and composes 3-15 shell commands per capture, interpreting ffmpeg flags, silicon arguments, and VHS tape syntax every time. This creates variance (the agent can miscompose commands), is untestable (agent interpretation isn't unit-testable), and wastes tokens on boilerplate the agent shouldn't be thinking about.

The bash script (`capture-evidence.sh`) only wraps stitch + upload — the bare minimum. The tier execution, tool preflight, project detection, and tier recommendation are all in markdown that the agent interprets at runtime.

## Goal

Move all deterministic execution into a Python script. The agent's role shrinks to judgment calls: what to capture, which tier, capture strategy (which pages/commands/states), and user approval. The script handles how.

## Design Principles (where we diverge from OSC)

OSC's `capture-evidence.py` is a good reference but serves a different context:

1. **OSC has 7+ tiers including screen recording, Remotion, user-assisted capture.** CE has 4 tiers. Don't build commands we don't need.
2. **OSC uses `agent-capture` as a primary routing target.** CE doesn't have `agent-capture`. Our script wraps the underlying tools directly (ffmpeg, silicon, vhs, agent-browser).
3. **OSC's script handles CDP/Electron launch and polling.** CE's browser-reel tier uses agent-browser (a separate CLI tool), not direct CDP. The script shouldn't manage browser lifecycle — agent-browser does that.
4. **OSC has no retry on upload.** Our bash script's retry logic is better — keep it.

The principle: take the architectural pattern (script as execution engine, skill as judgment orchestrator) but implement only what CE's 4 tiers need.

## Subcommands

```
python3 scripts/capture-evidence.py preflight
python3 scripts/capture-evidence.py detect [--repo-root PATH]
python3 scripts/capture-evidence.py recommend --project-type TYPE --change-type TYPE --tools JSON
python3 scripts/capture-evidence.py screenshot-reel --output OUT.gif FRAME1.png [FRAME2.png ...]
python3 scripts/capture-evidence.py terminal-recording --output OUT.gif --tape TAPE_PATH
python3 scripts/capture-evidence.py stitch --output OUT.gif [--duration N] FRAME1.png [FRAME2.png ...]
python3 scripts/capture-evidence.py upload FILE
```

### `preflight`

Check tool availability. Output JSON to stdout:

```json
{"agent_browser": true, "vhs": false, "silicon": true, "ffmpeg": true, "ffprobe": true}
```

Replaces 4 separate `command -v` shell calls the agent currently runs.

### `detect`

Detect project type from manifests. Output JSON:

```json
{"type": "cli-tool", "reason": "package.json has bin field"}
```

Replaces the agent reading `references/project-detection.md` and interpreting manifest-reading logic.

### `recommend`

Pure lookup table. Input: project type, change type, tool availability. Output JSON:

```json
{
  "recommended": "screenshot-reel",
  "available": ["screenshot-reel", "terminal-recording", "static-screenshots"],
  "reasoning": "CLI tool with discrete states, silicon + ffmpeg available"
}
```

Replaces the agent interpreting the tier recommendation table in SKILL.md Step 6.

### `screenshot-reel`

Render text/code frames through silicon, then stitch into GIF. Input: PNG frame files (pre-rendered by the agent using silicon, or rendered by this command from text files).

Two modes:
- **PNG mode**: `screenshot-reel --output out.gif frame1.png frame2.png` — normalize + stitch (same as current `stitch`)
- **Text mode**: `screenshot-reel --output out.gif --text frame1.txt frame2.txt --lang bash --theme Dracula` — render through silicon first, then stitch

### `terminal-recording`

Run a VHS tape file, validate output, check size. Input: path to `.tape` file.

```json
{"gif_path": "/tmp/run-xxx/demo.gif", "size_mb": 2.3}
```

The agent still writes the `.tape` file (that requires judgment about what commands to run). The script just executes it.

### `stitch`

Port of current bash `stitch` — normalize frame dimensions, two-pass palette, auto-reduce if >10MB. Already working, just rewritten in Python.

### `upload`

Port of current bash `upload` — catbox.moe with retry. Already working, just rewritten in Python with proper error handling (no `set -e` footguns).

## What stays in the skill

The SKILL.md orchestration flow (Steps 0-8) stays, but becomes lighter:

| Step | Before (agent does) | After (agent does) |
|---|---|---|
| Step 0: Target discovery | Read diff, form hypothesis | Same (judgment) |
| Step 1: Exercise feature | Run/navigate the product | Same (judgment) |
| Step 2: Detect project type | Read reference file, parse manifests | `python3 scripts/capture-evidence.py detect` |
| Step 3: Assess change type | Classify motion vs states | Same (judgment) |
| Step 4: Tool preflight | 4 shell commands, format summary | `python3 scripts/capture-evidence.py preflight` |
| Step 5: Create run directory | 2 shell commands | Same (trivial) |
| Step 6: Recommend tier | Interpret lookup table | `python3 scripts/capture-evidence.py recommend ...` |
| Step 7: Execute tier | Read tier reference, compose 3-8 commands | Compose capture inputs (which pages/commands), call script subcommand |
| Step 8: Upload + approval | Call script upload, ask user | Same |

The 4 tier reference files (`references/tier-*.md`) shrink significantly. They no longer contain ffmpeg flags, silicon arguments, or VHS invocation details. They describe **what to capture** (which screenshots to take, which commands to record) and hand off the **how** to the script.

## What changes in tier references

### `tier-browser-reel.md`
- **Before**: Agent runs `agent-browser` commands to capture PNGs, then runs `bash scripts/capture-evidence.sh stitch`
- **After**: Agent runs `agent-browser` commands to capture PNGs (still judgment — which pages, what states), then runs `python3 scripts/capture-evidence.py stitch`. Minimal change — agent-browser capture is already the agent's job.

### `tier-terminal-recording.md`
- **Before**: Agent writes `.tape` file, runs `vhs`, checks output size manually
- **After**: Agent writes `.tape` file (judgment — what commands, timing), runs `python3 scripts/capture-evidence.py terminal-recording --tape demo.tape --output out.gif`. Script handles VHS invocation, size validation, error reporting.

### `tier-screenshot-reel.md`
- **Before**: Agent runs multiple `silicon` commands with flags, then runs `bash scripts/capture-evidence.sh stitch`
- **After**: Agent decides frame content (judgment), runs `python3 scripts/capture-evidence.py screenshot-reel --text frame1.txt frame2.txt --output out.gif`. Script handles silicon rendering + stitching in one call.

### `tier-static-screenshots.md`
- **Before**: Agent runs agent-browser or silicon commands individually
- **After**: Same — static screenshots are simple enough that wrapping doesn't add value. The upload step uses the script.

## Implementation order

1. **Write `scripts/capture-evidence.py`** with all subcommands. Port bash stitch + upload logic, add preflight, detect, recommend, screenshot-reel, terminal-recording.
2. **Write tests** (`tests/capture-evidence-py.test.ts`) — Bun test file that shells out to the Python script. Test preflight, detect (with fixture manifests), recommend (all table combinations), stitch (with test PNGs), upload error paths.
3. **Update SKILL.md** — replace inline shell commands with script calls for Steps 2, 4, 6.
4. **Update tier reference files** — slim down to capture strategy (judgment) + script invocation (deterministic).
5. **Remove `scripts/capture-evidence.sh`** and update `tests/capture-evidence.test.ts` to test the Python script instead.
6. **Run `bun test` and `bun run release:validate`**.

## Risks

- **Python availability**: User said this is not a real concern for CE target users. Python 3 ships with macOS and virtually all Linux.
- **Two scripts during transition**: Briefly both bash and Python exist. Step 5 removes the bash script cleanly.
- **agent-browser interaction stays in skill**: This is intentional — agent-browser is an agent tool, not a CLI pipeline. The script doesn't try to wrap it.

## Not doing

- Screen recording (OSC has it, CE doesn't need it)
- Electron CDP management (agent-browser handles this)
- Remotion/animation generation (OSC-specific)
- User-assisted capture tier (OSC-specific)
- `--no-upload` flag (CE always uploads or skips — the approval gate handles this)
