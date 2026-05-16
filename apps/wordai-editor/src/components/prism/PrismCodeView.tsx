/**
 * PrismCodeView — Code editor hiển thị Markdown/OOXML/HTML/.aura với syntax highlighting.
 * Sử dụng CodeMirror 6. Lazy loaded — chỉ mount khi user mở Code view.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 10.1, 10.2, 10.3
 */

import { useRef, useEffect, useCallback, useState } from 'react';
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
  /** Error message from markdownToBlock parse failure. null = no error. */
  parseError?: string | null;
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
  parseError = null,
}: PrismCodeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isExternalUpdateRef = useRef(false);
  const onChangeRef = useRef(onChange);

  // Scroll position preservation per sub-tab (Req 3.6)
  const scrollPositionsRef = useRef<Record<string, number>>({});
  const prevSubTabRef = useRef<PrismCodeSubTab>(subTab);

  // Error banner state: tracks visibility and dismissal animation
  const [bannerVisible, setBannerVisible] = useState(!!parseError);
  const [bannerMessage, setBannerMessage] = useState<string | null>(parseError ?? null);
  const bannerHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle parseError transitions (Req 10.1, 10.3)
  useEffect(() => {
    if (bannerHideTimerRef.current !== null) {
      clearTimeout(bannerHideTimerRef.current);
      bannerHideTimerRef.current = null;
    }

    if (parseError) {
      // Show banner immediately when there's an error
      setBannerMessage(parseError);
      setBannerVisible(true);
    } else if (bannerMessage !== null) {
      // Parse succeeded after a failure — animate out over 300ms
      setBannerVisible(false);
      bannerHideTimerRef.current = setTimeout(() => {
        setBannerMessage(null);
        bannerHideTimerRef.current = null;
      }, 300);
    }

    return () => {
      if (bannerHideTimerRef.current !== null) {
        clearTimeout(bannerHideTimerRef.current);
        bannerHideTimerRef.current = null;
      }
    };
  }, [parseError]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Save scroll position for the previous sub-tab before editor recreation (Req 3.6)
  useEffect(() => {
    if (prevSubTabRef.current !== subTab && viewRef.current) {
      const scrollDOM = viewRef.current.scrollDOM;
      scrollPositionsRef.current[prevSubTabRef.current] = scrollDOM.scrollTop;
    }
    prevSubTabRef.current = subTab;
  }, [subTab]);

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

    // Restore scroll position for the current sub-tab (Req 3.6)
    const savedScrollTop = scrollPositionsRef.current[subTab];
    if (savedScrollTop !== undefined && savedScrollTop > 0) {
      // Use requestAnimationFrame to ensure the DOM has rendered
      requestAnimationFrame(() => {
        view.scrollDOM.scrollTop = savedScrollTop;
      });
    }

    // Cleanup on unmount or re-creation
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      // Save scroll position before destroying (for unmount case)
      const scrollDOM = view.scrollDOM;
      scrollPositionsRef.current[subTab] = scrollDOM.scrollTop;
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
    <div className="prism-code-view-wrapper" style={styles.wrapper}>
      {/* Error banner (Req 10.1, 10.3) */}
      {bannerMessage !== null && (
        <div
          role="alert"
          aria-live="polite"
          className="prism-code-view-error-banner"
          style={{
            ...styles.errorBanner,
            opacity: bannerVisible ? 1 : 0,
            maxHeight: bannerVisible ? '4rem' : '0',
            padding: bannerVisible ? '0.5rem 0.75rem' : '0 0.75rem',
            transition: 'opacity 300ms ease, max-height 300ms ease, padding 300ms ease',
          }}
        >
          <span style={styles.errorIcon} aria-hidden="true">⚠️</span>
          <span style={styles.errorText}>
            Lỗi cú pháp Markdown: {bannerMessage}. Preview giữ nguyên nội dung trước đó.
          </span>
        </div>
      )}
      {/* CodeMirror container */}
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
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    overflow: 'hidden',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: 'var(--md-sys-color-error-container, #fdecea)',
    borderBottom: '1px solid var(--md-sys-color-error, #d32f2f)',
    overflow: 'hidden',
  },
  errorIcon: {
    flexShrink: 0,
    fontSize: '1rem',
  },
  errorText: {
    fontFamily: 'var(--font-family-ui, system-ui, sans-serif)',
    fontSize: '0.8rem',
    color: 'var(--md-sys-color-on-error-container, #5f2120)',
    lineHeight: 1.4,
  },
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: 'var(--md-sys-color-surface, #ffffff)',
  },
};

export default PrismCodeView;
