/**
 * Browser mock for @tauri-apps/api/webviewWindow
 * In browser dev mode, opens preferences in a new browser window/tab.
 */

export class WebviewWindow {
  constructor(_label: string, options?: { url?: string; title?: string; width?: number; height?: number; [key: string]: unknown }) {
    // In browser mode, open a new window/tab
    const url = options?.url ?? '';
    const width = options?.width ?? 900;
    const height = options?.height ?? 640;
    window.open(
      `/${url}`,
      _label,
      `width=${width},height=${height},resizable=yes,scrollbars=yes`
    );
  }

  static async getByLabel(_label: string): Promise<WebviewWindow | null> {
    // In browser mode, we can't easily track windows, so always return null
    // This means a new window will be opened each time (acceptable for dev)
    return null;
  }

  async setFocus(): Promise<void> {
    // no-op in browser
  }

  async close(): Promise<void> {
    // no-op in browser
  }

  once(_event: string, _handler: (e: unknown) => void): void {
    // no-op in browser
  }
}
