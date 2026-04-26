/// <reference types="vite/client" />

declare module "*.json" {
  const content: Record<string, unknown>;
  export default content;
}
