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
    // DocumentTitleBar renders the title in data-testid="document-title-text"
    expect(screen.getByTestId('document-title-text')).toHaveTextContent('My Test Doc');
  });

  it('shows dirty indicator "●" when isDirty=true', () => {
    render(<TopNavBar {...defaultProps} isDirty={true} />);
    // DocumentTitleBar shows ● prefix when isDirty
    const titleText = screen.getByTestId('document-title-text').textContent ?? '';
    expect(titleText).toContain('●');
  });

  it('does NOT show "●" when isDirty=false', () => {
    render(<TopNavBar {...defaultProps} isDirty={false} />);
    const titleText = screen.getByTestId('document-title-text').textContent ?? '';
    expect(titleText).not.toContain('●');
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
});
