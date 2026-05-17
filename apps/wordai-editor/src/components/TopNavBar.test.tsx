/**
 * Unit tests for TopNavBar component
 * Requirements: 7.6, 7.7, 8.1, 17.1, 18.1, 19.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopNavBar } from './TopNavBar';
import { AuthStateProvider } from '../services/authStore';
import type { ReactNode } from 'react';

function Wrapper({ children }: { children: ReactNode }) {
  return <AuthStateProvider>{children}</AuthStateProvider>;
}

function renderWithAuth(ui: React.ReactElement) {
  return render(ui, { wrapper: Wrapper });
}

const defaultProps = {
  documentTitle: 'My Document',
  hasUnsavedChanges: false,
  onNew: vi.fn(),
  onSave: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TopNavBar - rendering', () => {
  it('renders the app title "WordAI"', () => {
    renderWithAuth(<TopNavBar {...defaultProps} />);
    expect(screen.getByTestId('app-title')).toHaveTextContent('WordAI');
  });

  it('renders the document title from props', () => {
    renderWithAuth(<TopNavBar {...defaultProps} documentTitle="My Test Doc" />);
    // DocumentTitleBar renders the title in data-testid="document-title-text"
    expect(screen.getByTestId('document-title-text')).toHaveTextContent('My Test Doc');
  });

  it('shows dirty indicator "●" when isDirty=true', () => {
    renderWithAuth(<TopNavBar {...defaultProps} isDirty={true} />);
    // DocumentTitleBar shows ● prefix when isDirty
    const titleText = screen.getByTestId('document-title-text').textContent ?? '';
    expect(titleText).toContain('●');
  });

  it('does NOT show "●" when isDirty=false', () => {
    renderWithAuth(<TopNavBar {...defaultProps} isDirty={false} />);
    const titleText = screen.getByTestId('document-title-text').textContent ?? '';
    expect(titleText).not.toContain('●');
  });
});

describe('TopNavBar - actions', () => {
  it('clicking "New" calls onNew', async () => {
    const onNew = vi.fn();
    const user = userEvent.setup();
    renderWithAuth(<TopNavBar {...defaultProps} onNew={onNew} />);
    await user.click(screen.getByTestId('new-button'));
    expect(onNew).toHaveBeenCalledOnce();
  });

  it('clicking "Save" calls onSave', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    renderWithAuth(<TopNavBar {...defaultProps} onSave={onSave} />);
    await user.click(screen.getByTestId('save-button'));
    expect(onSave).toHaveBeenCalledOnce();
  });
});

describe('TopNavBar - tab switching (Requirements 1.3, 1.4)', () => {
  it('activeTab="editor" applies active style to "Drafts" and inactive style to "Library"', () => {
    renderWithAuth(<TopNavBar {...defaultProps} activeTab="editor" />);

    const draftsBtn = screen.getByTestId('nav-drafts');
    const libraryBtn = screen.getByTestId('nav-library');

    // Active style: fontWeight 600, primary color, solid border-bottom with primary color
    expect(draftsBtn).toHaveStyle({ fontWeight: 600 });
    expect(draftsBtn).toHaveStyle({ color: 'var(--md-sys-color-primary)' });
    expect(draftsBtn.style.borderBottom).toBe('2px solid var(--md-sys-color-primary)');

    // Inactive style: fontWeight 400, #5a5a5a, transparent border-bottom
    expect(libraryBtn).toHaveStyle({ fontWeight: 400 });
    expect(libraryBtn).toHaveStyle({ color: '#5a5a5a' });
    expect(libraryBtn.style.borderBottom).toBe('2px solid transparent');
  });

  it('activeTab="library" applies active style to "Library" and inactive style to "Drafts"', () => {
    renderWithAuth(<TopNavBar {...defaultProps} activeTab="library" />);

    const draftsBtn = screen.getByTestId('nav-drafts');
    const libraryBtn = screen.getByTestId('nav-library');

    // Library active
    expect(libraryBtn).toHaveStyle({ fontWeight: 600 });
    expect(libraryBtn).toHaveStyle({ color: 'var(--md-sys-color-primary)' });
    expect(libraryBtn.style.borderBottom).toBe('2px solid var(--md-sys-color-primary)');

    // Drafts inactive
    expect(draftsBtn).toHaveStyle({ fontWeight: 400 });
    expect(draftsBtn).toHaveStyle({ color: '#5a5a5a' });
    expect(draftsBtn.style.borderBottom).toBe('2px solid transparent');
  });

  it('clicking "Library" calls onTabChange with "library"', async () => {
    const onTabChange = vi.fn();
    const user = userEvent.setup();
    renderWithAuth(<TopNavBar {...defaultProps} activeTab="editor" onTabChange={onTabChange} />);

    await user.click(screen.getByTestId('nav-library'));
    expect(onTabChange).toHaveBeenCalledOnce();
    expect(onTabChange).toHaveBeenCalledWith('library');
  });

  it('clicking "Drafts" calls onTabChange with "editor"', async () => {
    const onTabChange = vi.fn();
    const user = userEvent.setup();
    renderWithAuth(<TopNavBar {...defaultProps} activeTab="library" onTabChange={onTabChange} />);

    await user.click(screen.getByTestId('nav-drafts'));
    expect(onTabChange).toHaveBeenCalledOnce();
    expect(onTabChange).toHaveBeenCalledWith('editor');
  });
});
