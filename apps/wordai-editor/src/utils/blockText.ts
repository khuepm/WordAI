import { VERSION as RBT_VERSION } from 'react-block-text';

type BlockItem = {
  reactBlockTextVersion: string;
  id: string;
  type: string;
  data?: string;
  metadata?: string;
  indent?: number;
};

type DraftRaw = {
  blocks?: Array<{ text?: string; [key: string]: unknown }>;
  entityMap?: Record<string, unknown>;
};

const isArray = Array.isArray;

function safeParseJSON<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function createRawFromPlainText(text: string): DraftRaw {
  return {
    blocks: [
      {
        key: 'init',
        text,
        type: 'unstyled',
        depth: 0,
        inlineStyleRanges: [],
        entityRanges: [],
        data: {},
      },
    ],
    entityMap: {},
  };
}

function createId() {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `block-${Math.random().toString(36).slice(2, 10)}`;
}

export function isBlockTextValue(value: string): boolean {
  if (!value) return false;
  const parsed = safeParseJSON<unknown>(value);
  return isArray(parsed) && !!parsed[0] && typeof (parsed as BlockItem[])[0].reactBlockTextVersion === 'string';
}

export function blockTextValueFromPlainText(text: string): string {
  const raw = createRawFromPlainText(text);
  const item: BlockItem = {
    reactBlockTextVersion: RBT_VERSION,
    id: createId(),
    type: 'text',
    data: JSON.stringify(raw),
    metadata: JSON.stringify({}),
    indent: 0,
  };
  return JSON.stringify([item]);
}

export function extractPlainText(value: string): string {
  if (!value) return '';
  const parsed = safeParseJSON<unknown>(value);
  if (!isArray(parsed)) return value;

  const items = parsed as BlockItem[];
  const textParts: string[] = [];

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    if (typeof item.data === 'string') {
      const raw = safeParseJSON<DraftRaw>(item.data);
      if (raw?.blocks?.length) {
        textParts.push(raw.blocks.map((block) => block.text ?? '').join('\n'));
        continue;
      }
    }
    if (typeof (item as unknown as { data: string }).data === 'string') {
      textParts.push((item as unknown as { data: string }).data);
    }
  }

  return textParts.join('\n').trim();
}

export function ensureBlockValue(value: string): string {
  if (!value) return '';
  if (isBlockTextValue(value)) return value;
  return blockTextValueFromPlainText(value);
}

export function replaceTextInBlockValue(value: string, target: string, replacement: string): string {
  if (!target) return value;

  const parsed = safeParseJSON<unknown>(value);
  if (isArray(parsed)) {
    let replaced = false;
    const updatedItems = (parsed as BlockItem[]).map((item) => {
      if (replaced || !item || typeof item !== 'object') return item;
      const raw = typeof item.data === 'string' ? safeParseJSON<DraftRaw>(item.data) : null;
      if (!raw?.blocks) return item;

      const nextBlocks = raw.blocks.map((block) => {
        if (replaced || typeof block.text !== 'string') return block;
        const newText = block.text.replace(target, (match) => {
          if (replaced) return match;
          replaced = true;
          return replacement;
        });
        if (newText === block.text) return block;
        return { ...block, text: newText };
      });

      if (!replaced) return item;
      return {
        ...item,
        data: JSON.stringify({ ...raw, blocks: nextBlocks }),
      };
    });

    if (replaced) return JSON.stringify(updatedItems);
  }

  const plain = extractPlainText(value);
  const updatedPlain = plain.replace(target, replacement);
  return blockTextValueFromPlainText(updatedPlain);
}
