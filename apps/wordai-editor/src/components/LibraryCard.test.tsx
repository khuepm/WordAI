/**
 * Unit tests for LibraryCard component
 * Requirements: 2.6
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LibraryCard } from './LibraryCard';
import type { AuraIntentSummary } from '../types/auraDocument';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const summary: AuraIntentSummary = {
  id: 'test-id-123',
  intent_name: 'My Test Document',
  created_at: Date.now() - 86400000,
  updated_at: Date.now() - 3600000,
  version: 3,
};

describe('LibraryCard', () => {
  it('clicking the card calls onOpen with the correct id', () => {
    const onOpen = vi.fn();
    render(
      <LibraryCard
        summary={summary}
        isLoading={false}
        hasError={false}
        onOpen={onOpen}
        onDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('library-card'));

    expect(onOpen).toHaveBeenCalledWith('test-id-123');
  });

  it('clicking the delete button calls onDelete with the correct id', () => {
    const onDelete = vi.fn();
    render(
      <LibraryCard
        summary={summary}
        isLoading={false}
        hasError={false}
        onOpen={vi.fn()}
        onDelete={onDelete}
      />
    );

    fireEvent.click(screen.getByTestId('library-card-delete'));

    expect(onDelete).toHaveBeenCalledWith('test-id-123');
  });

  it('isLoading=true shows the loading spinner', () => {
    render(
      <LibraryCard
        summary={summary}
        isLoading={true}
        hasError={false}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByTestId('library-card-loading')).toBeInTheDocument();
  });

  it('isLoading=false does not show the loading spinner', () => {
    render(
      <LibraryCard
        summary={summary}
        isLoading={false}
        hasError={false}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.queryByTestId('library-card-loading')).not.toBeInTheDocument();
  });

  it('hasError=true shows the error message', () => {
    render(
      <LibraryCard
        summary={summary}
        isLoading={false}
        hasError={true}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByTestId('library-card-error')).toBeInTheDocument();
  });

  it('hasError=false does not show the error message', () => {
    render(
      <LibraryCard
        summary={summary}
        isLoading={false}
        hasError={false}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.queryByTestId('library-card-error')).not.toBeInTheDocument();
  });
});
