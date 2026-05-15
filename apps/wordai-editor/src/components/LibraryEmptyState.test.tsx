/**
 * Unit tests for LibraryEmptyState component
 * Requirements: 2.3, 7.4
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LibraryEmptyState } from './LibraryEmptyState';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

// ---------------------------------------------------------------------------
// reason='no-documents' — heading and CTA
// ---------------------------------------------------------------------------
describe('reason="no-documents" renders correct heading and CTA (Req 2.3)', () => {
  it('renders the "Library is empty" heading', () => {
    render(
      <LibraryEmptyState reason="no-documents" onCreateNew={vi.fn()} />
    );

    expect(screen.getByRole('heading')).toHaveTextContent('Library is empty');
  });

  it('renders the "Create Document" CTA button', () => {
    render(
      <LibraryEmptyState reason="no-documents" onCreateNew={vi.fn()} />
    );

    expect(screen.getByTestId('library-empty-state-cta')).toHaveTextContent(
      'Create Document'
    );
  });

  it('renders the body message prompting to create or import', () => {
    render(
      <LibraryEmptyState reason="no-documents" onCreateNew={vi.fn()} />
    );

    expect(
      screen.getByText('Create a new document or import a file to get started.')
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// reason='no-results' — heading with query interpolated
// ---------------------------------------------------------------------------
describe('reason="no-results" renders correct heading with query interpolated (Req 7.4)', () => {
  it('renders the "No results found" heading', () => {
    render(
      <LibraryEmptyState
        reason="no-results"
        searchQuery="my query"
        onCreateNew={vi.fn()}
      />
    );

    expect(screen.getByRole('heading')).toHaveTextContent('No results found');
  });

  it('interpolates the search query into the body message', () => {
    render(
      <LibraryEmptyState
        reason="no-results"
        searchQuery="hello world"
        onCreateNew={vi.fn()}
      />
    );

    expect(
      screen.getByText('No documents match "hello world".')
    ).toBeInTheDocument();
  });

  it('renders the "Clear search" CTA button', () => {
    render(
      <LibraryEmptyState
        reason="no-results"
        searchQuery="test"
        onCreateNew={vi.fn()}
      />
    );

    expect(screen.getByTestId('library-empty-state-cta')).toHaveTextContent(
      'Clear search'
    );
  });

  it('uses an empty string when searchQuery is omitted', () => {
    render(
      <LibraryEmptyState reason="no-results" onCreateNew={vi.fn()} />
    );

    expect(screen.getByText('No documents match "".')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Clicking the CTA calls onCreateNew (Req 2.3)
// ---------------------------------------------------------------------------
describe('Clicking the CTA in "no-documents" mode calls onCreateNew (Req 2.3)', () => {
  it('calls onCreateNew when the CTA button is clicked', () => {
    const onCreateNew = vi.fn();
    render(
      <LibraryEmptyState reason="no-documents" onCreateNew={onCreateNew} />
    );

    fireEvent.click(screen.getByTestId('library-empty-state-cta'));

    expect(onCreateNew).toHaveBeenCalledOnce();
  });

  it('does not call onCreateNew before the button is clicked', () => {
    const onCreateNew = vi.fn();
    render(
      <LibraryEmptyState reason="no-documents" onCreateNew={onCreateNew} />
    );

    expect(onCreateNew).not.toHaveBeenCalled();
  });

  it('calls onCreateNew when the CTA is clicked in "no-results" mode', () => {
    const onCreateNew = vi.fn();
    render(
      <LibraryEmptyState
        reason="no-results"
        searchQuery="foo"
        onCreateNew={onCreateNew}
      />
    );

    fireEvent.click(screen.getByTestId('library-empty-state-cta'));

    expect(onCreateNew).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Container renders with correct test id and aria-live
// ---------------------------------------------------------------------------
describe('Container element is accessible', () => {
  it('renders the data-testid="library-empty-state" container', () => {
    render(
      <LibraryEmptyState reason="no-documents" onCreateNew={vi.fn()} />
    );

    expect(screen.getByTestId('library-empty-state')).toBeInTheDocument();
  });

  it('has aria-live="polite" on the container', () => {
    render(
      <LibraryEmptyState reason="no-documents" onCreateNew={vi.fn()} />
    );

    expect(screen.getByTestId('library-empty-state')).toHaveAttribute(
      'aria-live',
      'polite'
    );
  });
});
