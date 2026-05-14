/**
 * Property-based tests for `formatRelativeTime`.
 *
 * **Validates: Requirements 2.6**
 *
 * Properties tested:
 *   - Any timestamp within the last minute returns 'Just now'
 *   - Any timestamp 1–59 minutes ago returns a string ending in 'm ago'
 *   - Any timestamp 1–23 hours ago returns a string ending in 'h ago'
 *   - Any timestamp 1–6 days ago returns a string ending in 'd ago'
 *   - Any timestamp ≥ 7 days ago returns a non-empty string (locale date)
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { formatRelativeTime } from './formatRelativeTime';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a timestamp that is `ms` milliseconds in the past from now. */
function msAgo(ms: number): number {
  return Date.now() - ms;
}

const ONE_MINUTE_MS = 60_000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

// ---------------------------------------------------------------------------
// Property 1: Within the last minute → 'Just now'
// Validates: Requirements 2.6
// ---------------------------------------------------------------------------

describe('formatRelativeTime — Property 1: within the last minute returns "Just now"', () => {
  it('any timestamp 0–59 seconds ago returns "Just now"', () => {
    fc.assert(
      fc.property(
        // offset in ms: [0, 60_000)
        fc.integer({ min: 0, max: ONE_MINUTE_MS - 1 }),
        (offsetMs) => {
          const timestamp = msAgo(offsetMs);
          return formatRelativeTime(timestamp) === 'Just now';
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: 1–59 minutes ago → ends with 'm ago'
// Validates: Requirements 2.6
// ---------------------------------------------------------------------------

describe('formatRelativeTime — Property 2: 1–59 minutes ago ends with "m ago"', () => {
  it('any timestamp 1–59 minutes ago returns a string ending in "m ago"', () => {
    fc.assert(
      fc.property(
        // offset in ms: [1 minute, 60 minutes)
        fc.integer({ min: ONE_MINUTE_MS, max: ONE_HOUR_MS - 1 }),
        (offsetMs) => {
          const timestamp = msAgo(offsetMs);
          const result = formatRelativeTime(timestamp);
          return result.endsWith('m ago');
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: 1–23 hours ago → ends with 'h ago'
// Validates: Requirements 2.6
// ---------------------------------------------------------------------------

describe('formatRelativeTime — Property 3: 1–23 hours ago ends with "h ago"', () => {
  it('any timestamp 1–23 hours ago returns a string ending in "h ago"', () => {
    fc.assert(
      fc.property(
        // offset in ms: [1 hour, 24 hours)
        fc.integer({ min: ONE_HOUR_MS, max: ONE_DAY_MS - 1 }),
        (offsetMs) => {
          const timestamp = msAgo(offsetMs);
          const result = formatRelativeTime(timestamp);
          return result.endsWith('h ago');
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: 1–6 days ago → ends with 'd ago'
// Validates: Requirements 2.6
// ---------------------------------------------------------------------------

describe('formatRelativeTime — Property 4: 1–6 days ago ends with "d ago"', () => {
  it('any timestamp 1–6 days ago returns a string ending in "d ago"', () => {
    fc.assert(
      fc.property(
        // offset in ms: [1 day, 7 days)
        fc.integer({ min: ONE_DAY_MS, max: SEVEN_DAYS_MS - 1 }),
        (offsetMs) => {
          const timestamp = msAgo(offsetMs);
          const result = formatRelativeTime(timestamp);
          return result.endsWith('d ago');
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: ≥ 7 days ago → non-empty locale date string
// Validates: Requirements 2.6
// ---------------------------------------------------------------------------

describe('formatRelativeTime — Property 5: ≥ 7 days ago returns a non-empty locale date string', () => {
  it('any timestamp 7 or more days ago returns a non-empty string', () => {
    fc.assert(
      fc.property(
        // offset in ms: [7 days, ~10 years]
        fc.integer({ min: SEVEN_DAYS_MS, max: 10 * 365 * ONE_DAY_MS }),
        (offsetMs) => {
          const timestamp = msAgo(offsetMs);
          const result = formatRelativeTime(timestamp);
          return (
            typeof result === 'string' &&
            result.length > 0 &&
            !result.endsWith('m ago') &&
            !result.endsWith('h ago') &&
            !result.endsWith('d ago') &&
            result !== 'Just now'
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
