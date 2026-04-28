-- Migration: 002_roles_permissions
-- Description: Create roles, permissions, user_roles, and role_permissions tables with seed data
-- Requirements: 12.1, 12.2, 12.6, 12.7, 12.8, 12.11
-- Depends on: 001_users_core

-- roles table
CREATE TABLE IF NOT EXISTS roles (
  role_code VARCHAR(50) PRIMARY KEY,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- permissions table
CREATE TABLE IF NOT EXISTS permissions (
  permission_code VARCHAR(100) PRIMARY KEY,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_code VARCHAR(50) NOT NULL REFERENCES roles(role_code) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id, role_code)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_code ON user_roles(role_code);

-- role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
  role_code VARCHAR(50) NOT NULL REFERENCES roles(role_code) ON DELETE CASCADE,
  permission_code VARCHAR(100) NOT NULL REFERENCES permissions(permission_code) ON DELETE CASCADE,
  PRIMARY KEY (role_code, permission_code)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_code);

-- Seed default roles
INSERT INTO roles (role_code, description) VALUES
  ('guest',   'Unauthenticated user with minimal access'),
  ('user',    'Standard authenticated user'),
  ('pro',     'Premium user with enhanced features'),
  ('admin',   'System administrator with full access'),
  ('support', 'Customer support representative')
ON CONFLICT DO NOTHING;

-- Seed default permissions
INSERT INTO permissions (permission_code, description) VALUES
  ('ai.use',           'Use AI features with basic models'),
  ('ai.use.pro_model', 'Use premium AI models'),
  ('user.manage',      'Manage user accounts'),
  ('quota.override',   'Override user quotas'),
  ('role.assign',      'Assign roles to users'),
  ('audit.view',       'View audit logs')
ON CONFLICT DO NOTHING;

-- Seed default role_permissions mappings
INSERT INTO role_permissions (role_code, permission_code) VALUES
  ('user',    'ai.use'),
  ('pro',     'ai.use'),
  ('pro',     'ai.use.pro_model'),
  ('admin',   'ai.use'),
  ('admin',   'ai.use.pro_model'),
  ('admin',   'user.manage'),
  ('admin',   'quota.override'),
  ('admin',   'role.assign'),
  ('admin',   'audit.view'),
  ('support', 'ai.use'),
  ('support', 'user.manage'),
  ('support', 'audit.view')
ON CONFLICT DO NOTHING;
