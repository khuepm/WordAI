import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PreferencesDialog from './PreferencesDialog';
import { PreferencesProvider, defaultPreferences } from '../services/preferences';
import type { ReactNode } from 'react';

function renderWithProvider(ui: ReactNode) {
  return render(<PreferencesProvider>{ui}</PreferencesProvider>);
}

describe('PreferencesDialog', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('restores defaults only for the active tab', async () => {
    const user = userEvent.setup();
    renderWithProvider(<PreferencesDialog isOpen={true} onClose={() => {}} />);

    // change general tab values
    await user.selectOptions(screen.getByTestId('select-theme'), 'dark');
    await user.selectOptions(screen.getByTestId('select-language'), 'vi');

    // switch to editor tab and change values
    await user.click(screen.getByTestId('tab-editor'));
    await user.clear(screen.getByTestId('input-font-size'));
    await user.type(screen.getByTestId('input-font-size'), '24');
    await user.tab(); // blur to persist
    await user.click(screen.getByTestId('toggle-spellcheck'));

    // restore defaults for editor tab only
    await user.click(screen.getByTestId('restore-defaults'));

    // editor settings should be back to defaults
    expect(screen.getByTestId('input-font-size')).toHaveValue(defaultPreferences.editor.fontSize);
    expect((screen.getByTestId('toggle-spellcheck') as HTMLInputElement).checked).toBe(defaultPreferences.editor.spellCheck);

    // general settings should remain unchanged (dark / vi)
    await user.click(screen.getByTestId('tab-general'));
    expect(screen.getByTestId('select-theme')).toHaveValue('dark');
    expect(screen.getByTestId('select-language')).toHaveValue('vi');
  });

  it('persists settings locally across sessions', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProvider(<PreferencesDialog isOpen={true} onClose={() => {}} />);

    await user.selectOptions(screen.getByTestId('select-theme'), 'dark');
    await user.click(screen.getByTestId('tab-editor'));
    const fontInput = screen.getByTestId('input-font-size') as HTMLInputElement;
    await user.clear(fontInput);
    await user.type(fontInput, '22');
    await user.tab(); // blur to persist
    expect(fontInput).toHaveValue(22);

    const stored = JSON.parse(localStorage.getItem('wordai_preferences') || '{}');
    expect(stored.editor.fontSize).toBe(22);

    // unmount and re-mount
    unmount();
    renderWithProvider(<PreferencesDialog isOpen={true} onClose={() => {}} />);

    await user.click(screen.getByTestId('tab-general'));
    expect(screen.getByTestId('select-theme')).toHaveValue('dark');

    await user.click(screen.getByTestId('tab-editor'));
    expect(screen.getByTestId('input-font-size')).toHaveValue(22);
  });
});
