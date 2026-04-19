import { describe, expect, test } from "bun:test"
import os from "os"
import path from "path"
import { resolveTargetOutputRoot } from "../src/utils/resolve-output"

const baseOptions = {
  outputRoot: "/tmp/output",
  codexHome: path.join(os.homedir(), ".codex"),
  piHome: path.join(os.homedir(), ".pi", "agent"),
  hasExplicitOutput: false,
}

describe("resolveTargetOutputRoot", () => {
  test("codex returns codexHome", () => {
    const result = resolveTargetOutputRoot({ ...baseOptions, targetName: "codex" })
    expect(result).toBe(baseOptions.codexHome)
  })

  test("pi returns piHome", () => {
    const result = resolveTargetOutputRoot({ ...baseOptions, targetName: "pi" })
    expect(result).toBe(baseOptions.piHome)
  })

  test("cursor with no explicit output uses cwd", () => {
    const result = resolveTargetOutputRoot({ ...baseOptions, targetName: "cursor" })
    expect(result).toBe(path.join(process.cwd(), ".cursor"))
  })

  test("cursor with explicit output uses outputRoot", () => {
    const result = resolveTargetOutputRoot({
      ...baseOptions,
      targetName: "cursor",
      hasExplicitOutput: true,
    })
    expect(result).toBe(path.join("/tmp/output", ".cursor"))
  })

  test("opencode returns outputRoot as-is", () => {
    const result = resolveTargetOutputRoot({ ...baseOptions, targetName: "opencode" })
    expect(result).toBe("/tmp/output")
  })

  test("qwen uses qwenHome + pluginName", () => {
    const result = resolveTargetOutputRoot({
      ...baseOptions,
      targetName: "qwen",
      qwenHome: "/custom/qwen/extensions",
      pluginName: "my-plugin",
    })
    expect(result).toBe("/custom/qwen/extensions/my-plugin")
  })

  test("qwen falls back to default home when not provided", () => {
    const result = resolveTargetOutputRoot({
      ...baseOptions,
      targetName: "qwen",
      pluginName: "my-plugin",
    })
    expect(result).toBe(path.join(os.homedir(), ".qwen", "extensions", "my-plugin"))
  })
})
