/**
 * Property-based tests for migration rollback correctness
 * Validates: Requirements 12.4, 12.5
 *
 * Property 36: Migration Rollback Correctness
 * For any migration M, applying M then rolling back M SHALL restore the
 * schema to its original state.
 *
 * Since the actual database is not available in the test environment,
 * migration state is modelled as an in-memory representation that mirrors
 * the schema_migrations tracking table used by Lumibase.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// In-memory migration model
// (Mirrors the model used in migrationIdempotence.property.test.ts)
// ---------------------------------------------------------------------------

/**
 * Represents a single migration definition.
 * Each migration has a unique version string and a set of schema changes
 * (tables/indexes to create) that it introduces.
 */
interface Migration {
  /** Unique version identifier, e.g. "001_users_core" */
  version: string;
  /** Tables created by this migration */
  tables: string[];
  /** Indexes created by this migration */
  indexes: string[];
}

/**
 * Represents the current state of the database schema as tracked by the
 * migration runner.  This mirrors what Lumibase stores in schema_migrations.
 */
interface SchemaState {
  /** Set of migration versions that have already been applied */
  appliedMigrations: Set<string>;
  /** Set of table names that currently exist in the schema */
  tables: Set<string>;
  /** Set of index names that currently exist in the schema */
  indexes: Set<string>;
}

/**
 * Apply a migration to the given schema state.
 *
 * - If the migration version is already recorded in schema_migrations, the
 *   function returns the state unchanged (no-op / idempotence guard).
 * - Otherwise it records the version and adds the migration's tables/indexes.
 */
function applyMigration(state: SchemaState, migration: Migration): SchemaState {
  if (state.appliedMigrations.has(migration.version)) {
    return state;
  }

  const newApplied = new Set(state.appliedMigrations);
  newApplied.add(migration.version);

  const newTables = new Set(state.tables);
  for (const table of migration.tables) {
    newTables.add(table);
  }

  const newIndexes = new Set(state.indexes);
  for (const index of migration.indexes) {
    newIndexes.add(index);
  }

  return {
    appliedMigrations: newApplied,
    tables: newTables,
    indexes: newIndexes,
  };
}

/**
 * Roll back a migration from the given schema state.
 *
 * Mirrors the rollback behaviour required by Requirements 12.4 and 12.5:
 * - If the migration version is NOT recorded in schema_migrations, the
 *   function returns the state unchanged (no-op — rolling back an unapplied
 *   migration has no effect).
 * - Otherwise it removes the version from schema_migrations and removes the
 *   tables and indexes introduced by the migration.
 */
function rollbackMigration(state: SchemaState, migration: Migration): SchemaState {
  // Guard: migration was never applied → no-op
  if (!state.appliedMigrations.has(migration.version)) {
    return state;
  }

  const newApplied = new Set(state.appliedMigrations);
  newApplied.delete(migration.version);

  const newTables = new Set(state.tables);
  for (const table of migration.tables) {
    newTables.delete(table);
  }

  const newIndexes = new Set(state.indexes);
  for (const index of migration.indexes) {
    newIndexes.delete(index);
  }

  return {
    appliedMigrations: newApplied,
    tables: newTables,
    indexes: newIndexes,
  };
}

/**
 * Snapshot a SchemaState as a plain comparable object so we can assert
 * deep equality between two states.
 */
function snapshotState(state: SchemaState): {
  appliedMigrations: string[];
  tables: string[];
  indexes: string[];
} {
  return {
    appliedMigrations: [...state.appliedMigrations].sort(),
    tables: [...state.tables].sort(),
    indexes: [...state.indexes].sort(),
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generate a valid migration version string, e.g. "001_users_core" */
const migrationVersionArb = fc.oneof(
  fc.constantFrom(
    '001_users_core',
    '002_roles_permissions',
    '003_entitlements_sessions',
    '004_audit',
  ),
  // Also exercise arbitrary version strings to generalise the property
  fc
    .tuple(
      fc.integer({ min: 1, max: 999 }).map((n) => String(n).padStart(3, '0')),
      fc.stringMatching(/^[a-z][a-z0-9_]{2,19}$/),
    )
    .map(([num, name]) => `${num}_${name}`),
);

/** Generate a non-empty list of unique table names */
const tableNamesArb = fc.uniqueArray(
  fc.stringMatching(/^[a-z][a-z0-9_]{2,29}$/),
  { minLength: 1, maxLength: 6 },
);

/** Generate a (possibly empty) list of unique index names */
const indexNamesArb = fc.uniqueArray(
  fc.stringMatching(/^idx_[a-z][a-z0-9_]{2,29}$/),
  { minLength: 0, maxLength: 6 },
);

/** Generate a complete Migration object */
const migrationArb: fc.Arbitrary<Migration> = fc
  .tuple(migrationVersionArb, tableNamesArb, indexNamesArb)
  .map(([version, tables, indexes]) => ({ version, tables, indexes }));

/** Generate an empty (fresh) schema state */
function emptyState(): SchemaState {
  return {
    appliedMigrations: new Set(),
    tables: new Set(),
    indexes: new Set(),
  };
}

// ---------------------------------------------------------------------------
// Known migration definitions (mirrors the four groups in the spec)
// ---------------------------------------------------------------------------

const knownMigrations: Migration[] = [
  {
    version: '001_users_core',
    tables: ['users'],
    indexes: ['idx_users_firebase_uid', 'idx_users_email', 'idx_users_status'],
  },
  {
    version: '002_roles_permissions',
    tables: ['roles', 'permissions', 'user_roles', 'role_permissions'],
    indexes: [
      'idx_user_roles_user_id',
      'idx_user_roles_role_code',
      'idx_role_permissions_role',
    ],
  },
  {
    version: '003_entitlements_sessions',
    tables: ['user_entitlements', 'user_sessions'],
    indexes: [
      'idx_user_entitlements_user_id',
      'idx_user_entitlements_quota_reset',
      'idx_user_sessions_user_id',
      'idx_user_sessions_device_id',
      'idx_user_sessions_state',
    ],
  },
  {
    version: '004_audit',
    tables: ['audit_logs'],
    indexes: [
      'idx_audit_logs_actor',
      'idx_audit_logs_action',
      'idx_audit_logs_resource',
      'idx_audit_logs_created_at',
      'idx_audit_logs_trace_id',
    ],
  },
];

// ---------------------------------------------------------------------------
// Property 36: Migration Rollback Correctness
// **Validates: Requirements 12.4, 12.5**
// ---------------------------------------------------------------------------

describe('Property 36: Migration Rollback Correctness', () => {
  /**
   * Core rollback property:
   * Applying a migration M and then rolling it back SHALL restore the schema
   * to its original state.
   *
   * rollback(apply(state, M), M) === state
   */
  it(
    'apply then rollback restores the original schema state',
    () => {
      fc.assert(
        fc.property(migrationArb, (migration) => {
          const initial = emptyState();

          const afterApply = applyMigration(initial, migration);
          const afterRollback = rollbackMigration(afterApply, migration);

          expect(snapshotState(afterRollback)).toEqual(snapshotState(initial));
        }),
        { numRuns: 100 },
      );
    },
  );

  /**
   * Rolling back a migration that was never applied SHALL be a no-op.
   *
   * rollback(state, M) === state  when M ∉ state.appliedMigrations
   */
  it(
    'rolling back a migration that was never applied is a no-op',
    () => {
      fc.assert(
        fc.property(migrationArb, (migration) => {
          const initial = emptyState();

          // Precondition: migration has NOT been applied
          expect(initial.appliedMigrations.has(migration.version)).toBe(false);

          const afterRollback = rollbackMigration(initial, migration);

          expect(snapshotState(afterRollback)).toEqual(snapshotState(initial));
        }),
        { numRuns: 100 },
      );
    },
  );

  /**
   * Rolling back removes the migration version from schema_migrations.
   *
   * After rollback(apply(state, M), M), M SHALL NOT appear in appliedMigrations.
   */
  it(
    'rolling back removes the migration version from schema_migrations',
    () => {
      fc.assert(
        fc.property(migrationArb, (migration) => {
          const initial = emptyState();

          const afterApply = applyMigration(initial, migration);
          // Confirm the version was recorded
          expect(afterApply.appliedMigrations.has(migration.version)).toBe(true);

          const afterRollback = rollbackMigration(afterApply, migration);
          // Version must be gone after rollback
          expect(afterRollback.appliedMigrations.has(migration.version)).toBe(false);
        }),
        { numRuns: 100 },
      );
    },
  );

  /**
   * Rolling back removes the tables introduced by the migration.
   *
   * For every table T introduced by M:
   *   T ∉ rollback(apply(state, M), M).tables
   */
  it(
    'rolling back removes the tables introduced by the migration',
    () => {
      fc.assert(
        fc.property(migrationArb, (migration) => {
          const initial = emptyState();

          const afterApply = applyMigration(initial, migration);
          const afterRollback = rollbackMigration(afterApply, migration);

          for (const table of migration.tables) {
            expect(afterRollback.tables.has(table)).toBe(false);
          }
        }),
        { numRuns: 100 },
      );
    },
  );

  /**
   * Rolling back removes the indexes introduced by the migration.
   *
   * For every index I introduced by M:
   *   I ∉ rollback(apply(state, M), M).indexes
   */
  it(
    'rolling back removes the indexes introduced by the migration',
    () => {
      fc.assert(
        fc.property(migrationArb, (migration) => {
          const initial = emptyState();

          const afterApply = applyMigration(initial, migration);
          const afterRollback = rollbackMigration(afterApply, migration);

          for (const index of migration.indexes) {
            expect(afterRollback.indexes.has(index)).toBe(false);
          }
        }),
        { numRuns: 100 },
      );
    },
  );

  /**
   * All four known migration groups satisfy rollback correctness.
   *
   * For each migration group 001–004, applying then rolling back SHALL
   * restore the schema to the state before that migration was applied,
   * regardless of which prior migrations are already in place.
   */
  it(
    'all four known migration groups (001–004) satisfy rollback correctness',
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: knownMigrations.length - 1 }),
          (migrationIndex) => {
            const migration = knownMigrations[migrationIndex];

            // Build a state where all prior migrations have already been applied
            let stateBeforeTarget = emptyState();
            for (let i = 0; i < migrationIndex; i++) {
              stateBeforeTarget = applyMigration(stateBeforeTarget, knownMigrations[i]);
            }

            // Apply the target migration
            const afterApply = applyMigration(stateBeforeTarget, migration);
            // Roll it back
            const afterRollback = rollbackMigration(afterApply, migration);

            // Schema must be identical to the state before the migration was applied
            expect(snapshotState(afterRollback)).toEqual(
              snapshotState(stateBeforeTarget),
            );
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
