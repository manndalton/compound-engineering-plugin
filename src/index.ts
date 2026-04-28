/**
 * compound-engineering-plugin
 * Main entry point for the Compound Engineering Plugin
 *
 * This plugin integrates with multiple AI coding assistants (Claude, Cursor, Agents)
 * to provide compound engineering workflows and PR triage capabilities.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  capabilities: string[];
}

export interface PluginConfig {
  /** Enable verbose logging */
  debug?: boolean;
  /** Base directory for plugin configuration files */
  configDir?: string;
  /** Target platform: 'claude' | 'cursor' | 'agents' */
  platform?: 'claude' | 'cursor' | 'agents';
}

export interface CompoundEngineeringPlugin {
  manifest: PluginManifest;
  config: PluginConfig;
  initialize(): Promise<void>;
  getCapabilities(): string[];
}

/**
 * Loads a marketplace manifest from the given path.
 */
export function loadManifest(manifestPath: string): PluginManifest {
  const raw = readFileSync(manifestPath, 'utf-8');
  const parsed = JSON.parse(raw);

  if (!parsed.name || !parsed.version) {
    throw new Error(`Invalid manifest at ${manifestPath}: missing required fields 'name' or 'version'`);
  }

  return {
    name: parsed.name,
    version: parsed.version,
    description: parsed.description ?? '',
    author: parsed.author,
    capabilities: parsed.capabilities ?? [],
  };
}

/**
 * Resolves the marketplace manifest path based on the target platform.
 */
export function resolveManifestPath(platform: PluginConfig['platform'], baseDir = '.'): string {
  const platformDirMap: Record<NonNullable<PluginConfig['platform']>, string> = {
    claude: '.claude-plugin',
    cursor: '.cursor-plugin',
    agents: '.agents/plugins',
  };

  const dir = platformDirMap[platform ?? 'claude'];
  return join(baseDir, dir, 'marketplace.json');
}

/**
 * Creates and returns a configured CompoundEngineeringPlugin instance.
 */
export function createPlugin(config: PluginConfig = {}): CompoundEngineeringPlugin {
  const platform = config.platform ?? 'claude';
  const baseDir = config.configDir ?? process.cwd();
  const manifestPath = resolveManifestPath(platform, baseDir);

  let manifest: PluginManifest;

  try {
    manifest = loadManifest(manifestPath);
  } catch (err) {
    throw new Error(`Failed to load plugin manifest for platform '${platform}': ${(err as Error).message}`);
  }

  return {
    manifest,
    config,

    async initialize(): Promise<void> {
      if (config.debug) {
        console.log(`[compound-engineering-plugin] Initializing for platform: ${platform}`);
        console.log(`[compound-engineering-plugin] Loaded manifest: ${manifest.name} v${manifest.version}`);
      }
    },

    getCapabilities(): string[] {
      return manifest.capabilities;
    },
  };
}

// Default export for convenience
export default createPlugin;
