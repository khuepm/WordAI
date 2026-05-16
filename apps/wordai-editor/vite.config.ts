import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { resolve } from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
// @ts-expect-error process is a nodejs global
const isTauri = !!process.env.TAURI_DEV_HOST || !!process.env.TAURI_ENV_TARGET_TRIPLE;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: isTauri
      ? {}
      : {
          // When running in browser (pnpm dev without Tauri), use mock
          "@tauri-apps/api/core": path.resolve(__dirname, "src/mocks/tauri.ts"),
          "@tauri-apps/api/webviewWindow": path.resolve(__dirname, "src/mocks/tauriWebviewWindow.ts"),
          "@tauri-apps/api/window": path.resolve(__dirname, "src/mocks/tauriWindow.ts"),
          "@tauri-apps/api/event": path.resolve(__dirname, "src/mocks/tauriEvent.ts"),
        },
  },

  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        preferences: resolve(__dirname, "preferences.html"),
        devdashboard: resolve(__dirname, "devdashboard.html"),
      },
    },
  },

  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/vitest.setup.ts"],
  },

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
