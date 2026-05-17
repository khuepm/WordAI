/**
 * Unit tests for ArchiveSidebar component
 * Requirements: 2.1, 2.2, 2.3, 14.4
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArchiveSidebar } from './ArchiveSidebar';
import type { ArchiveCategory } from '../types/archive';

function renderSidebar(overrides: {
  activeCategory?: ArchiveCategory;
  onCategoryChange?: ReturnType<typeof vi.fn>;
  onNewEntry?: ReturnType<typeof vi.fn>;
} = {}) {
  const props = {
    activeCategory: overrides.activeCategory ?? 'drafts',
    onCategoryChange: overrides.onCategoryChange ?? vi.fn(),
    onNewEntry: overrides.onNewEntry ?? vi.fn(),
  };
  render(<ArchiveSidebar {...props} />);
  return props;
}

// ---------------------------------------------------------------------------
// Req 14.4 — ARIA navigation role
// ---------------------------------------------------------------------------
describe('ARIA navigation role (Req 14.4)', () => {
  it('renders with role="navigation"', () => {
    renderSidebar();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('has an accessible aria-label', () => {
    renderSidebar();
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveAttribute('aria-label');
  });
});

// ---------------------------------------------------------------------------
// Req 2.3 — Active category highlighting
// ---------------------------------------------------------------------------
describe('Active category highlighting (Req 2.3)', () => {
  it('marks the active category with aria-current="page"', () => {
    renderSidebar({ activeCategory: 'drafts' });
    const draftsButton = screen.getByTestId('archive-sidebar-drafts');
    expect(draftsButton).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark inactive categories with aria-current', () => {
    renderSidebar({ activeCategory: 'drafts' });
    const projectsButton = screen.getByTestId('archive-sidebar-projects');
    const versionsButton = screen.getByTestId('archive-sidebar-versions');
    const trashButton = screen.getByTestId('archive-sidebar-trash');

    expect(projectsButton).not.toHaveAttribute('aria-current');
    expect(versionsButton).not.toHaveAttribute('aria-current');
    expect(trashButton).not.toHaveAttribute('aria-current');
  });

  it('highlights the correct category when activeCategory changes', () => {
    renderSidebar({ activeCategory: 'versions' });
    const versionsButton = screen.getByTestId('archive-sidebar-versions');
    const draftsButton = screen.getByTestId('archive-sidebar-drafts');

    expect(versionsButton).toHaveAttribute('aria-current', 'page');
    expect(draftsButton).not.toHaveAttribute('aria-current');
  });
});

// ---------------------------------------------------------------------------
// Req 2.2 — "New Entry" button click calls onNewEntry
// ---------------------------------------------------------------------------
describe('"New Entry" button calls onNewEntry (Req 2.2)', () => {
  it('calls onNewEntry when the "New Entry" button is clicked', () => {
    const onNewEntry = vi.fn();
    renderSidebar({ onNewEntry });

    const newEntryButton = screen.getByTestId('archive-new-entry-button');
    fireEvent.click(newEntryButton);

    expect(onNewEntry).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Req 2.1 — Category link click calls onCategoryChange with correct category
// ---------------------------------------------------------------------------
describe('Category link click calls onCategoryChange (Req 2.1)', () => {
  it('calls onCategoryChange with "drafts" when Drafts is clicked', () => {
    const onCategoryChange = vi.fn();
    renderSidebar({ activeCategory: 'projects', onCategoryChange });

    fireEvent.click(screen.getByTestId('archive-sidebar-drafts'));
    expect(onCategoryChange).toHaveBeenCalledWith('drafts');
  });

  it('calls onCategoryChange with "projects" when Projects is clicked', () => {
    const onCategoryChange = vi.fn();
    renderSidebar({ onCategoryChange });

    fireEvent.click(screen.getByTestId('archive-sidebar-projects'));
    expect(onCategoryChange).toHaveBeenCalledWith('projects');
  });

  it('calls onCategoryChange with "versions" when Versions is clicked', () => {
    const onCategoryChange = vi.fn();
    renderSidebar({ onCategoryChange });

    fireEvent.click(screen.getByTestId('archive-sidebar-versions'));
    expect(onCategoryChange).toHaveBeenCalledWith('versions');
  });

  it('calls onCategoryChange with "trash" when Trash is clicked', () => {
    const onCategoryChange = vi.fn();
    renderSidebar({ onCategoryChange });

    fireEvent.click(screen.getByTestId('archive-sidebar-trash'));
    expect(onCategoryChange).toHaveBeenCalledWith('trash');
  });
});
