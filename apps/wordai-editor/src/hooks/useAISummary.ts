/**
 * useAISummary — React hook for generating AI summaries of archived items.
 *
 * Invokes the `generate_archive_summary` Tauri command with a 30-second timeout.
 * Tracks loading/success/error state and supports up to 3 retry attempts.
 *
 * Requirements: 9.4, 9.5, 9.6, 9.7
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { AISummaryState } from '../types/archive';

const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

/**
 * Creates a promise that rejects after the specified timeout.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Hook that generates an AI summary for an archived item.
 *
 * @param itemId - The archive item ID to generate a summary for, or null for idle state.
 * @returns An object with the current summary state and a retry function.
 *
 * Requirements: 9.4, 9.5, 9.6, 9.7
 */
export function useAISummary(itemId: string | null): {
  state: AISummaryState;
  retry: () => void;
} {
  const [state, setState] = useState<AISummaryState>({
    status: 'idle',
    text: null,
    retryCount: 0,
  });

  // Track the current itemId to avoid stale updates from previous requests
  const currentItemIdRef = useRef<string | null>(itemId);
  // Track retryCount in a ref so retry() always has the latest value
  const retryCountRef = useRef(0);

  const attemptGeneration = useCallback((id: string, currentRetryCount: number) => {
    setState({ status: 'loading', text: null, retryCount: currentRetryCount });

    withTimeout(
      invoke<string>('generate_archive_summary', { id, api_key: '', endpoint: null }),
      TIMEOUT_MS,
    )
      .then((summary) => {
        // Only update state if the itemId hasn't changed during the request
        if (currentItemIdRef.current === id) {
          setState({ status: 'success', text: summary, retryCount: currentRetryCount });
          retryCountRef.current = currentRetryCount;
        }
      })
      .catch(() => {
        // Only update state if the itemId hasn't changed during the request
        if (currentItemIdRef.current === id) {
          const newRetryCount = currentRetryCount + 1;
          setState({ status: 'error', text: null, retryCount: newRetryCount });
          retryCountRef.current = newRetryCount;
        }
      });
  }, []);

  // Initiate generation when itemId changes
  useEffect(() => {
    currentItemIdRef.current = itemId;

    if (itemId === null) {
      setState({ status: 'idle', text: null, retryCount: 0 });
      retryCountRef.current = 0;
      return;
    }

    retryCountRef.current = 0;
    attemptGeneration(itemId, 0);
  }, [itemId, attemptGeneration]);

  const retry = useCallback(() => {
    const id = currentItemIdRef.current;
    if (id === null) return;
    if (retryCountRef.current >= MAX_RETRIES) return;

    attemptGeneration(id, retryCountRef.current);
  }, [attemptGeneration]);

  return { state, retry };
}
