/**
 * Unit tests for QuickSearchPopup component
 * Requirements: 1.3, 1.4, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.4
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickSearchPopup } from './QuickSearchPopup';
import type { SettingEntry } from '../types/preferences';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

function renderPopup(overrides: {
  isOpen?: boolean;
  onClose?: Mock;
  onSelect?: Mock;
} = {}) {
  const props = {
    isOpen: overrides.isOpen ?? true,
    onClose: overrides.onClose ?? vi.fn(),
    onSelect: overrides.onSelect ?? vi.fn(),
  };
  render(<QuickSearchPopup {...props} />);
  return props;
}

// ---------------------------------------------------------------------------
// Req 1.3 — Escape closes the popup
// ---------------------------------------------------------------------------
describe('Escape key closes the popup (Req 1.3)', () => {
  it('calls onClose when Escape is pressed inside the dialog', () => {
    const onClose = vi.fn();
    renderPopup({ onClose });

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Req 1.4 — Backdrop click closes the popup
// ---------------------------------------------------------------------------
describe('Backdrop click closes the popup (Req 1.4)', () => {
  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    renderPopup({ onClose });

    fireEvent.click(screen.getByTestId('quick-search-backdrop'));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does NOT call onClose when the dialog panel itself is clicked', () => {
    const onClose = vi.fn();
    renderPopup({ onClose });

    fireEvent.click(screen.getByRole('dialog'));

    expect(onClose).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Req 2.5 — "No settings found" when no matches
// ---------------------------------------------------------------------------
describe('"No settings found" message (Req 2.5)', () => {
  it('renders "No settings found" when query matches nothing', async () => {
    const user = userEvent.setup();
    renderPopup();

    const input = screen.getByRole('combobox');
    await user.type(input, 'zzzzzzzzz');

    expect(screen.getByText('No settings found')).toBeInTheDocument();
  });

  it('does NOT render "No settings found" when query matches entries', async () => {
    const user = userEvent.setup();
    renderPopup();

    const input = screen.getByRole('combobox');
    await user.type(input, 'theme');

    expect(screen.queryByText('No settings found')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Req 3.4 — Arrow key navigation moves highlight
// ---------------------------------------------------------------------------
describe('Arrow key navigation (Req 3.4)', () => {
  it('ArrowDown moves highlight to the second item', () => {
    renderPopup();

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'ArrowDown', code: 'ArrowDown' });

    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('ArrowUp does not go below index 0', () => {
    renderPopup();

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'ArrowUp', code: 'ArrowUp' });

    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('ArrowDown then ArrowUp returns to first item', () => {
    renderPopup();

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'ArrowDown', code: 'ArrowDown' });
    fireEvent.keyDown(dialog, { key: 'ArrowUp', code: 'ArrowUp' });

    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
  });
});

// ---------------------------------------------------------------------------
// Req 4.2 — Enter on highlighted item calls onSelect with correct entry
// ---------------------------------------------------------------------------
describe('Enter key selects highlighted item (Req 4.2)', () => {
  it('calls onSelect with the first entry when Enter is pressed with default highlight', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderPopup({ onSelect });

    // Type a query that narrows to a known entry
    const input = screen.getByRole('combobox');
    await user.type(input, 'theme');

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Enter', code: 'Enter' });

    expect(onSelect).toHaveBeenCalledOnce();
    const selected = onSelect.mock.calls[0][0] as SettingEntry;
    expect(selected.id).toBe('general.theme');
  });

  it('calls onSelect with the correct entry after ArrowDown navigation', () => {
    const onSelect = vi.fn();
    renderPopup({ onSelect });

    // Empty query shows all; navigate to second item
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'ArrowDown', code: 'ArrowDown' });
    fireEvent.keyDown(dialog, { key: 'Enter', code: 'Enter' });

    expect(onSelect).toHaveBeenCalledOnce();
    const selected = onSelect.mock.calls[0][0] as SettingEntry;
    // Second item in SETTING_REGISTRY is general.autoSave
    expect(selected.id).toBe('general.autoSave');
  });
});

// ---------------------------------------------------------------------------
// Req 4.1 — Click on result calls onSelect
// ---------------------------------------------------------------------------
describe('Click on result calls onSelect (Req 4.1)', () => {
  it('calls onSelect with the clicked entry', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderPopup({ onSelect });

    const input = screen.getByRole('combobox');
    await user.type(input, 'focus');

    const options = screen.getAllByRole('option');
    await user.click(options[0]);

    expect(onSelect).toHaveBeenCalledOnce();
    const selected = onSelect.mock.calls[0][0] as SettingEntry;
    expect(selected.id).toBe('general.focusMode');
  });
});

// ---------------------------------------------------------------------------
// Req 3.1, 3.2 — Results show label, description, and tab badge
// ---------------------------------------------------------------------------
describe('Result items display label, description, and tab badge (Req 3.1, 3.2)', () => {
  it('shows label and description for a matched entry', async () => {
    const user = userEvent.setup();
    renderPopup();

    const input = screen.getByRole('combobox');
    await user.type(input, 'theme');

    expect(screen.getByText('Theme')).toBeInTheDocument();
    expect(screen.getByText('Choose between light, dark, or system default appearance')).toBeInTheDocument();
  });

  it('shows the correct tab badge for a General entry', async () => {
    const user = userEvent.setup();
    renderPopup();

    const input = screen.getByRole('combobox');
    await user.type(input, 'theme');

    expect(screen.getByText('General')).toBeInTheDocument();
  });

  it('shows "AI Engine" badge for an ai-engine entry', async () => {
    const user = userEvent.setup();
    renderPopup();

    const input = screen.getByRole('combobox');
    await user.type(input, 'creativity');

    expect(screen.getByText('AI Engine')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Req 3.5 — First result is highlighted by default
// ---------------------------------------------------------------------------
describe('First result highlighted by default (Req 3.5)', () => {
  it('first option has aria-selected=true on open', () => {
    renderPopup();

    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
  });
});

// ---------------------------------------------------------------------------
// isOpen=false — renders nothing
// ---------------------------------------------------------------------------
describe('Returns null when isOpen is false', () => {
  it('renders nothing when isOpen is false', () => {
    renderPopup({ isOpen: false });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
