/**
 * DocumentTitleBar - Displays the document title in the format:
 * "● {intentName} — WordAI" (dirty) or "{intentName} — WordAI" (clean)
 * "Untitled Intent — WordAI" when intentName is null
 *
 * NEVER displays file paths or path separators (/ or \)
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.6, 3.7
 */

interface DocumentTitleBarProps {
  intentName: string | null; // null → display "Untitled Intent"
  isDirty: boolean;          // true → display ● before name
  isSyncing: boolean;        // true → optional syncing indicator
}

export function DocumentTitleBar({ intentName, isDirty, isSyncing: _isSyncing }: DocumentTitleBarProps) {
  const displayName = intentName ?? 'Untitled Intent';
  const title = isDirty ? `● ${displayName} — WordAI` : `${displayName} — WordAI`;

  return (
    <div
      data-testid="document-title-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.875rem',
        fontWeight: 500,
        color: '#18181b',
        userSelect: 'none',
      }}
    >
      <span data-testid="document-title-text">{title}</span>
    </div>
  );
}
