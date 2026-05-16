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

    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();
  });

  it('renders the clear button when value is non-empty', () => {
    render(
      <LibrarySearchBar value="hello" onChange={vi.fn()} onClear={vi.fn()} />
    );

    expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Req 7.5 — Clicking the clear button calls onClear
// ---------------------------------------------------------------------------
describe('Clear button interaction (Req 7.5)', () => {
  it('calls onClear when the clear button is clicked', async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();

    render(
      <LibrarySearchBar value="some text" onChange={vi.fn()} onClear={onClear} />
    );

    await user.click(screen.getByRole('button', { name: /clear search/i }));

    expect(onClear).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Req 7.1 — Typing calls onChange with the new value
// ---------------------------------------------------------------------------
describe('Input interaction (Req 7.1)', () => {
  it('calls onChange with the new value when the user types', () => {
    const onChange = vi.fn();

    render(
      <LibrarySearchBar value="" onChange={onChange} onClear={vi.fn()} />
    );

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'test query' } });

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('test query');
  });

  it('calls onChange with each intermediate value as the user types character by character', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    // Render as a controlled component that tracks its own value
    const { rerender } = render(
      <LibrarySearchBar value="" onChange={onChange} onClear={vi.fn()} />
    );

    const input = screen.getByRole('searchbox');

    // Type 'ab' — each keystroke fires onChange
    await user.type(input, 'a');
    rerender(<LibrarySearchBar value="a" onChange={onChange} onClear={vi.fn()} />);

    await user.type(input, 'b');
    rerender(<LibrarySearchBar value="ab" onChange={onChange} onClear={vi.fn()} />);

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[0][0]).toBe('a');
    expect(onChange.mock.calls[1][0]).toBe('ab');
  });
});
