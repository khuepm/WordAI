import type { AuraAdapterResult, AuraAdapterWarning, AuraDocumentBlock, AuraInlineSpan, AuraIntentDocument } from '../types/auraDocument';
import type { Document, DocumentMetadata } from '../types/document';
import { blockTextValueFromPlainText, extractPlainText, isBlockTextValue } from '../utils/blockText';

type DraftRawBlock = {
  text?: string;
  type?: string;
  depth?: number;
  inlineStyleRanges?: Array<{ offset: number; length: number; style: string }>;
};

type DraftRaw = {
  blocks?: DraftRawBlock[];
};

type BlockTextItem = {
  type?: string;
  data?: string;
};

function safeParseJSON<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function timestampFromDate(date: Date | string | number | null | undefined): number | null {
  if (date == null) return null;
  if (typeof date === 'number') return Number.isFinite(date) ? date : null;
  const parsed = new Date(date).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function dateFromTimestamp(timestamp: number | null | undefined): Date {
  if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
    return new Date(timestamp);
  }
  return new Date();
}

function textSpans(text: string): AuraInlineSpan[] {
  return text ? [{ kind: 'text', text }] : [];
}

function metadataFromText(text: string): DocumentMetadata {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return {
    wordCount,
    readingTime: Math.ceil(wordCount / 200),
    status: 'draft',
    tags: [],
  };
}

function inlineKindFromStyles(styles: Set<string>): AuraInlineSpan['kind'] {
  if (styles.has('CODE')) return 'code';
  if (styles.has('BOLD') && styles.has('ITALIC')) return 'bold_italic';
  if (styles.has('BOLD')) return 'bold';
  if (styles.has('ITALIC')) return 'italic';
  return 'text';
}

function spansFromDraftInline(text: string, ranges: DraftRawBlock['inlineStyleRanges']): AuraInlineSpan[] {
  if (!ranges?.length) return textSpans(text);

  const validRanges = [...ranges]
    .filter((range) => range.length > 0 && range.offset >= 0 && range.offset < text.length)
    .map((range) => ({
      ...range,
      style: range.style.toUpperCase(),
      end: Math.min(text.length, range.offset + range.length),
    }));

  if (validRanges.length === 0) return textSpans(text);

  const kinds: AuraInlineSpan['kind'][] = [];
  for (let index = 0; index < text.length; index += 1) {
    const styles = new Set<string>();
    for (const range of validRanges) {
      if (index >= range.offset && index < range.end) styles.add(range.style);
    }
    kinds[index] = inlineKindFromStyles(styles);
  }

  const spans: AuraInlineSpan[] = [];
  let currentKind = kinds[0] ?? 'text';
  let currentText = '';
  for (let index = 0; index < text.length; index += 1) {
    const kind = kinds[index] ?? 'text';
    if (kind !== currentKind && currentText) {
      spans.push({ kind: currentKind, text: currentText } as AuraInlineSpan);
      currentText = '';
      currentKind = kind;
    }
    currentText += text[index];
  }

  if (currentText) spans.push({ kind: currentKind, text: currentText } as AuraInlineSpan);

  return spans.length > 0 ? spans : textSpans(text);
}

function blockFromDraftBlock(block: DraftRawBlock, itemType?: string): AuraDocumentBlock {
  const text = block.text ?? '';
  const blockType = (block.type || itemType || 'unstyled').toLowerCase();

  if (blockType.includes('header') || blockType.includes('heading')) {
    const level = blockType.includes('one') || blockType.endsWith('1')
      ? 1
      : blockType.includes('two') || blockType.endsWith('2')
        ? 2
        : blockType.includes('three') || blockType.endsWith('3')
          ? 3
          : 2;
    return { type: 'heading', level, text };
  }

  if (blockType.includes('ordered-list')) {
    return { type: 'list_item', ordered: true, text, inline: spansFromDraftInline(text, block.inlineStyleRanges) };
  }

  if (blockType.includes('unordered-list') || blockType.includes('list')) {
    return { type: 'list_item', ordered: false, text, inline: spansFromDraftInline(text, block.inlineStyleRanges) };
  }

  if (blockType.includes('code')) {
    return { type: 'code_block', language: null, code: text };
  }

  return { type: 'paragraph', text, inline: spansFromDraftInline(text, block.inlineStyleRanges) };
}

function blocksFromBlockText(value: string, warnings: AuraAdapterWarning[]): AuraDocumentBlock[] | null {
  if (!isBlockTextValue(value)) return null;
  const items = safeParseJSON<BlockTextItem[]>(value);
  if (!items) {
    warnings.push({ code: 'MALFORMED_CONTENT', message: 'Cannot parse block editor JSON.' });
    return null;
  }

  const blocks: AuraDocumentBlock[] = [];
  for (const item of items) {
    if (typeof item.data !== 'string') continue;
    const raw = safeParseJSON<DraftRaw>(item.data);
    if (!raw?.blocks?.length) {
      warnings.push({ code: 'MALFORMED_CONTENT', message: 'Cannot parse block editor item JSON.' });
      const text = extractPlainText(item.data);
      if (text) blocks.push({ type: 'paragraph', text, inline: textSpans(text) });
      continue;
    }
    for (const rawBlock of raw.blocks) {
      blocks.push(blockFromDraftBlock(rawBlock, item.type));
    }
  }

  return blocks;
}

function blocksFromMarkdownishText(text: string): AuraDocumentBlock[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: AuraDocumentBlock[] = [];
  let paragraph: string[] = [];
  let codeFence: { language: string | null; lines: string[] } | null = null;

  const flushParagraph = () => {
    const value = paragraph.join('\n').trim();
    if (value) blocks.push({ type: 'paragraph', text: value, inline: textSpans(value) });
    paragraph = [];
  };

  for (const line of lines) {
    const fenceMatch = line.match(/^```([A-Za-z0-9_-]+)?\s*$/);
    if (fenceMatch) {
      if (codeFence) {
        blocks.push({ type: 'code_block', language: codeFence.language, code: codeFence.lines.join('\n') });
        codeFence = null;
      } else {
        flushParagraph();
        codeFence = { language: fenceMatch[1] ?? null, lines: [] };
      }
      continue;
    }

    if (codeFence) {
      codeFence.lines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      blocks.push({ type: 'list_item', ordered: false, text: unordered[1], inline: textSpans(unordered[1]) });
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      blocks.push({ type: 'list_item', ordered: true, text: ordered[1], inline: textSpans(ordered[1]) });
      continue;
    }

    paragraph.push(line);
  }

  if (codeFence) {
    blocks.push({ type: 'code_block', language: codeFence.language, code: codeFence.lines.join('\n') });
  }
  flushParagraph();

  if (blocks.length === 0) {
    blocks.push({ type: 'paragraph', text: '', inline: [] });
  }

  return blocks;
}

function blockText(block: AuraDocumentBlock): string {
  switch (block.type) {
    case 'heading':
      return block.text;
    case 'paragraph':
      return block.text || block.inline.map((span) => span.text).join('');
    case 'list_item':
      return block.text || block.inline.map((span) => span.text).join('');
    case 'code_block':
      return block.code;
    case 'placeholder':
      return block.display_hint;
  }
}

export function documentToAuraIntent(document: Document): AuraAdapterResult<AuraIntentDocument> {
  const warnings: AuraAdapterWarning[] = [];
  const blockTextBlocks = blocksFromBlockText(document.content, warnings);
  const content = blockTextBlocks ?? blocksFromMarkdownishText(extractPlainText(document.content));
  const updatedAt = timestampFromDate(document.lastModified);

  return {
    value: {
      id: document.id,
      intent_name: document.title || 'Untitled Intent',
      content,
      version: document.version,
      created_at: null,
      updated_at: updatedAt,
    },
    warnings,
  };
}

export function auraIntentToDocument(intent: AuraIntentDocument): AuraAdapterResult<Document> {
  const warnings: AuraAdapterWarning[] = [];
  const plainText = computeAuraPlainText(intent);

  return {
    value: {
      id: intent.id,
      title: intent.intent_name || 'Untitled Intent',
      content: blockTextValueFromPlainText(plainText),
      metadata: metadataFromText(plainText),
      version: intent.version ?? 1,
      lastModified: dateFromTimestamp(intent.updated_at ?? intent.created_at),
    },
    warnings,
  };
}

export function computeAuraPlainText(intent: AuraIntentDocument): string {
  return intent.content.map(blockText).join('\n').trim();
}
