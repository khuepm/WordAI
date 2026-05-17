/**
 * Unit tests for MemoryAccessToggle component
 * Requirements: 10.1–10.8, 14.6
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryAccessToggle } from './MemoryAccessToggle';

function renderToggle(overrides: {
  enabled?: boolean;
  isUpdating?: boolean;
  error?: string | null;
  onChange?: ReturnType<typeof vi.fn>;
} = {}) {
  const props = {
    enabled: overrides.enabled ?? true,
    isUpdating: overrides.isUpdating ?? false,
    error: overrides.error ?? null,
    onChange: overrides.onChange ?? vi.fn(),
  };
  render(<MemoryAccessToggle {...props} />);
  return props;
}

// ---------------------------------------------------------------------------
// Req 10.1 — Renders with role="switch" and correct aria-checked
// ---------------------------------------------------------------------------
describe('Toggle renders with correct ARIA attributes (Req 10.1)', () => {
  it('renders with role="switch"', () => {
    renderToggle();
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('has aria-checked="true" when enabled', () => {
    renderToggle({ enabled: true });
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('has aria-checked="false" when disabled', () => {
    renderToggle({ enabled: false });
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });
});

// ---------------------------------------------------------------------------
// Req 10.6 — Toggle operable via click
// ---------------------------------------------------------------------------
describe('Toggle operable via click (Req 10.6)', () => {
  it('calls onChange with false when enabled toggle is clicked', () => {
    const onChange = vi.fn();
    renderToggle({ enabled: true, onChange });

    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('calls onChange with true when disabled toggle is clicked', () => {
    const onChange = vi.fn();
    renderToggle({ enabled: false, onChange });

    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not call onChange when isUpdating is true', () => {
    const onChange = vi.fn();
    renderToggle({ enabled: true, isUpdating: true, onChange });

    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Req 10.6 — Toggle operable via Space key
// ---------------------------------------------------------------------------
describe('Toggle operable via Space key (Req 10.6)', () => {
  it('calls onChange when Space key is pressed', () => {
    const onChange = vi.fn();
    renderToggle({ enabled: true, onChange });

    fireEvent.keyDown(screen.getByRole('switch'), { key: ' ' });
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('does not call onChange on Space when isUpdating', () => {
    const onChange = vi.fn();
    renderToggle({ enabled: true, isUpdating: true, onChange });

    fireEvent.keyDown(screen.getByRole('switch'), { key: ' ' });
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Req 14.6 — Announces state via aria-live="polite"
// ---------------------------------------------------------------------------
describe('Screen reader announcement (Req 14.6)', () => {
  it('has an aria-live="polite" region', () => {
    renderToggle({ enabled: true });
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Req 10.7 — Displays inline error message on persistence failure
// ---------------------------------------------------------------------------
describe('Error display (Req 10.7)', () => {
  it('displays error message when error prop is provided', () => {
    renderToggle({ error: 'Failed to save memory access state.' });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Failed to save memory access state.')).toBeInTheDocument();
  });

  it('does not display error when error prop is null', () => {
    renderToggle({ error: null });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
