---
name: ce:release-notes
description: Summarize recent compound-engineering plugin releases, or answer a specific question about a past release with a version citation. Use when the user types `/ce:release-notes` or asks "what changed in compound-engineering recently?" or "what happened to <skill-name>?".
argument-hint: "[optional: question about a past release]"
disable-model-invocation: true
---

# Compound-Engineering Release Notes

Look up what shipped in recent releases of the compound-engineering plugin. Bare invocation summarizes the last 10 plugin releases. Argument invocation answers a specific question, citing the release version that introduced the change.

Data comes from the GitHub Releases API for `EveryInc/compound-engineering-plugin`, filtered to the `compound-engineering-v*` tag prefix so sibling components (`cli-v*`, `coding-tutor-v*`, `marketplace-v*`, `cursor-marketplace-v*`) are excluded.

## Phase 1 — Parse Arguments

Split the argument string on whitespace. Strip every token that starts with `mode:` — these are reserved flag tokens; v1 does not act on them but still strips them so a stray `mode:foo` is not treated as a query string. Join the remaining tokens with spaces and apply `.strip()` to the result.

- Empty result → **summary mode** (continue to Phase 2).
- Non-empty result → **query mode** (skip to Phase 5).

Version-like inputs (`2.65.0`, `v2.65.0`, `compound-engineering-v2.65.0`) are query strings, not a separate lookup-by-version mode. They flow through query mode like any other text.

## Phase 2 — Fetch Releases (Summary Mode)

Run the helper from the skill directory:

```bash
python3 scripts/list-plugin-releases.py --limit 40
```

The helper always exits 0 and emits a single JSON object on stdout. It owns all transport logic (`gh` preferred, anonymous API fallback) — never branch on transport here.

If the helper subprocess itself fails to launch (non-zero exit AND empty or non-JSON stdout — e.g., `python3` is not installed, the script is not executable, or the interpreter crashes before emitting the contract), tell the user:

> `python3` is required to run `/ce:release-notes`. Install Python 3.x and retry, or open https://github.com/EveryInc/compound-engineering-plugin/releases directly.

Then stop. This is distinct from the helper returning `ok: false`, which means the helper ran successfully but both transports failed (handled below).

Parse the JSON. The shape on success is:

```json
{
  "ok": true,
  "source": "gh" | "anon",
  "fetched_at": "...",
  "releases": [
    {"tag": "compound-engineering-v2.67.0", "version": "2.67.0", "name": "...",
     "published_at": "2026-04-17T05:59:30Z", "url": "...", "body": "...",
     "linked_prs": [568, 575]}
  ]
}
```

The shape on failure is:

```json
{"ok": false, "error": {"code": "rate_limit" | "network_outage",
                         "message": "...", "user_hint": "..."}}
```

`source` is recorded for telemetry but **not** surfaced to the user — falling back from `gh` to anonymous is a stability signal, not a user-facing event.

## Phase 3 — Render Summary

If `ok: false`, print `error.message`, a blank line, then `error.user_hint`. Stop.

If `ok: true`, take the first 10 entries from `releases` (the helper has already filtered to `compound-engineering-v*` and sorted newest first). If fewer than 10 are available, render whatever count came back without warning.

For each release, render:

```
## v{version} ({published_at_human})

{body, soft-capped at 25 rendered lines}

[Full release notes →]({url})
```

`{published_at_human}` is the date in `YYYY-MM-DD` form derived from `published_at`. `{body}` is the release-please body verbatim, with one transformation:

**Soft 25-line cap.** If the body exceeds 25 rendered lines, keep the first 25 lines and append `— N more changes, [see full release notes →]({url})`. Truncation must be **markdown-fence aware**: count the triple-backtick fence lines that appear in the kept portion. If the count is odd, the cut landed inside an open code fence; close it with a `` ``` `` line on the truncated output before appending the "see more" link, so renderers do not swallow the link or following content.

After all releases are rendered, append a one-line footer:

```
Browse all releases at https://github.com/EveryInc/compound-engineering-plugin/releases
```

Stop. Summary mode is done.

## Phase 4 — Query Mode

Query mode is described in the next section. (This section is added in a follow-up unit; for now, if Phase 1 routes here, fall back to summary mode.)
