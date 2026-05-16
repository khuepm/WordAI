/**
 * Unit tests for LibraryFilterChips component
 * Requirements: 8.1, 8.2, 8.5
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LibraryFilterChips } from './LibraryFilterChips';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

// ---------------------------------------------------------------------------
// Req 8.1, 8.4 — Active chip visual style
// ---------------------------------------------------------------------------
describe('Active chip style (Req 8.1, 8.4)', () => {
  it('applies active style to the "All" chip when activeFilter="all"', () => {
    render(
      <LibraryFilterChips activeFilter="all" onChange={vi.fn()} />
    );

    const allChip = screen.getByTestId('filter-chip-all');
    expect(allChip).toHaveAttribute('aria-pressed', 'true');

    const documentsChip = screen.getByTestId('filter-chip-documents');
    expect(documentsChip).toHaveAttribute('aria-pressed', 'false');

    const aiReadyChip = screen.getByTestId('filter-chip-ai-ready');
    expect(aiReadyChip).toHaveAttribute('aria-pressed', 'false');
  });

  it('applies active style to the "Documents" chip when activeFilter="documents"', () => {
    render(
      <LibraryFilterChips activeFilter="documents" onChange={vi.fn()} />
    );

    expect(screen.getByTestId('filter-chip-documents')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('filter-chip-all')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('filter-chip-ai-ready')).toHaveAttribute('aria-pressed', 'false');
  });

  it('applies active style to the "AI-ready" chip when activeFilter="ai-ready"', () => {
    render(
      <LibraryFilterChips activeFilter="ai-ready" onChange={vi.fn()} />
    );

    expect(screen.getByTestId('filter-chip-ai-ready')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('filter-chip-all')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('filter-chip-documents')).toHaveAttribute('aria-pressed', 'false');
  });
});

// ---------------------------------------------------------------------------
// Req 8.2, 8.5 — Clicking chips calls onChange with correct filter value
// ---------------------------------------------------------------------------
describe('Chip click interactions (Req 8.2, 8.5)', () => {
  it('calls onChange("documents") when the "Documents" chip is clicked', () => {
    const onChange = vi.fn();
    render(
      <LibraryFilterChips activeFilter="all" onChange={onChange} />
    );

    fireEvent.click(screen.getByTestId('filter-chip-documents'));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('documents');
  });

  it('calls onChange("ai-ready") when the "AI-ready" chip is clicked', () => {
    const onChange = vi.fn();
    render(
      <LibraryFilterChips activeFilter="all" onChange={onChange} />
    );

    fireEvent.click(screen.getByTestId('filter-chip-ai-ready'));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('ai-ready');
  });

  it('calls onChange("all") when the "All" chip is clicked', () => {
    const onChange = vi.fn();
    render(
      <LibraryFilterChips activeFilter="documents" onChange={onChange} />
    );

    fireEvent.click(screen.getByTestId('filter-chip-all'));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('all');
  });
});

// ---------------------------------------------------------------------------
// Rendering — all three chips are always present
// ---------------------------------------------------------------------------
describe('Chip rendering', () => {
  it('renders all three chips regardless of activeFilter', () => {
    render(
      <LibraryFilterChips activeFilter="all" onChange={vi.fn()} />
    );

    expect(screen.getByTestId('filter-chip-all')).toBeInTheDocument();
    expect(screen.getByTestId('filter-chip-documents')).toBeInTheDocument();
    expect(screen.getByTestId('filter-chip-ai-ready')).toBeInTheDocument();
  });

  it('renders chip labels from i18n keys', () => {
    render(
      <LibraryFilterChips activeFilter="all" onChange={vi.fn()} />
    );

    // en.json values
    expect(screen.getByTestId('filter-chip-all')).toHaveTextContent('All');
    expect(screen.getByTestId('filter-chip-documents')).toHaveTextContent('Documents');
    expect(screen.getByTestId('filter-chip-ai-ready')).toHaveTextContent('AI-ready');
  });
});
