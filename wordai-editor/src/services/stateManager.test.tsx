/**
 * Integration tests for stateManager (AppStateProvider + useAppState)
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5
 */

import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { AppStateProvider, useAppState } from './stateManager';
import type { Document } from '../types/document';
import type { AISuggestion } from '../types/ai';
import type { IPCError } from '../types/ipc';
import type { ReactNode } from 'react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppStateProvider>{children}</AppStateProvider>
);

const makeDocument = (overrides: Partial<Document> = {}): Document => ({
  id: 'doc-1',
  title: 'Test',
  content: 'Hello world',
  metadata: { wordCount: 2, readingTime: 1, status: 'draft', tags: [] },
  version: 1,
  lastModified: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
});

const makeSuggestion = (overrides: Partial<AISuggestion> = {}): AISuggestion => ({
  id: 'sug-1',
  suggestedText: 'Better text',
  explanation: 'Clearer phrasing',
  confidenceScore: 0.9,
  originalText: 'Hello world',
  ...overrides,
});

// ─── Initial state ────────────────────────────────────────────────────────────

describe('AppStateProvider - initial state', () => {
  it('starts with null document and all flags false', () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    const { state } = result.current;

    expect(state.document).toBeNull();
    expect(state.filePath).toBe('');
    expect(state.isAIPanelOpen).toBe(false);
    expect(state.isNegotiationOpen).toBe(false);
    expect(state.isRenderDrawerOpen).toBe(false);
    expect(state.hasUnsavedChanges).toBe(false);
    expect(state.aiSelection).toBeNull();
    expect(state.selectedSuggestion).toBeNull();
    expect(state.saveError).toBeNull();
  });
});

// ─── Document actions ─────────────────────────────────────────────────────────

describe('setDocument', () => {
  it('stores document and filePath, clears hasUnsavedChanges', () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    const doc = makeDocument();

    act(() => {
      result.current.setDocument(doc, '/docs/doc-1.json');
    });

    expect(result.current.state.document).toEqual(doc);
    expect(result.current.state.filePath).toBe('/docs/doc-1.json');
    expect(result.current.state.hasUnsavedChanges).toBe(false);
  });
});

describe('updateDocument (Req 17.2)', () => {
  it('updates document and marks hasUnsavedChanges=true', () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    const doc = makeDocument();

    act(() => result.current.setDocument(doc, '/docs/doc-1.json'));
    act(() => result.current.updateDocument({ ...doc, content: 'Changed' }));

    expect(result.current.state.document?.content).toBe('Changed');
    expect(result.current.state.hasUnsavedChanges).toBe(true); // Req 17.2
  });
});

describe('markSaved (Req 17.3)', () => {
  it('clears hasUnsavedChanges and saveError on successful save', () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    const doc = makeDocument();

    act(() => result.current.setDocument(doc, '/docs/doc-1.json'));
    act(() => result.current.updateDocument({ ...doc, content: 'Changed' }));
    expect(result.current.state.hasUnsavedChanges).toBe(true);

    const savedDoc = { ...doc, content: 'Changed', lastModified: new Date() };
    act(() => result.current.markSaved(savedDoc));

    expect(result.current.state.hasUnsavedChanges).toBe(false); // Req 17.3
    expect(result.current.state.saveError).toBeNull();
    expect(result.current.state.document).toEqual(savedDoc);
  });
});

describe('setSaveError', () => {
  it('stores and clears save errors', () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    const err: IPCError = { code: 'IO_ERROR', message: 'Disk full' };

    act(() => result.current.setSaveError(err));
    expect(result.current.state.saveError).toEqual(err);

    act(() => result.current.setSaveError(null));
    expect(result.current.state.saveError).toBeNull();
  });
});

// ─── AI panel flags (Req 17.4, 17.5) ─────────────────────────────────────────

describe('openAIPanel / closeAIPanel (Req 17.4, 17.5)', () => {
  it('sets isAIPanelOpen=true and stores selection on open', () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    const selection = { start: 0, end: 5, text: 'Hello' };

    act(() => result.current.openAIPanel(selection));

    expect(result.current.state.isAIPanelOpen).toBe(true); // Req 17.4
    expect(result.current.state.aiSelection).toEqual(selection);
  });

  it('sets isAIPanelOpen=false and resets AI state on close', () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    const selection = { start: 0, end: 5, text: 'Hello' };

    act(() => result.current.openAIPanel(selection));
    act(() => result.current.openNegotiation(makeSuggestion()));
    act(() => result.current.closeAIPanel());

    expect(result.current.state.isAIPanelOpen).toBe(false); // Req 17.5
    expect(result.current.state.aiSelection).toBeNull();    // Req 17.5
    expect(result.current.state.selectedSuggestion).toBeNull(); // Req 17.5
  });
});

// ─── Negotiation panel flags ──────────────────────────────────────────────────

describe('openNegotiation / closeNegotiation', () => {
  it('sets isNegotiationOpen=true and stores suggestion on open', () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    const suggestion = makeSuggestion();

    act(() => result.current.openNegotiation(suggestion));

    expect(result.current.state.isNegotiationOpen).toBe(true);
    expect(result.current.state.selectedSuggestion).toEqual(suggestion);
  });

  it('sets isNegotiationOpen=false and clears suggestion on close', () => {
    const { result } = renderHook(() => useAppState(), { wrapper });

    act(() => result.current.openNegotiation(makeSuggestion()));
    act(() => result.current.closeNegotiation());

    expect(result.current.state.isNegotiationOpen).toBe(false);
    expect(result.current.state.selectedSuggestion).toBeNull();
  });
});

// ─── Render drawer flags ──────────────────────────────────────────────────────

describe('openRenderDrawer / closeRenderDrawer', () => {
  it('toggles isRenderDrawerOpen correctly', () => {
    const { result } = renderHook(() => useAppState(), { wrapper });

    act(() => result.current.openRenderDrawer());
    expect(result.current.state.isRenderDrawerOpen).toBe(true);

    act(() => result.current.closeRenderDrawer());
    expect(result.current.state.isRenderDrawerOpen).toBe(false);
  });
});

// ─── State propagation (Req 17.1) ─────────────────────────────────────────────

describe('state propagation to multiple consumers (Req 17.1)', () => {
  it('all hook instances see the same state update', () => {
    // Two separate useAppState calls within the same provider
    const { result } = renderHook(
      () => ({ a: useAppState(), b: useAppState() }),
      { wrapper }
    );

    act(() => result.current.a.openRenderDrawer());

    // Both consumers reflect the change
    expect(result.current.a.state.isRenderDrawerOpen).toBe(true);
    expect(result.current.b.state.isRenderDrawerOpen).toBe(true);
  });

  it('document update is visible to all consumers', () => {
    const { result } = renderHook(
      () => ({ a: useAppState(), b: useAppState() }),
      { wrapper }
    );
    const doc = makeDocument();

    act(() => result.current.a.setDocument(doc, '/path/doc.json'));

    expect(result.current.b.state.document).toEqual(doc);
    expect(result.current.b.state.filePath).toBe('/path/doc.json');
  });
});

// ─── useAppState outside provider ────────────────────────────────────────────

describe('useAppState outside provider', () => {
  it('throws when used outside AppStateProvider', () => {
    // Suppress the expected React error boundary console output
    const spy = vi.spyOn(console, 'error').mockImplementation(() => { });
    expect(() => renderHook(() => useAppState())).toThrow(
      'useAppState must be used within AppStateProvider'
    );
    spy.mockRestore();
  });
});

// ─── AI service status (Req 25.4, 25.5) ──────────────────────────────────────

describe('aiServiceAvailable state', () => {
  it('initializes as null (checking)', () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    expect(result.current.state.aiServiceAvailable).toBeNull();
  });

  it('setAiServiceStatus(true) sets aiServiceAvailable to true', () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    act(() => result.current.setAiServiceStatus(true));
    expect(result.current.state.aiServiceAvailable).toBe(true);
  });

  it('setAiServiceStatus(false) sets aiServiceAvailable to false', () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    act(() => result.current.setAiServiceStatus(false));
    expect(result.current.state.aiServiceAvailable).toBe(false);
  });

  it('setAiServiceStatus(null) resets to null (checking)', () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    act(() => result.current.setAiServiceStatus(true));
    act(() => result.current.setAiServiceStatus(null));
    expect(result.current.state.aiServiceAvailable).toBeNull();
  });
});
