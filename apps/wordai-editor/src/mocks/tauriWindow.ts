/**
 * Browser mock for @tauri-apps/api/window
 * Used when running `pnpm dev` outside of Tauri webview.
 */

export function getCurrentWindow() {
  return {
    async close() {
      window.close();
    },
    async setFocus() {
      window.focus();
    },
    async setTitle(_title: string) {
      document.title = _title;
    },
  };
}
