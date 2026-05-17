/**
 * Unit tests for ArchiveSearchBar and ArchiveFilterPanel components
 * Requirements: 3.1, 3.2, 3.4, 3.5, 3.9
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArchiveSearchBar } from './ArchiveSearchBar';
import { ArchiveFilterPanel } from './ArchiveFilterPanel';
import type { ArchiveFilters } from '../types/archive';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// ---------------------------------------------------------------------------
// ArchiveSearchBar Tests
// ---------------------------------------------------------------------------
describe('ArchiveSearchBar', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    onClear: vi.fn(),
    onToggleFilters: vi.fn(),
    isFilterPanelOpen: false,
  };

  // Req 3.9 — Clear button NOT rendered when value is empty
  it('does not render clear button when value is empty', () => {
    render(<ArchiveSearchBar {...defaultProps} value="" />);

    const clearButton = screen.queryByRole('button', { name: 'archive.search.clear' });
    expect(clearButton).not.toBeInTheDocument();
  });

  // Req 3.9 — Clear button IS rendered when value is non-empty
  it('renders clear button when value is non-empty', () => {
    render(<ArchiveSearchBar {...defaultProps} value="test query" />);

    const clearButton = screen.getByRole('button', { name: 'archive.search.clear' });
    expect(clearButton).toBeInTheDocument();
  });

  // Req 3.9 — Clicking clear button calls onClear
  it('calls onClear when clear button is clicked', () => {
    const onClear = vi.fn();
    render(<ArchiveSearchBar {...defaultProps} value="test" onClear={onClear} />);

    const clearButton = screen.getByRole('button', { name: 'archive.search.clear' });
    fireEvent.click(clearButton);

    expect(onClear).toHaveBeenCalledOnce();
  });

  // Req 3.4 — Clicking filters button calls onToggleFilters
  it('calls onToggleFilters when filters button is clicked', () => {
    const onToggleFilters = vi.fn();
    render(<ArchiveSearchBar {...defaultProps} onToggleFilters={onToggleFilters} />);

    const filtersButton = screen.getByRole('button', { name: 'archive.search.filters' });
    fireEvent.click(filtersButton);

    expect(onToggleFilters).toHaveBeenCalledOnce();
  });

  // Req 3.1 — Input change calls onChange
  it('calls onChange when input value changes', () => {
    const onChange = vi.fn();
    render(<ArchiveSearchBar {...defaultProps} onChange={onChange} />);

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'new query' } });

    expect(onChange).toHaveBeenCalledWith('new query');
  });
});

// ---------------------------------------------------------------------------
// ArchiveFilterPanel Tests
// ---------------------------------------------------------------------------
describe('ArchiveFilterPanel', () => {
  const defaultFilters: ArchiveFilters = { types: [], dateRange: 'all' };

  // Req 3.5 — Clicking a type chip toggles it
  it('calls onChange with updated types when a type chip is clicked', () => {
    const onChange = vi.fn();
    render(
      <ArchiveFilterPanel filters={defaultFilters} onChange={onChange} onClear={vi.fn()} />
    );

    // Click the "suggestions" type chip
    const suggestionsChip = screen.getByRole('checkbox', { name: 'archive.filters.itemType.suggestions' });
    fireEvent.click(suggestionsChip);

    expect(onChange).toHaveBeenCalledWith({ types: ['suggestions'], dateRange: 'all' });
  });

  it('calls onChange removing a type when an active type chip is clicked', () => {
    const onChange = vi.fn();
    const filtersWithType: ArchiveFilters = { types: ['suggestions'], dateRange: 'all' };
    render(
      <ArchiveFilterPanel filters={filtersWithType} onChange={onChange} onClear={vi.fn()} />
    );

    // Click the already-active "suggestions" chip to deselect
    const suggestionsChip = screen.getByRole('checkbox', { name: 'archive.filters.itemType.suggestions' });
    fireEvent.click(suggestionsChip);

    expect(onChange).toHaveBeenCalledWith({ types: [], dateRange: 'all' });
  });

  // Req 3.5 — Clicking a date range option selects it
  it('calls onChange with updated dateRange when a date range option is clicked', () => {
    const onChange = vi.fn();
    render(
      <ArchiveFilterPanel filters={defaultFilters} onChange={onChange} onClear={vi.fn()} />
    );

    const last7DaysOption = screen.getByRole('radio', { name: 'archive.filters.dateRange.last7Days' });
    fireEvent.click(last7DaysOption);

    expect(onChange).toHaveBeenCalledWith({ types: [], dateRange: 'last_7_days' });
  });

  // Req 3.2 — "Clear all filters" button calls onClear
  it('calls onClear when "Clear all filters" button is clicked', () => {
    const onClear = vi.fn();
    const activeFilters: ArchiveFilters = { types: ['versions'], dateRange: 'last_30_days' };
    render(
      <ArchiveFilterPanel filters={activeFilters} onChange={vi.fn()} onClear={onClear} />
    );

    const clearButton = screen.getByRole('button', { name: 'archive.filters.clearAll' });
    fireEvent.click(clearButton);

    expect(onClear).toHaveBeenCalledOnce();
  });

  // "Clear all filters" button is hidden when no filters are active
  it('does not render "Clear all filters" button when no filters are active', () => {
    render(
      <ArchiveFilterPanel filters={defaultFilters} onChange={vi.fn()} onClear={vi.fn()} />
    );

    const clearButton = screen.queryByRole('button', { name: 'archive.filters.clearAll' });
    expect(clearButton).not.toBeInTheDocument();
  });
});
