/**
 * Unit tests for LibrarySearchBar component
 * Requirements: 7.1, 7.5
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LibrarySearchBar } from './LibrarySearchBar';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

// ---------------------------------------------------------------------------
// Req 7.5 — Clear button visibility
// ---------------------------------------------------------------------------
describe('Clear button visibility (Req 7.5)', () => {
  it('does NOT render the clear button when value is empty', () => {
    render(
      <LibrarySearchBar value="" onChange={vi.fn()} onClear={vi.fn()} />
    );

    expect(
      screen.queryByRole('button', { name: /clear search/i })
    ).not.toBeInTheDocument();
  });

  it('renders the clear button when value is non-empty', () => {
    render(
      <LibrarySearchBar value="hello" onChange={vi.fn()} onClear={vi.fn()} />
    );

    expect(
      screen.getByRole('button', { name: /clear search/i })
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Req 7.5 — Clicking clear button calls onClear
// ---------------------------------------------------------------------------
describe('Clear button interaction (Req 7.5)', () => {
  it('calls onClear when the clear button is clicked', async () => {
    const onClear = vi.fn();
    render(
      <LibrarySearchBar value="some text" onChange={vi.fn()} onClear={onClear} />
    );

    const clearBtn = screen.getByRole('button', { name: /clear search/i });
    await userEvent.click(clearBtn);

    expect(onClear).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Req 7.1 — Typing calls onChange with the new value
// ---------------------------------------------------------------------------
describe('Input change (Req 7.1)', () => {
  it('calls onChange with the new value when the user types', () => {
    const onChange = vi.fn();
    render(
      <LibrarySearchBar value="" onChange={onChange} onClear={vi.fn()} />
    );

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'test query' } });

    expect(onChange).toHaveBeenCalledWith('test query');
  });
});

// ---------------------------------------------------------------------------
// Accessibility — ARIA attributes
// ---------------------------------------------------------------------------
describe('Accessibility attributes', () => {
  it('renders the input with role="searchbox"', () => {
    render(
      <LibrarySearchBar value="" onChange={vi.fn()} onClear={vi.fn()} />
    );

    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('input has an aria-label matching the placeholder', () => {
    render(
      <LibrarySearchBar value="" onChange={vi.fn()} onClear={vi.fn()} />
    );

    const input = screen.getByRole('searchbox');
    // The aria-label and placeholder both use t('library.searchPlaceholder')
    expect(input).toHaveAttribute('aria-label');
    expect(input.getAttribute('aria-label')).toBe(input.getAttribute('placeholder'));
  });
});
