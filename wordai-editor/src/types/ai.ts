/**
 * AI-related types for WordAI Text Editor
 * Requirements: 6.3, 6.4, 7.1, 7.2, 23.1
 */

export interface AISuggestion {
  id: string;
  suggestedText: string;
  explanation: string;
  confidenceScore: number; // 0.0 - 1.0
  originalText: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AIRequest {
  documentId: string;
  selectedText?: string;
  context: string; // surrounding paragraph/sentence
  chatHistory?: ChatMessage[];
  prompt?: string;
}
