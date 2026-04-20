import path from "path"
import type { TargetScope } from "../targets"

export function resolveTargetOutputRoot(options: {
  targetName: string
  outputRoot: string
  codexHome: string
  piHome: string
  pluginName?: string
  hasExplicitOutput: boolean
  scope?: TargetScope
}): string {
  const { targetName, outputRoot, codexHome, piHome, hasExplicitOutput } = options
  if (targetName === "codex") return codexHome
  if (targetName === "pi") return piHome
  if (targetName === "gemini") {
    const base = hasExplicitOutput ? outputRoot : process.cwd()
    return path.join(base, ".gemini")
  }
  if (targetName === "kiro") {
    const base = hasExplicitOutput ? outputRoot : process.cwd()
    return path.join(base, ".kiro")
  }
  return outputRoot
}
