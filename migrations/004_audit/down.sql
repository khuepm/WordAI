-- Rollback: 004_audit
-- Description: Drop audit_logs immutability rules and table
-- Requirements: 12.1, 12.2

-- Drop immutability rules first before dropping the table
DROP RULE IF EXISTS audit_logs_no_update ON audit_logs;
DROP RULE IF EXISTS audit_logs_no_delete ON audit_logs;

-- Drop the audit_logs table
DROP TABLE IF EXISTS audit_logs;
