import { describe, expect, test } from "bun:test"
import path from "path"
import { loadClaudePlugin } from "../src/parsers/claude"
import { convertClaudeToCodex } from "../src/converters/claude-to-codex"
import { convertClaudeToPi } from "../src/converters/claude-to-pi"
import { getLegacyCodexArtifacts, getLegacyPiArtifacts, getLegacyWindsurfArtifacts } from "../src/data/plugin-legacy-artifacts"

describe("plugin legacy artifacts", () => {
  test("includes current and historical CE artifacts for Codex cleanup", async () => {
    const plugin = await loadClaudePlugin(path.join(import.meta.dir, "..", "plugins", "compound-engineering"))
    const bundle = convertClaudeToCodex(plugin, {
      agentMode: "subagent",
      inferTemperature: true,
      permissions: "none",
    })

    const artifacts = getLegacyCodexArtifacts(bundle)

    expect(artifacts.skills).toContain("ce-plan")
    expect(artifacts.skills).toContain("ce:plan")
    expect(artifacts.skills).toContain("ce:plan-beta")
    expect(artifacts.skills).toContain("ce-review")
    expect(artifacts.skills).toContain("ce:review-beta")
    expect(artifacts.skills).toContain("ce-document-review")
    expect(artifacts.skills).toContain("repo-research-analyst")
    expect(artifacts.skills).toContain("bug-reproduction-validator")
    expect(artifacts.skills).toContain("report-bug")
    expect(artifacts.skills).toContain("reproduce-bug")

    expect(artifacts.prompts).toContain("report-bug.md")
    expect(artifacts.prompts).toContain("workflows-review.md")
    expect(artifacts.prompts).toContain("technical_review.md")
  })

  test("includes current and historical CE artifacts for Pi cleanup", async () => {
    const plugin = await loadClaudePlugin(path.join(import.meta.dir, "..", "plugins", "compound-engineering"))
    const bundle = convertClaudeToPi(plugin, {
      agentMode: "subagent",
      inferTemperature: true,
      permissions: "none",
    })

    const artifacts = getLegacyPiArtifacts(bundle)

    expect(artifacts.skills).toContain("bug-reproduction-validator")
    expect(artifacts.skills).toContain("repo-research-analyst")
    expect(artifacts.skills).toContain("reproduce-bug")
    expect(artifacts.skills).not.toContain("ce:plan")
    expect(artifacts.skills).not.toContain("ce-plan")

    expect(artifacts.prompts).toContain("report-bug.md")
    expect(artifacts.prompts).toContain("workflows-review.md")
    expect(artifacts.prompts).toContain("technical_review.md")
  })

  test("includes current and historical CE artifacts for deprecated Windsurf cleanup", async () => {
    const plugin = await loadClaudePlugin(path.join(import.meta.dir, "..", "plugins", "compound-engineering"))

    const artifacts = getLegacyWindsurfArtifacts(plugin)

    expect(artifacts.skills).toContain("ce-plan")
    expect(artifacts.skills).toContain("ce-review")
    expect(artifacts.skills).toContain("reproduce-bug")
    expect(artifacts.skills).toContain("repo-research-analyst")

    expect(artifacts.workflows).toContain("workflows-plan.md")
    expect(artifacts.workflows).toContain("ce-plan.md")
    expect(artifacts.workflows).toContain("technical_review.md")
  })
})
