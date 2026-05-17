/**
 * Unit tests for PausedProjectCard component
 * Requirements: 6.2, 6.3, 6.5, 12.1, 12.8
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PausedProjectCard } from './PausedProjectCard';
import type { PausedProject } from '../types/archive';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? JSON.stringify(opts) : key,
  }),
}));

function createProject(overrides: Partial<PausedProject> = {}): PausedProject {
  return {
    id: 'proj-1',
    name: 'My Research Project',
    description: 'A collection of research documents about AI writing assistants.',
    document_count: 5,
    paused_at: Math.floor(Date.now() / 1000) - 172800, // 2 days ago
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Req 6.3 — Renders folder icon, project name, document count, description,
//            timestamp, and "Open Folder" link
// ---------------------------------------------------------------------------
describe('PausedProjectCard renders project metadata (Req 6.3)', () => {
  it('renders the folder icon', () => {
    render(<PausedProjectCard project={createProject()} onOpen={vi.fn()} />);
    expect(screen.getByText('folder')).toBeInTheDocument();
  });

  it('renders the project name', () => {
    render(<PausedProjectCard project={createProject({ name: 'Test Project' })} onOpen={vi.fn()} />);
    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  it('renders the document count', () => {
    render(<PausedProjectCard project={createProject({ document_count: 12 })} onOpen={vi.fn()} />);
    expect(screen.getByText('12 documents')).toBeInTheDocument();
  });

  it('renders singular "document" for count of 1', () => {
    render(<PausedProjectCard project={createProject({ document_count: 1 })} onOpen={vi.fn()} />);
    expect(screen.getByText('1 document')).toBeInTheDocument();
  });

  it('renders the description', () => {
    render(
      <PausedProjectCard
        project={createProject({ description: 'Some project description' })}
        onOpen={vi.fn()}
      />
    );
    expect(screen.getByText('Some project description')).toBeInTheDocument();
  });

  it('renders a relative timestamp', () => {
    const project = createProject({
      paused_at: Math.floor(Date.now() / 1000) - 172800, // 2 days ago
    });
    render(<PausedProjectCard project={project} onOpen={vi.fn()} />);
    expect(screen.getByText('2 days ago')).toBeInTheDocument();
  });

  it('renders the "Open Folder" action link', () => {
    render(<PausedProjectCard project={createProject()} onOpen={vi.fn()} />);
    expect(screen.getByLabelText('archive.actions.openFolder')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Req 6.3 — Project name truncated at 60 characters with ellipsis
// ---------------------------------------------------------------------------
describe('PausedProjectCard truncates name at 60 chars (Req 6.3)', () => {
  it('does not truncate names 60 chars or shorter', () => {
    const name = 'A'.repeat(60);
    render(<PausedProjectCard project={createProject({ name })} onOpen={vi.fn()} />);
    expect(screen.getByText(name)).toBeInTheDocument();
  });

  it('truncates names longer than 60 chars with ellipsis', () => {
    const name = 'B'.repeat(80);
    render(<PausedProjectCard project={createProject({ name })} onOpen={vi.fn()} />);
    const truncated = 'B'.repeat(60) + '…';
    expect(screen.getByText(truncated)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Req 6.4 — Clicking the card or "Open Folder" calls onOpen
// ---------------------------------------------------------------------------
describe('PausedProjectCard click behavior (Req 6.4)', () => {
  it('calls onOpen with project id when card is clicked', () => {
    const onOpen = vi.fn();
    render(<PausedProjectCard project={createProject({ id: 'proj-42' })} onOpen={onOpen} />);

    const card = screen.getByRole('article');
    fireEvent.click(card);

    expect(onOpen).toHaveBeenCalledWith('proj-42');
  });

  it('calls onOpen with project id when "Open Folder" button is clicked', () => {
    const onOpen = vi.fn();
    render(<PausedProjectCard project={createProject({ id: 'proj-99' })} onOpen={onOpen} />);

    const openBtn = screen.getByLabelText('archive.actions.openFolder');
    fireEvent.click(openBtn);

    expect(onOpen).toHaveBeenCalledWith('proj-99');
  });

  it('calls onOpen when Enter key is pressed on the card', () => {
    const onOpen = vi.fn();
    render(<PausedProjectCard project={createProject({ id: 'proj-7' })} onOpen={onOpen} />);

    const card = screen.getByRole('article');
    fireEvent.keyDown(card, { key: 'Enter', code: 'Enter' });

    expect(onOpen).toHaveBeenCalledWith('proj-7');
  });

  it('calls onOpen when Space key is pressed on the card', () => {
    const onOpen = vi.fn();
    render(<PausedProjectCard project={createProject({ id: 'proj-8' })} onOpen={onOpen} />);

    const card = screen.getByRole('article');
    fireEvent.keyDown(card, { key: ' ', code: 'Space' });

    expect(onOpen).toHaveBeenCalledWith('proj-8');
  });
});

// ---------------------------------------------------------------------------
// Req 6.5 — Decorative circle and card styling
// ---------------------------------------------------------------------------
describe('PausedProjectCard styling (Req 6.5)', () => {
  it('renders with surface-container-lowest background', () => {
    render(<PausedProjectCard project={createProject()} onOpen={vi.fn()} />);
    const card = screen.getByRole('article');
    expect(card.style.backgroundColor).toBe('var(--md-sys-color-surface-container-lowest)');
  });

  it('renders with rounded-xl border radius', () => {
    render(<PausedProjectCard project={createProject()} onOpen={vi.fn()} />);
    const card = screen.getByRole('article');
    expect(card.style.borderRadius).toBe('var(--radius-xl)');
  });

  it('renders with ambient shadow', () => {
    render(<PausedProjectCard project={createProject()} onOpen={vi.fn()} />);
    const card = screen.getByRole('article');
    expect(card.style.boxShadow).toBe('var(--shadow-ambient)');
  });
});
