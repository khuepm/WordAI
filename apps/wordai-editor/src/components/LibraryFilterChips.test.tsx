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
// Req 8.1 — All three chips are rendered
// ---------------------------------------------------------------------------
describe('Chip rendering (Req 8.1)', () => {
  it('renders All, Documents, and AI-ready chips', () => {
    render(<LibraryFilterChips activeFilter="all" onChange={vi.fn()} />);

    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('AI-ready')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Req 8.4 — Active chip has primary color background and border
// ---------------------------------------------------------------------------
describe('Active chip style (Req 8.4)', () => {
  it('marks the "All" chip as pressed when activeFilter is "all"', () => {
    render(<LibraryFilterChips activeFilter="all" onChange={vi.fn()} />);

    const allChip = screen.getByText('All').closest('button')!;
    expect(allChip).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks the "Documents" chip as pressed when activeFilter is "documents"', () => {
    render(<LibraryFilterChips activeFilter="documents" onChange={vi.fn()} />);

    const docsChip = screen.getByText('Documents').closest('button')!;
    expect(docsChip).toHaveAttribute('aria-pressed', 'true');

    // Other chips should not be active
    const allChip = screen.getByText('All').closest('button')!;
    expect(allChip).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks the "AI-ready" chip as pressed when activeFilter is "ai-ready"', () => {
    render(<LibraryFilterChips activeFilter="ai-ready" onChange={vi.fn()} />);

    const aiChip = screen.getByText('AI-ready').closest('button')!;
    expect(aiChip).toHaveAttribute('aria-pressed', 'true');

    // Other chips should not be active
    const allChip = screen.getByText('All').closest('button')!;
    expect(allChip).toHaveAttribute('aria-pressed', 'false');
  });

  it('applies primary background color to the active chip', () => {
    render(<LibraryFilterChips activeFilter="all" onChange={vi.fn()} />);

    const allChip = screen.getByText('All').closest('button')!;
    expect(allChip.style.background).toContain('var(--md-sys-color-primary');
  });

  it('does NOT apply primary background to inactive chips', () => {
    render(<LibraryFilterChips activeFilter="all" onChange={vi.fn()} />);

    const docsChip = screen.getByText('Documents').closest('button')!;
    expect(docsChip.style.background).toBe('transparent');
  });
});

// ---------------------------------------------------------------------------
// Req 8.2, 8.5 — Clicking a chip calls onChange with the correct filter value
// ---------------------------------------------------------------------------
describe('Chip click interactions (Req 8.2, 8.5)', () => {
  it('calls onChange("all") when the "All" chip is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<LibraryFilterChips activeFilter="documents" onChange={onChange} />);

    await user.click(screen.getByText('All'));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('all');
  });

  it('calls onChange("documents") when the "Documents" chip is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<LibraryFilterChips activeFilter="all" onChange={onChange} />);

    await user.click(screen.getByText('Documents'));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('documents');
  });

  it('calls onChange("ai-ready") when the "AI-ready" chip is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<LibraryFilterChips activeFilter="all" onChange={onChange} />);

    await user.click(screen.getByText('AI-ready'));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('ai-ready');
  });
});
