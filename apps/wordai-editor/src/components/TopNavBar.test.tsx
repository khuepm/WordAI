/**
 * Unit tests for TopNavBar component
 * Requirements: 17.1, 18.1, 19.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopNavBar } from './TopNavBar';

const defaultProps = {
  documentTitle: 'My Document',
  hasUnsavedChanges: false,
  onNew: vi.fn(),
  onSave: vi.fn(),
  onOpenPreferences: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TopNavBar - rendering', () => {
  it('renders the app title "WordAI"', () => {
    render(<TopNavBar {...defaultProps} />);
    expect(screen.getByTestId('app-title')).toHaveTextContent('WordAI');
  });

  it('renders the document title from props', () => {
    render(<TopNavBar {...defaultProps} documentTitle="My Test Doc" />);
    expect(screen.getByTestId('document-title')).toHaveTextContent('My Test Doc');
  });

  it('shows unsaved indicator "•" when hasUnsavedChanges=true', () => {
    render(<TopNavBar {...defaultProps} hasUnsavedChanges={true} />);
    expect(screen.getByTestId('unsaved-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('unsaved-indicator')).toHaveTextContent('•');
  });

  it('does NOT show "•" when hasUnsavedChanges=false', () => {
    render(<TopNavBar {...defaultProps} hasUnsavedChanges={false} />);
    expect(screen.queryByTestId('unsaved-indicator')).not.toBeInTheDocument();
  });
});

describe('TopNavBar - actions', () => {
  it('clicking "New" calls onNew', async () => {
    const onNew = vi.fn();
    const user = userEvent.setup();
    render(<TopNavBar {...defaultProps} onNew={onNew} />);
    await user.click(screen.getByTestId('new-button'));
    expect(onNew).toHaveBeenCalledOnce();
  });

  it('clicking "Save" calls onSave', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<TopNavBar {...defaultProps} onSave={onSave} />);
    await user.click(screen.getByTestId('save-button'));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('clicking settings opens preferences', async () => {
    const onOpenPreferences = vi.fn();
    const user = userEvent.setup();
    render(<TopNavBar {...defaultProps} onOpenPreferences={onOpenPreferences} />);
    await user.click(screen.getByTestId('settings-button'));
    expect(onOpenPreferences).toHaveBeenCalledOnce();
  });
});
