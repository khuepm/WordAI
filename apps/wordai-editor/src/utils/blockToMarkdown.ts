/**
 * blockToMarkdown — Chuyển đổi Block JSON (react-block-text) sang Markdown.
 *
 * Supported block types: header, paragraph, list, quote, todo, code.
 * Unsupported block types → fenced code block chứa JSON (lossy-safe).
 *
 * @param blockContent - JSON string chứa mảng block objects
 * @returns Markdown string tương ứng, không bao giờ throw
 */

interface ListItem {
  index?: number;
  text: string;
}

interface Block {
  type: string;
  text?: string;
  level?: number;
  items?: ListItem[];
  ordered?: boolean;
  checked?: boolean;
  language?: string;
  [key: string]: unknown;
}

export function blockToMarkdown(blockContent: string): string {
  if (!blockContent || blockContent.trim() === '') {
    return '';
  }

  let blocks: Block[];
  try {
    const parsed = JSON.parse(blockContent);
    if (!Array.isArray(parsed)) {
      return '';
    }
    blocks = parsed as Block[];
  } catch {
    return '';
  }

  if (blocks.length === 0) {
    return '';
  }

  let markdown = '';

  for (const block of blocks) {
    if (!block || typeof block !== 'object') {
      continue;
    }

    switch (block.type) {
      case 'header': {
        const level = Math.max(1, Math.min(6, block.level ?? 1));
        markdown += '#'.repeat(level) + ' ' + (block.text ?? '') + '\n\n';
        break;
      }

      case 'paragraph': {
        markdown += (block.text ?? '') + '\n\n';
        break;
      }

      case 'list': {
        const items = block.items ?? [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (block.ordered) {
            markdown += `${item.index ?? i + 1}. ${item.text ?? ''}\n`;
          } else {
            markdown += `- ${item.text ?? ''}\n`;
          }
        }
        markdown += '\n';
        break;
      }

      case 'quote': {
        markdown += '> ' + (block.text ?? '') + '\n\n';
        break;
      }

      case 'todo': {
        const checkbox = block.checked ? 'x' : ' ';
        markdown += `- [${checkbox}] ${block.text ?? ''}\n`;
        break;
      }

      case 'code': {
        const lang = block.language ?? '';
        markdown += '```' + lang + '\n' + (block.text ?? '') + '\n```\n\n';
        break;
      }

      default: {
        // Unsupported block type → fenced code block with language "json"
        markdown += '```json\n' + JSON.stringify(block) + '\n```\n\n';
        break;
      }
    }
  }

  return markdown.trimEnd();
}
