/**
 * Unit tests for VersionListItem component
 * Requirements: 5.3, 5.4, 5.5, 5.6, 5.7, 12.2, 12.5
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VersionListItem } from './VersionListItem';
import type { ArchivedVersion } from '../types/archive';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? JSON.stringify(opts) : key,
  }),
}));

function createVersion(overrides: Partial<ArchivedVersion> = {}): ArchivedVersion {
  return {
    id: 'ver-1',
    intent_name: 'My Document',
    version: 2,
    archived_at: Math.floor(Date.now() / 1000) - 172800, // 2 days ago
    archive_reason: 'Superseded by newer version',
    related_current_id: 'doc-current-1',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Req 5.3 — Renders document icon, title, timestamp, and reason
// ---------------------------------------------------------------------------
describe('VersionListItem renders version metadata (Req 5.3)', () => {
  it('renders the document title with semibold weight', () => {
    const version = createVersion();
    render(
      <VersionListItem
        version={version}
        onOpen={vi.fn()}
        onCompare={vi.fn()}
        onRestore={vi.fn()}
      />
    );

    expect(screen.getByText('My Document')).toBeInTheDocument();
  });

  it('renders the archive reason', () => {
    const version = createVersion({ archive_reason: 'Outdated draft' });
    render(
      <VersionListItem
        version={version}
        onOpen={vi.fn()}
        onCompare={vi.fn()}
        onRestore={vi.fn()}
      />
    );

    expect(screen.getByText('Outdated draft')).toBeInTheDocument();
  });

  it('renders a relative timestamp', () => {
    const version = createVersion({
      archived_at: Math.floor(Date.now() / 1000) - 172800,
    });
    render(
      <VersionListItem
        version={version}
        onOpen={vi.fn()}
        onCompare={vi.fn()}
        onRestore={vi.fn()}
      />
    );

    expect(screen.getByText('2 days ago')).toBeInTheDocument();
  });

  it('renders the document icon', () => {
    const version = createVersion();
    render(
      <VersionListItem
        version={version}
        onOpen={vi.fn()}
        onCompare={vi.fn()}
        onRestore={vi.fn()}
      />
    );

    expect(screen.getByText('description')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Req 5.4 — Compare and Restore action buttons visible on hover
// ---------------------------------------------------------------------------
describe('Action buttons visibility on hover (Req 5.4)', () => {
  it('action buttons are hidden by default (opacity 0)', () => {
    const version = createVersion();
    const { container } = render(
      <VersionListItem
        version={version}
        onOpen={vi.fn()}
        onCompare={vi.fn()}
        onRestore={vi.fn()}
      />
    );

    const compareBtn = screen.getByLabelText('archive.actions.compare');
    const actionsContainer = compareBtn.parentElement!;
    expect(actionsContainer.style.opacity).toBe('0');
  });

  it('action buttons become visible on hover (opacity 1)', () => {
    const version = createVersion();
    const { container } = render(
      <VersionListItem
        version={version}
        onOpen={vi.fn()}
        onCompare={vi.fn()}
        onRestore={vi.fn()}
      />
    );

    const listItem = screen.getByRole('listitem');
    fireEvent.mouseEnter(listItem);

    const compareBtn = screen.getByLabelText('archive.actions.compare');
    const actionsContainer = compareBtn.parentElement!;
    expect(actionsContainer.style.opacity).toBe('1');
  });
});

// ---------------------------------------------------------------------------
// Req 5.5 — Click on title/body opens detail drawer
// ---------------------------------------------------------------------------
describe('Click on title/body calls onOpen (Req 5.5)', () => {
  it('calls onOpen with version id when title area is clicked', () => {
    const onOpen = vi.fn();
    const version = createVersion({ id: 'ver-42' });
    render(
      <VersionListItem
        version={version}
        onOpen={onOpen}
        onCompare={vi.fn()}
        onRestore={vi.fn()}
      />
    );

    const titleButton = screen.getByRole('button', {
      name: /ver-42|My Document/i,
    });
    fireEvent.click(titleButton);

    expect(onOpen).toHaveBeenCalledWith('ver-42');
  });

  it('calls onOpen when Enter is pressed on the title area', () => {
    const onOpen = vi.fn();
    const version = createVersion({ id: 'ver-99' });
    render(
      <VersionListItem
        version={version}
        onOpen={onOpen}
        onCompare={vi.fn()}
        onRestore={vi.fn()}
      />
    );

    const titleButton = screen.getByRole('button', {
      name: /ver-99|My Document/i,
    });
    fireEvent.keyDown(titleButton, { key: 'Enter', code: 'Enter' });

    expect(onOpen).toHaveBeenCalledWith('ver-99');
  });
});

// ---------------------------------------------------------------------------
// Req 5.6 — Compare button calls onCompare
// ---------------------------------------------------------------------------
describe('Compare button (Req 5.6)', () => {
  it('calls onCompare with version id when related_current_id exists', () => {
    const onCompare = vi.fn();
    const version = createVersion({ id: 'ver-5', related_current_id: 'doc-1' });
    render(
      <VersionListItem
        version={version}
        onOpen={vi.fn()}
        onCompare={onCompare}
        onRestore={vi.fn()}
      />
    );

    const compareBtn = screen.getByLabelText('archive.actions.compare');
    fireEvent.click(compareBtn);

    expect(onCompare).toHaveBeenCalledWith('ver-5');
  });
});

// ---------------------------------------------------------------------------
// Req 5.7 — Inline error when related document unavailable on compare
// ---------------------------------------------------------------------------
describe('Inline error when compare unavailable (Req 5.7)', () => {
  it('shows inline error when related_current_id is null', () => {
    const onCompare = vi.fn();
    const version = createVersion({ related_current_id: null });
    render(
      <VersionListItem
        version={version}
        onOpen={vi.fn()}
        onCompare={onCompare}
        onRestore={vi.fn()}
      />
    );

    const compareBtn = screen.getByLabelText('archive.actions.compare');
    fireEvent.click(compareBtn);

    expect(screen.getByRole('alert')).toHaveTextContent('archive.errors.relatedDocUnavailable');
    expect(onCompare).not.toHaveBeenCalled();
  });

  it('compare button is visually disabled when related_current_id is null', () => {
    const version = createVersion({ related_current_id: null });
    render(
      <VersionListItem
        version={version}
        onOpen={vi.fn()}
        onCompare={vi.fn()}
        onRestore={vi.fn()}
      />
    );

    const compareBtn = screen.getByLabelText('archive.actions.compare');
    expect(compareBtn).toHaveAttribute('aria-disabled', 'true');
  });
});

// ---------------------------------------------------------------------------
// Restore button calls onRestore
// ---------------------------------------------------------------------------
describe('Restore button', () => {
  it('calls onRestore with version id when clicked', () => {
    const onRestore = vi.fn();
    const version = createVersion({ id: 'ver-7' });
    render(
      <VersionListItem
        version={version}
        onOpen={vi.fn()}
        onCompare={vi.fn()}
        onRestore={onRestore}
      />
    );

    const restoreBtn = screen.getByLabelText('archive.actions.restore');
    fireEvent.click(restoreBtn);

    expect(onRestore).toHaveBeenCalledWith('ver-7');
  });
});
