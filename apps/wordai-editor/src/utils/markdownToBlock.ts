/**
 * markdownToBlock — Converts a Markdown string into a JSON string (array of blocks)
 * compatible with the Prism editor's block format.
 *
 * Supported patterns:
 * - Headings: ^#{1,6}\s+(.+)$ → { type: 'header', level, text }
 * - Code blocks: ``` → { type: 'code', language, text }
 * - Quotes: ^> (.+)$ → { type: 'quote', text }
 * - Todos: ^- \[(x| )\]\s+(.+)$ → { type: 'todo', checked, text }
 * - Unordered lists: ^[-*]\s+(.+)$ → { type: 'list', ordered: false, items }
 * - Ordered lists: ^\d+\.\s+(.+)$ → { type: 'list', ordered: true, items }
 * - Non-empty lines (catch-all) → { type: 'paragraph', text }
 *
 * Empty lines are skipped (used as separators).
 * Empty input returns '[]'.
 *
 * @validates Requirements 4.5, 4.7
 */

export class ParseError extends Error {
  public readonly line: number;

  constructor(message: string, line: number) {
    super(message);
    this.name = 'ParseError';
    this.line = line;
  }
}

interface HeaderBlock {
  id: string;
  type: 'header';
  level: number;
  text: string;
}

interface ParagraphBlock {
  id: string;
  type: 'paragraph';
  text: string;
}

interface ListItem {
  index: number;
  text: string;
}

interface ListBlock {
  id: string;
  type: 'list';
  ordered: boolean;
  items: ListItem[];
}

interface QuoteBlock {
  id: string;
  type: 'quote';
  text: string;
}

interface TodoBlock {
  id: string;
  type: 'todo';
  checked: boolean;
  text: string;
}

interface CodeBlock {
  id: string;
  type: 'code';
  language: string;
  text: string;
}

type Block = HeaderBlock | ParagraphBlock | ListBlock | QuoteBlock | TodoBlock | CodeBlock;

function generateBlockId(): string {
  return crypto.randomUUID();
}

export function markdownToBlock(markdown: string): string {
  if (!markdown || !markdown.trim()) {
    return '[]';
  }

  const lines = markdown.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines (separators)
    if (!line.trim()) {
      i++;
      continue;
    }

    // Header detection: ^#{1,6}\s+(.+)$
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      blocks.push({
        id: generateBlockId(),
        type: 'header',
        level: headerMatch[1].length,
        text: headerMatch[2],
      });
      i++;
      continue;
    }

    // Code block: starts with ```
    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        id: generateBlockId(),
        type: 'code',
        language,
        text: codeLines.join('\n'),
      });
      i++; // skip closing ```
      continue;
    }

    // Quote: ^> (.+)$
    const quoteMatch = line.match(/^> (.+)$/);
    if (quoteMatch) {
      blocks.push({
        id: generateBlockId(),
        type: 'quote',
        text: quoteMatch[1],
      });
      i++;
      continue;
    }

    // Todo: ^- \[(x| )\]\s+(.+)$
    const todoMatch = line.match(/^- \[(x| )\]\s+(.+)$/);
    if (todoMatch) {
      blocks.push({
        id: generateBlockId(),
        type: 'todo',
        checked: todoMatch[1] === 'x',
        text: todoMatch[2],
      });
      i++;
      continue;
    }

    // Ordered list: ^\d+\.\s+(.+)$
    const olMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (olMatch) {
      const items: ListItem[] = [];
      while (i < lines.length) {
        const currentOl = lines[i].match(/^(\d+)\.\s+(.+)$/);
        if (currentOl) {
          items.push({ index: parseInt(currentOl[1], 10), text: currentOl[2] });
          i++;
        } else {
          break;
        }
      }
      blocks.push({
        id: generateBlockId(),
        type: 'list',
        ordered: true,
        items,
      });
      continue;
    }

    // Unordered list: ^[-*]\s+(.+)$
    const ulMatch = line.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      const items: ListItem[] = [];
      while (i < lines.length) {
        const currentUl = lines[i].match(/^[-*]\s+(.+)$/);
        if (currentUl) {
          items.push({ index: items.length + 1, text: currentUl[1] });
          i++;
        } else {
          break;
        }
      }
      blocks.push({
        id: generateBlockId(),
        type: 'list',
        ordered: false,
        items,
      });
      continue;
    }

    // Paragraph (catch-all for non-empty lines)
    blocks.push({
      id: generateBlockId(),
      type: 'paragraph',
      text: line,
    });
    i++;
  }

  return JSON.stringify(blocks);
}
