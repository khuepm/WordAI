-- Rollback: 003_entitlements_sessions
-- Description: Drop user_sessions and user_entitlements tables
-- Note: user_sessions is dropped first; both tables reference users but are independent of each other

DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS user_entitlements;
