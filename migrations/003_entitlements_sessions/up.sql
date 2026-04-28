-- Migration: 003_entitlements_sessions
-- Description: Create user_entitlements and user_sessions tables with constraints and indexes
-- Requirements: 12.1, 12.2, 12.9, 12.10, 12.11
-- Depends on: 001_users_core

-- user_entitlements table
CREATE TABLE IF NOT EXISTS user_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  ai_enabled BOOLEAN NOT NULL DEFAULT true,
  plan_code VARCHAR(50) NOT NULL DEFAULT 'free'
    CHECK (plan_code IN ('free', 'pro', 'enterprise')),
  monthly_quota INTEGER NOT NULL DEFAULT 100,
  used_quota INTEGER NOT NULL DEFAULT 0,
  quota_reset_at TIMESTAMP WITH TIME ZONE NOT NULL,
  allowed_models JSONB NOT NULL DEFAULT '["gpt-3.5-turbo"]'::jsonb,
  max_requests_per_minute INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT check_quota_valid CHECK (used_quota >= 0 AND used_quota <= monthly_quota)
);

CREATE INDEX IF NOT EXISTS idx_user_entitlements_user_id ON user_entitlements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_entitlements_quota_reset ON user_entitlements(quota_reset_at);

-- user_sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  session_state VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (session_state IN ('active', 'revoked')),
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_device_id ON user_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_state ON user_sessions(session_state);
