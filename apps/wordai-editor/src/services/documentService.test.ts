/**
 * documentService unit tests
 * Requirements: 1.1, 13.2, 14.1, 14.2, 15.1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDocument, loadDocument, deserializeDocument, getDocumentPath } from './documentService';

// Mock Tauri IPC
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
const mockInvoke = vi.mocked(invoke);

const rawDoc = {
  id: 'abc',
  title: 'Test',
  content: '',
  metadata: { word_count: 0, reading_time: 0, status: 'draft', tags: [] },
  version: 1,
  last_modified: '2024-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getDocumentPath', () => {
  it('returns documents/<id>.json', () => {
    expect(getDocumentPath('abc')).toBe('documents/abc.json');
  });
});

describe('deserializeDocument', () => {
  it('maps snake_case fields to camelCase', () => {
    const doc = deserializeDocument(rawDoc);
    expect(doc.metadata.wordCount).toBe(0);
    expect(doc.metadata.readingTime).toBe(0);
    expect(doc.lastModified).toBeInstanceOf(Date);
    expect(doc.lastModified.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });
});

describe('createDocument', () => {
  it('generates unique IDs on successive calls', async () => {
    mockInvoke
      .mockResolvedValueOnce({ ...rawDoc, id: 'id-1' })
      .mockResolvedValueOnce({ ...rawDoc, id: 'id-2' });

    const doc1 = await createDocument();
    const doc2 = await createDocument();
    expect(doc1.id).not.toBe(doc2.id);
  });

  it('calls create_document with id, title, and derived path', async () => {
    mockInvoke.mockResolvedValueOnce(rawDoc);

    await createDocument('My Doc');

    expect(mockInvoke).toHaveBeenCalledOnce();
    const [cmd, args] = mockInvoke.mock.calls[0] as [string, Record<string, unknown>];
    expect(cmd).toBe('create_document');
    expect(args.title).toBe('My Doc');
    expect(typeof args.id).toBe('string');
    expect(args.path).toBe(`documents/${args.id}.json`);
  });

  it('deserializes the Tauri response into a Document', async () => {
    mockInvoke.mockResolvedValueOnce(rawDoc);
    const doc = await createDocument();
    expect(doc.id).toBe('abc');
    expect(doc.lastModified).toBeInstanceOf(Date);
    expect(doc.metadata.wordCount).toBe(0);
  });
});

describe('loadDocument', () => {
  it('calls load_document with the correct path', async () => {
    mockInvoke.mockResolvedValueOnce(rawDoc);
    await loadDocument('documents/abc.json');
    expect(mockInvoke).toHaveBeenCalledWith('load_document', { path: 'documents/abc.json' });
  });

  it('correctly deserializes snake_case last_modified to camelCase lastModified as Date', async () => {
    mockInvoke.mockResolvedValueOnce(rawDoc);
    const doc = await loadDocument('documents/abc.json');
    expect(doc.lastModified).toBeInstanceOf(Date);
    expect(doc.lastModified.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    expect(doc.metadata.wordCount).toBe(0);
    expect(doc.metadata.readingTime).toBe(0);
  });

  it('rejects when Tauri returns an IPC error', async () => {
    mockInvoke.mockRejectedValueOnce({ code: 'NOT_FOUND', message: 'File not found' });
    await expect(loadDocument('documents/missing.json')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
