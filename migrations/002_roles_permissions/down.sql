-- Rollback: 002_roles_permissions
-- Description: Drop roles, permissions, user_roles, and role_permissions tables
-- Requirements: 12.4, 12.5
-- Note: Tables are dropped in reverse dependency order to respect foreign key constraints

DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS roles;
