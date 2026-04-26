import { readdirSync, readFileSync, statSync } from "fs"
import path from "path"
import { describe, expect, test } from "bun:test"

/**
 * Skill `!` backtick pre-resolution commands run through Claude Code's shell
 * permission checker at skill-load time. The checker rejects bash `case`
 * statements outright (`Error: ... Contains case_statement`), which fails the
 * skill before its body ever runs. AGENTS.md guidance for the `!`
 * pre-resolution exception allows `&&`, `||`, `2>/dev/null`, and fallback
 * sentinels — but `case ... esac` is not on that allowlist.
 *
 * Past incidents:
 *   - PR #699 introduced a `case "$common" in /*) ... ;; *) ... ;; esac` block
 *     into ce-compound and ce-sessions to derive a worktree-stable repo name.
 *     The cleaner replacement is
 *     `basename "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)")"`.
 */

const PLUGIN_SKILLS_GLOB = ["plugins/compound-engineering/skills", "plugins/coding-tutor/skills"]

function listSkillFiles(): string[] {
  const out: string[] = []
  for (const rel of PLUGIN_SKILLS_GLOB) {
    const root = path.join(process.cwd(), rel)
    try { statSync(root) } catch { continue }
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const skillDir = path.join(root, entry.name)
      function walk(dir: string) {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, e.name)
          if (e.isDirectory()) { walk(full); continue }
          if (e.name.endsWith(".md")) out.push(full)
        }
      }
      walk(skillDir)
    }
  }
  return out
}

function findPreResolutionLines(body: string): { lineNumber: number; command: string }[] {
  const found: { lineNumber: number; command: string }[] = []
  const lines = body.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const matches = line.matchAll(/!`([^`]*)`/g)
    for (const m of matches) {
      found.push({ lineNumber: i + 1, command: m[1] })
    }
  }
  return found
}

describe("skill `!` pre-resolution commands avoid Claude Code denylist", () => {
  const files = listSkillFiles()

  for (const filePath of files) {
    const rel = path.relative(process.cwd(), filePath)
    const body = readFileSync(filePath, "utf8")
    const preResolutionLines = findPreResolutionLines(body)
    if (preResolutionLines.length === 0) continue

    test(`${rel} pre-resolution commands contain no \`case\`/\`esac\` (blocked by Claude Code permission check)`, () => {
      const offenders = preResolutionLines.filter(({ command }) =>
        /\bcase\b/.test(command) && /\besac\b/.test(command),
      )
      const formatted = offenders
        .map(({ lineNumber, command }) => `  line ${lineNumber}: ${command}`)
        .join("\n")
      expect(
        offenders,
        `Claude Code rejects \`case ... esac\` in \`!\` pre-resolution commands. Use \`if\`/\`then\`/\`else\` or \`&&\`/\`||\` chaining, or \`git rev-parse --path-format=absolute --git-common-dir\` for worktree-stable repo names.\nOffending commands:\n${formatted}`,
      ).toEqual([])
    })
  }
})
