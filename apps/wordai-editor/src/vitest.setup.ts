import '@testing-library/jest-dom';
import { vi } from 'vitest';
import './utils/reactInternals';

vi.mock('react-block-text', () => {
  const React = require('react') as typeof import('react');
  const noopPlugins = () => [];
  const MockEditor = ({
    value,
    onChange,
    onSave,
    style,
    'data-testid': dataTestId,
  }: {
    value?: string;
    onChange?: (val: string) => void;
    onSave?: () => void;
    style?: React.CSSProperties;
    'data-testid'?: string;
  }) => {
    const initialValue =
      typeof value === 'string' && !value.trim().startsWith('[{') ? value : '';
    const [text, setText] = React.useState(initialValue);
    const handleInput = (next: string) => {
      setText(next);
      onChange?.(next);
    };
    return React.createElement(
      'div',
      {
        role: 'textbox',
        'aria-label': 'Document editor',
        'data-testid': dataTestId ?? 'block-text-editor',
        contentEditable: true,
        suppressContentEditableWarning: true,
        style,
        onInput: (e: React.FormEvent<HTMLElement>) => handleInput((e.currentTarget as HTMLElement).innerText),
        onKeyUp: (e: React.KeyboardEvent<HTMLDivElement>) => handleInput((e.currentTarget as HTMLElement).innerText),
        onBlur: (e: React.FocusEvent<HTMLDivElement>) => handleInput((e.currentTarget as HTMLElement).innerText),
        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            onSave?.();
          }
        },
      },
      text
    );
  };

  return {
    default: MockEditor,
    headerPlugin: noopPlugins,
    listPlugin: noopPlugins,
    quotePlugin: noopPlugins,
    todoPlugin: noopPlugins,
    VERSION: 'test-version',
  };
});

// Ignore CSS parsing errors from third-party injected styles in jsdom
const originalUpdateStyleBlock = (HTMLStyleElement.prototype as unknown as { _updateAStyleBlock?: (...args: unknown[]) => unknown })._updateAStyleBlock;
if (originalUpdateStyleBlock) {
  (HTMLStyleElement.prototype as unknown as { _updateAStyleBlock?: (...args: unknown[]) => unknown })._updateAStyleBlock = function patchedUpdate(...args: unknown[]) {
    try {
      return originalUpdateStyleBlock.apply(this, args);
    } catch {
      return undefined;
    }
  };
}

const originalHeadAppend = document.head.appendChild.bind(document.head);
document.head.appendChild = ((node: Node) => {
  const element = node as HTMLElement;
  if (element?.tagName === 'STYLE') {
    // Skip parsing third-party injected styles that jsdom cannot handle
    return node;
  }
  return originalHeadAppend(node);
}) as typeof document.head.appendChild;
