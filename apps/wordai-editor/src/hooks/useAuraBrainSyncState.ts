import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { Document } from '../types/document';
import { computeContentHash, getSnapshot, subscribe } from '../services/auraBrainManager';

export interface AuraBrainDocumentSyncView {
  isSyncing: boolean;
  isDirty: boolean;
  lastSyncedAt: number | null;
  syncError: string | null;
}

export function useAuraBrainSyncState(document: Document | null): AuraBrainDocumentSyncView {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [currentHash, setCurrentHash] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!document) {
      setCurrentHash(null);
      return;
    }

    computeContentHash(document.content).then((hash) => {
      if (!cancelled) setCurrentHash(hash);
    });

    return () => {
      cancelled = true;
    };
  }, [document?.id, document?.content, document]);

  return useMemo(() => {
    if (!document) {
      return { isSyncing: snapshot.isSyncing, isDirty: false, lastSyncedAt: null, syncError: null };
    }

    const baseline = snapshot.lastSyncedHashByDocumentId[document.id] ?? null;
    const lastSyncedAt = snapshot.lastSyncedAtByDocumentId[document.id] ?? null;
    const syncError = snapshot.lastErrorByDocumentId[document.id] ?? null;
    const hasContent = document.content.trim().length > 0;
    const isDirty = baseline === null ? hasContent : currentHash !== null && currentHash !== baseline;

    return {
      isSyncing: snapshot.isSyncing && snapshot.activeDocumentId === document.id,
      isDirty,
      lastSyncedAt,
      syncError,
    };
  }, [currentHash, document, snapshot]);
}
