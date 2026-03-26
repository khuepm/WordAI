/**
 * IPC command and response types for Tauri bridge
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5
 */

export type IPCCommand =
  | 'save_document'
  | 'load_document'
  | 'create_document'
  | 'request_ai_suggestion'
  | 'send_chat_message'
  | 'export_to_pdf'
  | 'get_version_history'
  | 'check_ai_service_health';

export interface IPCResponse<T> {
  success: boolean;
  data?: T;
  error?: IPCError;
}

export interface IPCError {
  code: string;
  message: string;
}
