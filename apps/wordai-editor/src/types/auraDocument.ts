export type AuraInlineSpan =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'italic'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'bold_italic'; text: string };

export type AuraDocumentBlock =
  | { type: 'paragraph'; text: string; inline: AuraInlineSpan[] }
  | { type: 'heading'; level: number; text: string }
  | { type: 'list_item'; ordered: boolean; text: string; inline: AuraInlineSpan[] }
  | { type: 'code_block'; language?: string | null; code: string }
  | { type: 'placeholder'; element_type: string; raw_xml: string; display_hint: string };

export interface AuraIntentDocument {
  id: string;
  intent_name: string;
  content: AuraDocumentBlock[];
  version?: number | null;
  created_at?: number | null;
  updated_at?: number | null;
}

export interface AuraIntentSummary {
  id: string;
  intent_name: string;
  created_at: number;
  updated_at: number;
  version: number;
}

export interface AuraImportResult {
  document: AuraIntentDocument;
  aura_intent_id?: string | null;
  warnings: string[];
}

export interface AuraAdapterWarning {
  code: 'MALFORMED_CONTENT' | 'UNSUPPORTED_BLOCK' | 'UNSUPPORTED_INLINE';
  message: string;
}

export interface AuraAdapterResult<T> {
  value: T;
  warnings: AuraAdapterWarning[];
}
