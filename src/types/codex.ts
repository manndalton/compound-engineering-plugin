import type { ClaudeMcpServer } from "./claude"
import type { CodexInvocationTargets } from "../utils/codex-content"

export type CodexPrompt = {
  name: string
  content: string
}

export type CodexSkillDir = {
  name: string
  sourceDir: string
}

export type CodexGeneratedSkill = {
  name: string
  content: string
  sidecarDirs?: CodexGeneratedSkillSidecarDir[]
}

export type CodexGeneratedSkillSidecarDir = {
  sourceDir: string
  targetName: string
}

export type CodexAgent = {
  name: string
  description: string
  instructions: string
  sidecarDirs?: CodexGeneratedSkillSidecarDir[]
}

export type CodexBundle = {
  pluginName?: string
  prompts: CodexPrompt[]
  skillDirs: CodexSkillDir[]
  generatedSkills: CodexGeneratedSkill[]
  agents?: CodexAgent[]
  invocationTargets?: CodexInvocationTargets
  mcpServers?: Record<string, ClaudeMcpServer>
}
