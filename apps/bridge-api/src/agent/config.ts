/**
 * AuraSphere Agent Framework — Configuration Loader & Validator
 *
 * Loads configuration from environment variables (AURASPHERE_* prefix) and
 * an optional JSON config file. Environment variables take precedence over
 * config file values.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.12, 9.13
 *
 * @module agent/config
 */

import * as fs from 'fs';
import * as path from 'path';
import { AgentConfig } from './types';

// ---------------------------------------------------------------------------
// Configuration Interface
// ---------------------------------------------------------------------------

/**
 * Complete configuration for the AuraSphere Agent Engine.
 */
export interface AuraSphereConfig {
  /** Operating mode: development uses MockProvider for all tiers. */
  mode: 'development' | 'production';
  /** LLM provider for Turbo tier. */
  turboProvider: 'mock' | 'openai';
  /** LLM provider for Pro tier. */
  proProvider: 'mock' | 'openai';
  /** Default tier when not specified by task complexity or user. */
  defaultTier: 'turbo' | 'pro';
  /** Maximum execution time per plan in seconds (10-600). */
  maxExecutionTimeSec: number;
  /** Context retention duration in minutes (1-1440). */
  contextRetentionMinutes: number;
  /** Path to the JSON configuration file. */
  configFilePath: string;

  /** Optional per-agent configuration overrides from config file. */
  agents?: Record<string, Partial<AgentConfig>>;
  /** Optional provider connection parameters from config file. */
  providers?: {
    openai?: { apiKey: string; baseUrl?: string; model?: string };
  };
}

// ---------------------------------------------------------------------------
// Validation Result
// ---------------------------------------------------------------------------

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_MODES = ['development', 'production'] as const;
const VALID_PROVIDERS = ['mock', 'openai'] as const;
const VALID_TIERS = ['turbo', 'pro'] as const;

const DEFAULT_CONFIG_PATH = './aurasphere.config.json';
const DEFAULT_MODE = 'development';
const DEFAULT_TIER = 'turbo';
const DEFAULT_MAX_EXECUTION_TIME_SEC = 300;
const DEFAULT_CONTEXT_RETENTION_MINUTES = 30;

const MIN_EXECUTION_TIME_SEC = 10;
const MAX_EXECUTION_TIME_SEC = 600;
const MIN_CONTEXT_RETENTION_MINUTES = 1;
const MAX_CONTEXT_RETENTION_MINUTES = 1440;

// ---------------------------------------------------------------------------
// Config File Loader
// ---------------------------------------------------------------------------

/**
 * Attempts to load and parse a JSON configuration file.
 * Returns null if the file does not exist and the path is the default.
 * Throws if the file is explicitly specified but missing or invalid.
 */
function loadConfigFile(filePath: string, isExplicit: boolean): Record<string, unknown> | null {
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    if (isExplicit) {
      throw new Error(
        `Configuration file not found: "${resolvedPath}". ` +
          `The path was specified via AURASPHERE_CONFIG_PATH but the file does not exist.`,
      );
    }
    // Default path doesn't exist — that's fine
    return null;
  }

  let content: string;
  try {
    content = fs.readFileSync(resolvedPath, 'utf-8');
  } catch (err) {
    throw new Error(
      `Failed to read configuration file "${resolvedPath}": ${(err as Error).message}`,
    );
  }

  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch (err) {
    throw new Error(
      `Invalid JSON in configuration file "${resolvedPath}": ${(err as Error).message}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Environment Variable Reader
// ---------------------------------------------------------------------------

interface RawEnvConfig {
  mode?: string;
  turboProvider?: string;
  proProvider?: string;
  defaultTier?: string;
  maxExecutionTimeSec?: string;
  contextRetentionMinutes?: string;
  configPath?: string;
}

function readEnvVars(): RawEnvConfig {
  return {
    mode: process.env.AURASPHERE_MODE,
    turboProvider: process.env.AURASPHERE_TURBO_PROVIDER,
    proProvider: process.env.AURASPHERE_PRO_PROVIDER,
    defaultTier: process.env.AURASPHERE_DEFAULT_TIER,
    maxExecutionTimeSec: process.env.AURASPHERE_MAX_EXECUTION_TIME,
    contextRetentionMinutes: process.env.AURASPHERE_CONTEXT_RETENTION_MINUTES,
    configPath: process.env.AURASPHERE_CONFIG_PATH,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates a partial configuration object and returns all validation errors.
 *
 * Requirement 9.5: Report invalid keys with the provided value and allowed values/range.
 */
export function validateConfig(config: Partial<AuraSphereConfig>): ConfigValidationResult {
  const errors: string[] = [];

  // Validate mode
  if (config.mode !== undefined && !VALID_MODES.includes(config.mode as typeof VALID_MODES[number])) {
    errors.push(
      `Invalid value for "mode": "${config.mode}". Allowed values: ${VALID_MODES.join(', ')}`,
    );
  }

  // Validate turboProvider
  if (
    config.turboProvider !== undefined &&
    !VALID_PROVIDERS.includes(config.turboProvider as typeof VALID_PROVIDERS[number])
  ) {
    errors.push(
      `Invalid value for "turboProvider": "${config.turboProvider}". Allowed values: ${VALID_PROVIDERS.join(', ')}`,
    );
  }

  // Validate proProvider
  if (
    config.proProvider !== undefined &&
    !VALID_PROVIDERS.includes(config.proProvider as typeof VALID_PROVIDERS[number])
  ) {
    errors.push(
      `Invalid value for "proProvider": "${config.proProvider}". Allowed values: ${VALID_PROVIDERS.join(', ')}`,
    );
  }

  // Validate defaultTier
  if (
    config.defaultTier !== undefined &&
    !VALID_TIERS.includes(config.defaultTier as typeof VALID_TIERS[number])
  ) {
    errors.push(
      `Invalid value for "defaultTier": "${config.defaultTier}". Allowed values: ${VALID_TIERS.join(', ')}`,
    );
  }

  // Validate maxExecutionTimeSec
  if (config.maxExecutionTimeSec !== undefined) {
    if (
      !Number.isInteger(config.maxExecutionTimeSec) ||
      config.maxExecutionTimeSec < MIN_EXECUTION_TIME_SEC ||
      config.maxExecutionTimeSec > MAX_EXECUTION_TIME_SEC
    ) {
      errors.push(
        `Invalid value for "maxExecutionTimeSec": ${config.maxExecutionTimeSec}. ` +
          `Must be an integer between ${MIN_EXECUTION_TIME_SEC} and ${MAX_EXECUTION_TIME_SEC}`,
      );
    }
  }

  // Validate contextRetentionMinutes
  if (config.contextRetentionMinutes !== undefined) {
    if (
      !Number.isInteger(config.contextRetentionMinutes) ||
      config.contextRetentionMinutes < MIN_CONTEXT_RETENTION_MINUTES ||
      config.contextRetentionMinutes > MAX_CONTEXT_RETENTION_MINUTES
    ) {
      errors.push(
        `Invalid value for "contextRetentionMinutes": ${config.contextRetentionMinutes}. ` +
          `Must be an integer between ${MIN_CONTEXT_RETENTION_MINUTES} and ${MAX_CONTEXT_RETENTION_MINUTES}`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Main Config Loader
// ---------------------------------------------------------------------------

/**
 * Loads the AuraSphere configuration by merging environment variables and
 * an optional JSON config file. Environment variables take precedence.
 *
 * Requirement 9.1: Load from AURASPHERE_* environment variables.
 * Requirement 9.3: Load from JSON config file.
 * Requirement 9.4: Env vars take precedence over config file.
 * Requirement 9.5: Validate all values at load time.
 * Requirement 9.6: Fail if required keys are missing.
 * Requirement 9.7: In development mode, force MockProvider for all tiers.
 * Requirement 9.12: Default to development mode.
 * Requirement 9.13: Fail if config file path is specified but file is missing/invalid.
 */
export function loadConfig(): AuraSphereConfig {
  const env = readEnvVars();

  // Determine config file path (env var or default)
  const configFilePath = env.configPath || DEFAULT_CONFIG_PATH;
  const isExplicitPath = env.configPath !== undefined;

  // Load config file (may throw for explicit path with missing/invalid file)
  const fileConfig = loadConfigFile(configFilePath, isExplicitPath);

  // Extract values from config file
  const fileMode = fileConfig?.mode as string | undefined;
  const fileTurboProvider = fileConfig?.turboProvider as string | undefined;
  const fileProProvider = fileConfig?.proProvider as string | undefined;
  const fileDefaultTier = fileConfig?.defaultTier as string | undefined;
  const fileMaxExecutionTimeSec = fileConfig?.maxExecutionTimeSec as number | undefined;
  const fileContextRetentionMinutes = fileConfig?.contextRetentionMinutes as number | undefined;
  const fileAgents = fileConfig?.agents as Record<string, Partial<AgentConfig>> | undefined;
  const fileProviders = fileConfig?.providers as AuraSphereConfig['providers'] | undefined;

  // Merge: env vars take precedence over config file values
  const resolvedMode = env.mode || fileMode || DEFAULT_MODE;
  const resolvedTurboProvider = env.turboProvider || fileTurboProvider;
  const resolvedProProvider = env.proProvider || fileProProvider;
  const resolvedDefaultTier = env.defaultTier || fileDefaultTier || DEFAULT_TIER;
  const resolvedMaxExecutionTimeSec =
    env.maxExecutionTimeSec !== undefined
      ? parseInt(env.maxExecutionTimeSec, 10)
      : fileMaxExecutionTimeSec !== undefined
        ? fileMaxExecutionTimeSec
        : DEFAULT_MAX_EXECUTION_TIME_SEC;
  const resolvedContextRetentionMinutes =
    env.contextRetentionMinutes !== undefined
      ? parseInt(env.contextRetentionMinutes, 10)
      : fileContextRetentionMinutes !== undefined
        ? fileContextRetentionMinutes
        : DEFAULT_CONTEXT_RETENTION_MINUTES;

  // Check for missing required keys (Requirement 9.6)
  const missingKeys: string[] = [];
  if (!resolvedTurboProvider) {
    missingKeys.push('AURASPHERE_TURBO_PROVIDER');
  }
  if (!resolvedProProvider) {
    missingKeys.push('AURASPHERE_PRO_PROVIDER');
  }
  if (missingKeys.length > 0) {
    throw new Error(
      `Missing required configuration keys: ${missingKeys.join(', ')}. ` +
        `These must be set via environment variables or the configuration file.`,
    );
  }

  // Build the config object
  const config: AuraSphereConfig = {
    mode: resolvedMode as AuraSphereConfig['mode'],
    turboProvider: resolvedTurboProvider as AuraSphereConfig['turboProvider'],
    proProvider: resolvedProProvider as AuraSphereConfig['proProvider'],
    defaultTier: resolvedDefaultTier as AuraSphereConfig['defaultTier'],
    maxExecutionTimeSec: resolvedMaxExecutionTimeSec,
    contextRetentionMinutes: resolvedContextRetentionMinutes,
    configFilePath,
    agents: fileAgents,
    providers: fileProviders,
  };

  // Validate all values (Requirement 9.5)
  const validation = validateConfig(config);
  if (!validation.valid) {
    throw new Error(
      `Invalid configuration:\n${validation.errors.map((e) => `  - ${e}`).join('\n')}`,
    );
  }

  // In development mode, force MockProvider for all tiers (Requirement 9.7)
  if (config.mode === 'development') {
    config.turboProvider = 'mock';
    config.proProvider = 'mock';
  }

  return config;
}
