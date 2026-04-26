/**
 * Unit tests for DocumentTitleBar
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DocumentTitleBar } from './DocumentTitleBar';

describe('DocumentTitleBar', () => {
  // Test 3.1: displays correct format with intent name
  it('displays "{intentName} — WordAI" when intentName is provided and isDirty=false', () => {
    render(<DocumentTitleBar intentName="My Essay" isDirty={false} isSyncing={false} />);
    expect(screen.getByTestId('document-title-text').textContent).toBe('My Essay — WordAI');
  });

  // Test 3.2: displays "Untitled Intent — WordAI" when intentName is null
  it('displays "Untitled Intent — WordAI" when intentName is null', () => {
    render(<DocumentTitleBar intentName={null} isDirty={false} isSyncing={false} />);
    expect(screen.getByTestId('document-title-text').textContent).toBe('Untitled Intent — WordAI');
  });

  // Test 3.3: displays ● when isDirty=true
  it('displays "● {intentName} — WordAI" when isDirty=true', () => {
    render(<DocumentTitleBar intentName="My Essay" isDirty={true} isSyncing={false} />);
    expect(screen.getByTestId('document-title-text').textContent).toBe('● My Essay — WordAI');
  });

  // Test 3.4: does NOT display ● when isDirty=false
  it('does NOT display ● when isDirty=false', () => {
    render(<DocumentTitleBar intentName="My Essay" isDirty={false} isSyncing={false} />);
    const text = screen.getByTestId('document-title-text').textContent ?? '';
    expect(text).not.toContain('●');
  });

  // Test 3.2 + 3.3: "Untitled Intent" with dirty indicator
  it('displays "● Untitled Intent — WordAI" when intentName is null and isDirty=true', () => {
    render(<DocumentTitleBar intentName={null} isDirty={true} isSyncing={false} />);
    expect(screen.getByTestId('document-title-text').textContent).toBe('● Untitled Intent — WordAI');
  });

  // Test 3.7: never displays path separators
  it('never displays path separators (/ or \\) in the title', () => {
    render(<DocumentTitleBar intentName="Some Intent" isDirty={false} isSyncing={false} />);
    const text = screen.getByTestId('document-title-text').textContent ?? '';
    expect(text).not.toMatch(/[/\\]/);
  });
});
