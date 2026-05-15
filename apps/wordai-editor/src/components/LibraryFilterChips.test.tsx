/**
 * Unit tests for LibraryFilterChips component
 * Requirements: 8.1, 8.2, 8.5
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LibraryFilterChips } from './LibraryFilterChips';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

// ---------------------------------------------------------------------------
// Req 8.4 — Active visual style on the matching chip
// ---------------------------------------------------------------------------
describe('Active chip style (Req 8.4)', () => {
  it('applies active style (primary background) to the "All" chip when activeFilter="all"', () => {
    render(
      <LibraryFilterChips activeFilter="all" onChange={vi.fn()} />
    );

    const allBtn = screen.getByRole('button', { name: /all/i });
    // aria-pressed reflects the active state
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');

    const docsBtn = screen.getByRole('button', { name: /documents/i });
    expect(docsBtn).toHaveAttribute('aria-pressed', 'false');

    const aiBtn = screen.getByRole('button', { name: /ai-ready/i });
    expect(aiBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('applies active style to the "Documents" chip when activeFilter="documents"', () => {
    render(
      <LibraryFilterChips activeFilter="documents" onChange={vi.fn()} />
    );

    expect(screen.getByRole('button', { name: /documents/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /all/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /ai-ready/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('applies active style to the "AI-ready" chip when activeFilter="ai-ready"', () => {
    render(
      <LibraryFilterChips activeFilter="ai-ready" onChange={vi.fn()} />
    );

    expect(screen.getByRole('button', { name: /ai-ready/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /all/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /documents/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

// ---------------------------------------------------------------------------
// Req 8.1, 8.2 — Clicking chips calls onChange with the correct filter value
// ---------------------------------------------------------------------------
describe('Chip click interactions (Req 8.1, 8.2)', () => {
  it('calls onChange("documents") when the "Documents" chip is clicked', async () => {
    const onChange = vi.fn();
    render(
      <LibraryFilterChips activeFilter="all" onChange={onChange} />
    );

    await userEvent.click(screen.getByRole('button', { name: /documents/i }));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('documents');
  });

  it('calls onChange("ai-ready") when the "AI-ready" chip is clicked', async () => {
    const onChange = vi.fn();
    render(
      <LibraryFilterChips activeFilter="all" onChange={onChange} />
    );

    await userEvent.click(screen.getByRole('button', { name: /ai-ready/i }));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('ai-ready');
  });

  it('calls onChange("all") when the "All" chip is clicked', async () => {
    const onChange = vi.fn();
    render(
      <LibraryFilterChips activeFilter="documents" onChange={onChange} />
    );

    await userEvent.click(screen.getByRole('button', { name: /all/i }));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('all');
  });
});

// ---------------------------------------------------------------------------
// Req 8.1 — All three chips are rendered
// ---------------------------------------------------------------------------
describe('Chip rendering (Req 8.1)', () => {
  it('renders all three filter chips', () => {
    render(
      <LibraryFilterChips activeFilter="all" onChange={vi.fn()} />
    );

    expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /documents/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ai-ready/i })).toBeInTheDocument();
  });
});
