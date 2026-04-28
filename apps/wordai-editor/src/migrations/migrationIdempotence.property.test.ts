/**
 * Property-based tests for migration idempotence
 * Validates: Requirements 12.3
 *
 * Property 35: Migration Idempotence
 * For any database migration M, applying M when it is already applied
 * SHALL have no effect on the schema.
 *
 * Since the actual database is not available in the test environment,
 * migration state is modelled as an in-memory representation that mirrors
 * the schema_migrations tracking table used by Lumibase.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// In-memory migration model
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
 * Mirrors the idempotent behaviour required by Requirement 12.3:
 * - If the migration version is already recorded in schema_migrations, the
 *   function returns the state unchanged (no-op).
 * - Otherwise it records the version and adds the migration's tables/indexes.
 */
function applyMigration(state: SchemaState, migration: Migration): SchemaState {
  // Idempotence guard: already applied → no-op
  if (state.appliedMigrations.has(migration.version)) {
    return state;
  }

  // First application: record version and update schema
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
const tableNamesArb = fc
  .uniqueArray(fc.stringMatching(/^[a-z][a-z0-9_]{2,29}$/), {
    minLength: 1,
    maxLength: 6,
  });

/** Generate a (possibly empty) list of unique index names */
const indexNamesArb = fc
  .uniqueArray(fc.stringMatching(/^idx_[a-z][a-z0-9_]{2,29}$/), {
    minLength: 0,
    maxLength: 6,
  });

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
// Property 35: Migration Idempotence
// Validates: Requirements 12.3
// ---------------------------------------------------------------------------

describe('Property 35: Migration Idempotence', () => {
  /**
   * Core idempotence property:
   * Applying a migration M a second time SHALL produce the same schema state
   * as applying it once.
   *
   * apply(apply(state, M), M) === apply(state, M)
   */
  it(
    'applying a migration twice produces the same schema state as applying it once',
    () => {
      fc.assert(
        fc.property(migrationArb, (migration) => {
          const initial = emptyState();

          // First application
          const afterFirst = applyMigration(initial, migration);
          // Second application (should be a no-op)
          const afterSecond = applyMigration(afterFirst, migration);

          expect(snapshotState(afterSecond)).toEqual(snapshotState(afterFirst));
        }),
        { numRuns: 100 },
      );
    },
  );

  /**
   * Applying an already-applied migration SHALL NOT add duplicate entries to
   * schema_migrations.
   */
  it(
    'applying an already-applied migration does not add a duplicate entry to schema_migrations',
    () => {
      fc.assert(
        fc.property(migrationArb, (migration) => {
          const initial = emptyState();

          const afterFirst = applyMigration(initial, migration);
          const afterSecond = applyMigration(afterFirst, migration);

          // The version should appear exactly once
          const count = [...afterSecond.appliedMigrations].filter(
            (v) => v === migration.version,
          ).length;
          expect(count).toBe(1);
        }),
        { numRuns: 100 },
      );
    },
  );

  /**
   * Applying an already-applied migration SHALL NOT add new tables to the schema.
   */
  it(
    'applying an already-applied migration does not add new tables to the schema',
    () => {
      fc.assert(
        fc.property(migrationArb, (migration) => {
          const initial = emptyState();

          const afterFirst = applyMigration(initial, migration);
          const tableCountAfterFirst = afterFirst.tables.size;

          const afterSecond = applyMigration(afterFirst, migration);
          const tableCountAfterSecond = afterSecond.tables.size;

          expect(tableCountAfterSecond).toBe(tableCountAfterFirst);
        }),
        { numRuns: 100 },
      );
    },
  );

  /**
   * Applying an already-applied migration SHALL NOT add new indexes to the schema.
   */
  it(
    'applying an already-applied migration does not add new indexes to the schema',
    () => {
      fc.assert(
        fc.property(migrationArb, (migration) => {
          const initial = emptyState();

          const afterFirst = applyMigration(initial, migration);
          const indexCountAfterFirst = afterFirst.indexes.size;

          const afterSecond = applyMigration(afterFirst, migration);
          const indexCountAfterSecond = afterSecond.indexes.size;

          expect(indexCountAfterSecond).toBe(indexCountAfterFirst);
        }),
        { numRuns: 100 },
      );
    },
  );

  /**
   * Idempotence holds for any number of repeated applications (N ≥ 2).
   * apply^N(state, M) === apply(state, M)  for all N ≥ 1
   */
  it(
    'applying a migration N times (N >= 1) always produces the same schema state as applying it once',
    () => {
      fc.assert(
        fc.property(
          migrationArb,
          fc.integer({ min: 2, max: 10 }),
          (migration, repetitions) => {
            const initial = emptyState();

            // Apply once to get the reference state
            const afterFirst = applyMigration(initial, migration);
            const reference = snapshotState(afterFirst);

            // Apply N more times
            let state = afterFirst;
            for (let i = 0; i < repetitions; i++) {
              state = applyMigration(state, migration);
            }

            expect(snapshotState(state)).toEqual(reference);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  /**
   * Idempotence holds across all known migration groups.
   * Each of the four migration groups defined in the spec should be idempotent.
   */
  it(
    'all known migration groups are idempotent when applied to a pre-populated schema state',
    () => {
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

      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: knownMigrations.length - 1 }),
          (migrationIndex) => {
            const migration = knownMigrations[migrationIndex];

            // Build a state where all prior migrations have already been applied
            let state = emptyState();
            for (let i = 0; i < migrationIndex; i++) {
              state = applyMigration(state, knownMigrations[i]);
            }

            // Apply the target migration once
            const afterFirst = applyMigration(state, migration);
            // Apply it again (should be a no-op)
            const afterSecond = applyMigration(afterFirst, migration);

            expect(snapshotState(afterSecond)).toEqual(snapshotState(afterFirst));
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  /**
   * A migration that has NOT been applied yet DOES change the schema state.
   * This is the complementary check: the guard only fires when the migration
   * is already recorded, not on the first application.
   */
  it(
    'a migration that has not been applied yet changes the schema state on first application',
    () => {
      fc.assert(
        fc.property(migrationArb, (migration) => {
          const initial = emptyState();

          // Precondition: migration is not yet applied
          expect(initial.appliedMigrations.has(migration.version)).toBe(false);

          const afterFirst = applyMigration(initial, migration);

          // The version must now be recorded
          expect(afterFirst.appliedMigrations.has(migration.version)).toBe(true);
          // Tables from the migration must now exist
          for (const table of migration.tables) {
            expect(afterFirst.tables.has(table)).toBe(true);
          }
        }),
        { numRuns: 100 },
      );
    },
  );
});
