/**
 * Unit tests for AuraSphere Configuration Loader
 *
 * Tests cover:
 * - Loading from environment variables
 * - Loading from JSON config file
 * - Environment variable precedence over config file
 * - Validation of all configuration values
 * - Default to development mode
 * - Development mode forces MockProvider
 * - Missing required keys error
 * - Invalid/missing config file handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig, validateConfig, AuraSphereConfig } from '../../src/agent/config';

// Mock fs module
vi.mock('fs');

describe('AuraSphere Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment for each test
    process.env = { ...originalEnv };
    // Clear all AURASPHERE_ env vars
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('AURASPHERE_')) {
        delete process.env[key];
      }
    });
    vi.resetAllMocks();
    // Default: config file does not exist
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('validateConfig', () => {
    it('should accept valid configuration', () => {
      const config: Partial<AuraSphereConfig> = {
        mode: 'development',
        turboProvider: 'mock',
        proProvider: 'mock',
        defaultTier: 'turbo',
        maxExecutionTimeSec: 300,
        contextRetentionMinutes: 30,
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid mode', () => {
      const config: Partial<AuraSphereConfig> = {
        mode: 'staging' as AuraSphereConfig['mode'],
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('mode');
      expect(result.errors[0]).toContain('staging');
      expect(result.errors[0]).toContain('development, production');
    });

    it('should reject invalid turboProvider', () => {
      const config: Partial<AuraSphereConfig> = {
        turboProvider: 'anthropic' as AuraSphereConfig['turboProvider'],
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('turboProvider');
      expect(result.errors[0]).toContain('anthropic');
    });

    it('should reject invalid proProvider', () => {
      const config: Partial<AuraSphereConfig> = {
        proProvider: 'gemini' as AuraSphereConfig['proProvider'],
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('proProvider');
    });

    it('should reject invalid defaultTier', () => {
      const config: Partial<AuraSphereConfig> = {
        defaultTier: 'ultra' as AuraSphereConfig['defaultTier'],
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('defaultTier');
    });

    it('should reject maxExecutionTimeSec below minimum (10)', () => {
      const config: Partial<AuraSphereConfig> = {
        maxExecutionTimeSec: 5,
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('maxExecutionTimeSec');
      expect(result.errors[0]).toContain('10');
      expect(result.errors[0]).toContain('600');
    });

    it('should reject maxExecutionTimeSec above maximum (600)', () => {
      const config: Partial<AuraSphereConfig> = {
        maxExecutionTimeSec: 700,
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('maxExecutionTimeSec');
    });

    it('should reject non-integer maxExecutionTimeSec', () => {
      const config: Partial<AuraSphereConfig> = {
        maxExecutionTimeSec: 10.5,
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('maxExecutionTimeSec');
    });

    it('should reject contextRetentionMinutes below minimum (1)', () => {
      const config: Partial<AuraSphereConfig> = {
        contextRetentionMinutes: 0,
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('contextRetentionMinutes');
    });

    it('should reject contextRetentionMinutes above maximum (1440)', () => {
      const config: Partial<AuraSphereConfig> = {
        contextRetentionMinutes: 1500,
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('contextRetentionMinutes');
    });

    it('should report multiple errors at once', () => {
      const config: Partial<AuraSphereConfig> = {
        mode: 'invalid' as AuraSphereConfig['mode'],
        turboProvider: 'invalid' as AuraSphereConfig['turboProvider'],
        maxExecutionTimeSec: 9999,
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(3);
    });

    it('should accept boundary values', () => {
      const config: Partial<AuraSphereConfig> = {
        maxExecutionTimeSec: 10,
        contextRetentionMinutes: 1440,
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(true);
    });
  });

  describe('loadConfig', () => {
    it('should load from environment variables', () => {
      process.env.AURASPHERE_MODE = 'production';
      process.env.AURASPHERE_TURBO_PROVIDER = 'openai';
      process.env.AURASPHERE_PRO_PROVIDER = 'openai';
      process.env.AURASPHERE_DEFAULT_TIER = 'pro';
      process.env.AURASPHERE_MAX_EXECUTION_TIME = '120';
      process.env.AURASPHERE_CONTEXT_RETENTION_MINUTES = '60';

      const config = loadConfig();

      expect(config.mode).toBe('production');
      expect(config.turboProvider).toBe('openai');
      expect(config.proProvider).toBe('openai');
      expect(config.defaultTier).toBe('pro');
      expect(config.maxExecutionTimeSec).toBe(120);
      expect(config.contextRetentionMinutes).toBe(60);
    });

    it('should default to development mode when AURASPHERE_MODE not set', () => {
      process.env.AURASPHERE_TURBO_PROVIDER = 'openai';
      process.env.AURASPHERE_PRO_PROVIDER = 'openai';

      const config = loadConfig();

      expect(config.mode).toBe('development');
    });

    it('should force MockProvider for all tiers in development mode', () => {
      process.env.AURASPHERE_MODE = 'development';
      process.env.AURASPHERE_TURBO_PROVIDER = 'openai';
      process.env.AURASPHERE_PRO_PROVIDER = 'openai';

      const config = loadConfig();

      expect(config.turboProvider).toBe('mock');
      expect(config.proProvider).toBe('mock');
    });

    it('should force MockProvider even when mode defaults to development', () => {
      // No AURASPHERE_MODE set → defaults to development
      process.env.AURASPHERE_TURBO_PROVIDER = 'openai';
      process.env.AURASPHERE_PRO_PROVIDER = 'openai';

      const config = loadConfig();

      expect(config.mode).toBe('development');
      expect(config.turboProvider).toBe('mock');
      expect(config.proProvider).toBe('mock');
    });

    it('should use configured providers in production mode', () => {
      process.env.AURASPHERE_MODE = 'production';
      process.env.AURASPHERE_TURBO_PROVIDER = 'mock';
      process.env.AURASPHERE_PRO_PROVIDER = 'openai';

      const config = loadConfig();

      expect(config.turboProvider).toBe('mock');
      expect(config.proProvider).toBe('openai');
    });

    it('should throw when required keys are missing', () => {
      // No AURASPHERE_TURBO_PROVIDER or AURASPHERE_PRO_PROVIDER set
      expect(() => loadConfig()).toThrow('Missing required configuration keys');
      expect(() => loadConfig()).toThrow('AURASPHERE_TURBO_PROVIDER');
      expect(() => loadConfig()).toThrow('AURASPHERE_PRO_PROVIDER');
    });

    it('should throw when only one required key is missing', () => {
      process.env.AURASPHERE_TURBO_PROVIDER = 'mock';
      // AURASPHERE_PRO_PROVIDER is missing

      expect(() => loadConfig()).toThrow('AURASPHERE_PRO_PROVIDER');
    });

    it('should throw for invalid configuration values', () => {
      process.env.AURASPHERE_MODE = 'invalid';
      process.env.AURASPHERE_TURBO_PROVIDER = 'mock';
      process.env.AURASPHERE_PRO_PROVIDER = 'mock';

      expect(() => loadConfig()).toThrow('Invalid configuration');
      expect(() => loadConfig()).toThrow('mode');
    });

    it('should use default values for optional settings', () => {
      process.env.AURASPHERE_TURBO_PROVIDER = 'mock';
      process.env.AURASPHERE_PRO_PROVIDER = 'mock';

      const config = loadConfig();

      expect(config.defaultTier).toBe('turbo');
      expect(config.maxExecutionTimeSec).toBe(300);
      expect(config.contextRetentionMinutes).toBe(30);
      expect(config.configFilePath).toBe('./aurasphere.config.json');
    });

    it('should load from JSON config file', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          mode: 'production',
          turboProvider: 'openai',
          proProvider: 'openai',
          defaultTier: 'pro',
          maxExecutionTimeSec: 200,
          contextRetentionMinutes: 120,
          agents: { writer: { max_iterations: 20 } },
          providers: { openai: { apiKey: 'sk-test', baseUrl: 'https://api.openai.com' } },
        }),
      );

      const config = loadConfig();

      expect(config.mode).toBe('production');
      expect(config.turboProvider).toBe('openai');
      expect(config.proProvider).toBe('openai');
      expect(config.defaultTier).toBe('pro');
      expect(config.maxExecutionTimeSec).toBe(200);
      expect(config.contextRetentionMinutes).toBe(120);
      expect(config.agents).toEqual({ writer: { max_iterations: 20 } });
      expect(config.providers?.openai?.apiKey).toBe('sk-test');
    });

    it('should give env vars precedence over config file', () => {
      process.env.AURASPHERE_MODE = 'production';
      process.env.AURASPHERE_TURBO_PROVIDER = 'openai';
      process.env.AURASPHERE_PRO_PROVIDER = 'openai';
      process.env.AURASPHERE_MAX_EXECUTION_TIME = '500';

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          mode: 'development',
          turboProvider: 'mock',
          proProvider: 'mock',
          maxExecutionTimeSec: 100,
        }),
      );

      const config = loadConfig();

      // Env vars win
      expect(config.mode).toBe('production');
      expect(config.turboProvider).toBe('openai');
      expect(config.proProvider).toBe('openai');
      expect(config.maxExecutionTimeSec).toBe(500);
    });

    it('should use custom config file path from AURASPHERE_CONFIG_PATH', () => {
      process.env.AURASPHERE_CONFIG_PATH = '/custom/path/config.json';
      process.env.AURASPHERE_TURBO_PROVIDER = 'mock';
      process.env.AURASPHERE_PRO_PROVIDER = 'mock';

      // File does not exist at explicit path → should throw
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(() => loadConfig()).toThrow('Configuration file not found');
      expect(() => loadConfig()).toThrow('/custom/path/config.json');
    });

    it('should not throw when default config file does not exist', () => {
      process.env.AURASPHERE_TURBO_PROVIDER = 'mock';
      process.env.AURASPHERE_PRO_PROVIDER = 'mock';

      vi.mocked(fs.existsSync).mockReturnValue(false);

      // Should not throw — default path is optional
      const config = loadConfig();
      expect(config.turboProvider).toBe('mock');
    });

    it('should throw when explicit config file contains invalid JSON', () => {
      process.env.AURASPHERE_CONFIG_PATH = '/path/to/config.json';
      process.env.AURASPHERE_TURBO_PROVIDER = 'mock';
      process.env.AURASPHERE_PRO_PROVIDER = 'mock';

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{ invalid json }');

      expect(() => loadConfig()).toThrow('Invalid JSON');
    });

    it('should set configFilePath in returned config', () => {
      process.env.AURASPHERE_CONFIG_PATH = '/my/config.json';
      process.env.AURASPHERE_TURBO_PROVIDER = 'mock';
      process.env.AURASPHERE_PRO_PROVIDER = 'mock';

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));

      const config = loadConfig();
      expect(config.configFilePath).toBe('/my/config.json');
    });

    it('should handle NaN from invalid numeric env vars', () => {
      process.env.AURASPHERE_TURBO_PROVIDER = 'mock';
      process.env.AURASPHERE_PRO_PROVIDER = 'mock';
      process.env.AURASPHERE_MAX_EXECUTION_TIME = 'abc';

      expect(() => loadConfig()).toThrow('maxExecutionTimeSec');
    });
  });
});
