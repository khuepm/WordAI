/**
 * Unit tests for SuggestionCard component
 * Requirements: 4.2, 4.4, 4.5
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SuggestionCard } from './SuggestionCard';
import type { ArchiveSuggestion } from '../types/archive';

// Mock react-i18next with a passthrough t function
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

function createSuggestion(overrides: Partial<ArchiveSuggestion> = {}): ArchiveSuggestion {
  return {
    id: 'suggestion-1',
    archive_item_id: 'item-1',
    category: 'unused_concept',
    title: 'Test Suggestion Title',
    description: 'A description of the suggestion for testing purposes.',
    archived_at: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
    relevance_score: 0.85,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Req 4.5 — Primary vs secondary styling
// ---------------------------------------------------------------------------
describe('Primary vs secondary styling (Req 4.5)', () => {
  it('renders primary card with stronger shadow and primary border', () => {
    const { container } = render(
      <SuggestionCard
        suggestion={createSuggestion()}
        isPrimary={true}
        onReview={vi.fn()}
      />
    );

    const article = container.querySelector('article')!;
    expect(article.style.boxShadow).toContain('--shadow-ambient-strong');
    expect(article.style.border).toContain('rgba(67, 67, 213, 0.1)');
  });

  it('renders secondary card with ambient shadow and outline-variant border', () => {
    const { container } = render(
      <SuggestionCard
        suggestion={createSuggestion()}
        isPrimary={false}
        onReview={vi.fn()}
      />
    );

    const article = container.querySelector('article')!;
    expect(article.style.boxShadow).toContain('--shadow-ambient');
    expect(article.style.border).toContain('rgba(199, 196, 215, 0.1)');
  });
});

// ---------------------------------------------------------------------------
// Req 4.4 — "Referenced Work" variant renders Compare/Restore buttons
// ---------------------------------------------------------------------------
describe('"Referenced Work" variant renders Compare/Restore buttons (Req 4.4)', () => {
  it('renders Compare and Restore buttons for referenced_work category', () => {
    const suggestion = createSuggestion({ category: 'referenced_work' });

    render(
      <SuggestionCard
        suggestion={suggestion}
        isPrimary={false}
        onReview={vi.fn()}
        onCompare={vi.fn()}
        onRestore={vi.fn()}
      />
    );

    expect(screen.getByText('archive.actions.compare')).toBeInTheDocument();
    expect(screen.getByText('archive.actions.restore')).toBeInTheDocument();
    // Should NOT render the Review link
    expect(screen.queryByText('archive.actions.review')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Req 4.2 — Default variant renders Review link
// ---------------------------------------------------------------------------
describe('Default variant renders Review link (Req 4.2)', () => {
  it('renders Review action link for non-referenced_work categories', () => {
    const suggestion = createSuggestion({ category: 'unused_concept' });

    render(
      <SuggestionCard
        suggestion={suggestion}
        isPrimary={false}
        onReview={vi.fn()}
      />
    );

    expect(screen.getByText('archive.actions.review')).toBeInTheDocument();
    // Should NOT render Compare/Restore buttons
    expect(screen.queryByText('archive.actions.compare')).not.toBeInTheDocument();
    expect(screen.queryByText('archive.actions.restore')).not.toBeInTheDocument();
  });

  it('renders Review link for outdated_draft category', () => {
    const suggestion = createSuggestion({ category: 'outdated_draft' });

    render(
      <SuggestionCard
        suggestion={suggestion}
        isPrimary={true}
        onReview={vi.fn()}
      />
    );

    expect(screen.getByText('archive.actions.review')).toBeInTheDocument();
  });

  it('renders Review link for related_research category', () => {
    const suggestion = createSuggestion({ category: 'related_research' });

    render(
      <SuggestionCard
        suggestion={suggestion}
        isPrimary={false}
        onReview={vi.fn()}
      />
    );

    expect(screen.getByText('archive.actions.review')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Click handlers
// ---------------------------------------------------------------------------
describe('Click handlers', () => {
  it('calls onReview with suggestion id when Review is clicked', () => {
    const onReview = vi.fn();
    const suggestion = createSuggestion({ id: 'review-item-42' });

    render(
      <SuggestionCard
        suggestion={suggestion}
        isPrimary={false}
        onReview={onReview}
      />
    );

    fireEvent.click(screen.getByText('archive.actions.review'));
    expect(onReview).toHaveBeenCalledOnce();
    expect(onReview).toHaveBeenCalledWith('review-item-42');
  });

  it('calls onCompare with suggestion id when Compare is clicked', () => {
    const onCompare = vi.fn();
    const suggestion = createSuggestion({ id: 'compare-item-7', category: 'referenced_work' });

    render(
      <SuggestionCard
        suggestion={suggestion}
        isPrimary={false}
        onReview={vi.fn()}
        onCompare={onCompare}
        onRestore={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('archive.actions.compare'));
    expect(onCompare).toHaveBeenCalledOnce();
    expect(onCompare).toHaveBeenCalledWith('compare-item-7');
  });

  it('calls onRestore with suggestion id when Restore is clicked', () => {
    const onRestore = vi.fn();
    const suggestion = createSuggestion({ id: 'restore-item-9', category: 'referenced_work' });

    render(
      <SuggestionCard
        suggestion={suggestion}
        isPrimary={true}
        onReview={vi.fn()}
        onCompare={vi.fn()}
        onRestore={onRestore}
      />
    );

    fireEvent.click(screen.getByText('archive.actions.restore'));
    expect(onRestore).toHaveBeenCalledOnce();
    expect(onRestore).toHaveBeenCalledWith('restore-item-9');
  });
});
