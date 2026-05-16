/**
 * PrismCodeView — Code editor hiển thị Markdown/OOXML/HTML/.aura với syntax highlighting.
 * Sử dụng CodeMirror 6. Lazy loaded — chỉ mount khi user mở Code view.
 *
 * Requirements: 3.2, 3.3, 3.4, 3.5
 */

import { useRef, useEffect, useCallback } from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState, type Extension } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { html } from '@codemirror/lang-html';
import { json } from '@codemirror/lang-json';
import type { PrismCodeSubTab } from './types';

export interface PrismCodeViewProps {
  content: string;
  subTab: PrismCodeSubTab;
  readonly: boolean;
  onChange: (content: string) => void;
  fontSize?: number;
}

/**
 * Returns the appropriate CodeMirror language extension for the given sub-tab.
 * For XML/OOXML, we use @codemirror/lang-html (closest available).
 */
function getLanguageExtension(subTab: PrismCodeSubTab): Extension {
  switch (subTab) {
    case 'markdown':
      return markdown();
    case 'html':
      return html();
    case 'ooxml':
      // Use HTML mode for XML/OOXML (closest available)
      return html();
    case 'aura':
      return json();
    default:
      return markdown();
  }
}

/**
 * Determines if the editor should be readonly based on the subTab and explicit readonly prop.
 * OOXML and .aura sub-tabs are always readonly (Req 3.2).
 */
function isEffectivelyReadonly(subTab: PrismCodeSubTab, readonly: boolean): boolean {
  return readonly || subTab === 'ooxml' || subTab === 'aura';
}

/**
 * PrismCodeView renders a CodeMirror 6 editor with:
 * - Language mode based on subTab (markdown/html/json)
 * - Readonly enforcement for ooxml and aura sub-tabs
 * - Debounced onChange (500ms) for editable content
 * - External content sync without triggering onChange
 * - Cleanup on unmount
 */
export function PrismCodeView({
  content,
  subTab,
  readonly,
  onChange,
  fontSize = 14,
}: PrismCodeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isExternalUpdateRef = useRef(false);
  const onChangeRef = useRef(onChange);

  // Keep onChange ref up to date without re-creating the editor
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Debounced change handler (Req 3.3: emit onChange with 500ms debounce)
  const handleDocChange = useCallback((newContent: string) => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      onChangeRef.current(newContent);
      debounceTimerRef.current = null;
    }, 500);
  }, []);

  // Create/recreate EditorView when subTab or readonly changes
  useEffect(() => {
    if (!containerRef.current) return;

    const effectiveReadonly = isEffectivelyReadonly(subTab, readonly);

    const extensions: Extension[] = [
      getLanguageExtension(subTab),
      EditorView.editable.of(!effectiveReadonly),
      EditorState.readOnly.of(effectiveReadonly),
      EditorView.theme({
        '&': {
          height: '100%',
          fontSize: `${fontSize}px`,
        },
        '.cm-content': {
          fontFamily: 'var(--font-family-mono, "JetBrains Mono", "Fira Code", monospace)',
          padding: '1rem',
        },
        '.cm-gutters': {
          backgroundColor: 'var(--md-sys-color-surface-container-low, #f5f5f5)',
          borderRight: '1px solid var(--md-sys-color-outline-variant, #e0e0e0)',
        },
        '.cm-scroller': {
          overflow: 'auto',
        },
      }),
      EditorView.lineWrapping,
    ];

    // Add update listener only for editable mode
    if (!effectiveReadonly) {
      extensions.push(
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isExternalUpdateRef.current) {
            const newContent = update.state.doc.toString();
            handleDocChange(newContent);
          }
        })
      );
    }

    // Add basic keymap for indentation
    extensions.push(keymap.of([]));

    const state = EditorState.create({
      doc: content,
      extensions,
    });

    // Destroy previous view if exists
    if (viewRef.current) {
      viewRef.current.destroy();
    }

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    // Cleanup on unmount or re-creation
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      view.destroy();
      viewRef.current = null;
    };
  }, [subTab, readonly, fontSize, handleDocChange]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update content when the content prop changes externally (without triggering onChange)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentContent = view.state.doc.toString();
    if (currentContent === content) return;

    // Mark as external update to prevent onChange from firing
    isExternalUpdateRef.current = true;
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: content,
      },
    });
    isExternalUpdateRef.current = false;
  }, [content]);

  return (
    <div
      ref={containerRef}
      className="prism-code-view"
      style={styles.container}
      data-subtab={subTab}
      data-readonly={isEffectivelyReadonly(subTab, readonly)}
      role="textbox"
      aria-label={`Code editor: ${subTab}`}
      aria-readonly={isEffectivelyReadonly(subTab, readonly)}
    />
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100%',
    width: '100%',
    overflow: 'hidden',
    backgroundColor: 'var(--md-sys-color-surface, #ffffff)',
  },
};

export default PrismCodeView;
