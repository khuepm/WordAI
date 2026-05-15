import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  exportDocx,
  exportMarkdown,
  exportPdf,
  importFile,
} from "./exportService";
import { syncDocument } from "./auraBrainManager";
import type {
  AuraIntentDocument,
  AuraImportResult,
} from "../types/auraDocument";
import type { Document } from "../types/document";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock("./preferencesService", () => ({
  loadPreferences: vi.fn().mockResolvedValue({
    general: { defaultExportPath: "/exports" },
  }),
}));

vi.mock("./auraBrainManager", () => ({
  syncDocument: vi.fn().mockResolvedValue({ success: true }),
}));

const mockInvoke = vi.mocked(invoke);
const mockOpen = vi.mocked(open);
const mockSave = vi.mocked(save);
const mockSyncDocument = vi.mocked(syncDocument);
let randomUUIDSpy: ReturnType<typeof vi.spyOn>;
const NEW_IMPORT_ID = "00000000-0000-4000-8000-000000000001";

function makeDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: "doc-1",
    title: "Export Test",
    content: "# Title\n\nBody",
    metadata: { wordCount: 2, readingTime: 1, status: "draft", tags: [] },
    version: 1,
    lastModified: new Date("2026-04-25T00:00:00.000Z"),
    ...overrides,
  };
}

function makeAuraDocument(
  overrides: Partial<AuraIntentDocument> = {},
): AuraIntentDocument {
  return {
    id: "intent-1",
    intent_name: "Imported Intent",
    content: [
      {
        type: "paragraph",
        text: "Imported text",
        inline: [{ kind: "text", text: "Imported text" }],
      },
    ],
    version: 1,
    created_at: Date.parse("2026-04-24T00:00:00.000Z"),
    updated_at: Date.parse("2026-04-25T00:00:00.000Z"),
    ...overrides,
  };
}

describe("exportService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    randomUUIDSpy = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue(NEW_IMPORT_ID);
  });

  afterEach(() => {
    randomUUIDSpy.mockRestore();
  });

  it("exports Markdown with AuraDocument payload and appends extension", async () => {
    mockSave.mockResolvedValueOnce("/tmp/exported");
    mockInvoke.mockResolvedValueOnce(undefined);

    const result = await exportMarkdown(makeDocument());

    expect(result).toEqual({ status: "success", path: "/tmp/exported.md" });
    expect(mockSave).toHaveBeenCalledWith({
      defaultPath: "/exports/Export Test.md",
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    expect(mockInvoke).toHaveBeenCalledWith("export_markdown", {
      path: "/tmp/exported.md",
      document: expect.objectContaining({
        id: "doc-1",
        intent_name: "Export Test",
        content: expect.any(Array),
      }),
    });
  });

  it("returns cancelled when Markdown save dialog is cancelled", async () => {
    mockSave.mockResolvedValueOnce(null);

    await expect(exportMarkdown(makeDocument())).resolves.toEqual({
      status: "cancelled",
    });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("exports DOCX with extension and structured result", async () => {
    mockSave.mockResolvedValueOnce("/tmp/exported.docx");
    mockInvoke.mockResolvedValueOnce(undefined);

    const result = await exportDocx(makeDocument());

    expect(result).toEqual({ status: "success", path: "/tmp/exported.docx" });
    expect(mockInvoke).toHaveBeenCalledWith("export_docx", {
      path: "/tmp/exported.docx",
      document: expect.objectContaining({ intent_name: "Export Test" }),
    });
  });

  it("exports PDF with save dialog and flattened options payload", async () => {
    mockSave.mockResolvedValueOnce("/tmp/exported");
    mockInvoke.mockResolvedValueOnce(undefined);

    const pdfOptions = {
      pageSize: "A4" as const,
      margins: { top: 20, bottom: 20, left: 25, right: 25 },
      fontSize: 14,
    };
    const result = await exportPdf(makeDocument(), pdfOptions);

    expect(result).toEqual({ status: "success", path: "/tmp/exported.pdf" });
    expect(mockSave).toHaveBeenCalledWith({
      defaultPath: "/exports/Export Test.pdf",
      filters: [{ name: "PDF Document", extensions: ["pdf"] }],
    });
    expect(mockInvoke).toHaveBeenCalledWith("export_to_pdf", {
      content: "# Title\n\nBody",
      outputPath: "/tmp/exported.pdf",
      options: {
        page_size: "A4",
        margin_top: 20,
        margin_bottom: 20,
        margin_left: 25,
        margin_right: 25,
        font_size: 14,
      },
    });
  });

  it("returns cancelled when PDF save dialog is cancelled", async () => {
    mockSave.mockResolvedValueOnce(null);

    const result = await exportPdf(makeDocument(), {
      pageSize: "A4",
      margins: { top: 25, bottom: 25, left: 25, right: 25 },
      fontSize: 12,
    });

    expect(result).toEqual({ status: "cancelled" });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("returns error when PDF IPC command throws", async () => {
    mockSave.mockResolvedValueOnce("/tmp/out.pdf");
    mockInvoke.mockRejectedValueOnce(new Error("render failed"));

    const result = await exportPdf(makeDocument(), {
      pageSize: "Letter",
      margins: { top: 25, bottom: 25, left: 25, right: 25 },
      fontSize: 12,
    });

    expect(result).toEqual({ status: "error", message: "render failed" });
  });

  it("returns export errors without changing AuraBrain state", async () => {
    mockSave.mockResolvedValueOnce("/tmp/exported.md");
    mockInvoke.mockRejectedValueOnce(new Error("disk full"));

    const result = await exportMarkdown(makeDocument());

    expect(result).toEqual({ status: "error", message: "disk full" });
    expect(mockSyncDocument).not.toHaveBeenCalled();
  });

  it("imports a file without Aura tag as a new AuraBrain intent", async () => {
    const importResult: AuraImportResult = {
      document: makeAuraDocument({ id: "source-id" }),
      aura_intent_id: null,
      warnings: ["table"],
    };
    mockOpen.mockResolvedValueOnce("/tmp/import.md");
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "get_file_size") return 1024 * 1024; // 1MB — small file, no warning
      if (cmd === "import_file") return importResult;
      return null;
    });

    const onOpenIntent = vi.fn();
    const result = await importFile({ onOpenIntent });

    expect(result.status).toBe("opened");
    expect(mockSyncDocument).toHaveBeenCalledWith(
      expect.objectContaining({ id: NEW_IMPORT_ID }),
      "import",
    );
    expect(onOpenIntent).toHaveBeenCalledWith(
      expect.objectContaining({ id: NEW_IMPORT_ID }),
    );
  });

  it("updates an existing intent when imported Aura tag conflicts and user chooses update", async () => {
    const importResult: AuraImportResult = {
      document: makeAuraDocument({ id: "imported-copy" }),
      aura_intent_id: "intent-1",
      warnings: [],
    };
    mockOpen.mockResolvedValueOnce("/tmp/import.md");
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "get_file_size") return 1024 * 1024; // 1MB
      if (cmd === "import_file") return importResult;
      if (cmd === "get_intent")
        return makeAuraDocument({
          id: "intent-1",
          intent_name: "Existing Intent",
        });
      return null;
    });

    const onConflict = vi.fn().mockResolvedValue("update");
    const onOpenIntent = vi.fn();
    const result = await importFile({ onConflict, onOpenIntent });

    expect(result.status).toBe("opened");
    expect(onConflict).toHaveBeenCalledWith("Existing Intent", "intent-1");
    expect(mockSyncDocument).toHaveBeenCalledWith(
      expect.objectContaining({ id: "intent-1" }),
      "import",
    );
    expect(onOpenIntent).toHaveBeenCalledWith(
      expect.objectContaining({ id: "intent-1" }),
    );
  });

  it("creates a new intent when imported Aura tag conflicts and user chooses create new", async () => {
    const importResult: AuraImportResult = {
      document: makeAuraDocument({ id: "imported-copy" }),
      aura_intent_id: "intent-1",
      warnings: [],
    };
    mockOpen.mockResolvedValueOnce("/tmp/import.md");
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "get_file_size") return 1024 * 1024; // 1MB
      if (cmd === "import_file") return importResult;
      if (cmd === "get_intent")
        return makeAuraDocument({
          id: "intent-1",
          intent_name: "Existing Intent",
        });
      return null;
    });

    const result = await importFile({
      onConflict: vi.fn().mockResolvedValue("create_new"),
    });

    expect(result.status).toBe("opened");
    expect(mockSyncDocument).toHaveBeenCalledWith(
      expect.objectContaining({ id: NEW_IMPORT_ID }),
      "import",
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // File Size Validation (Requirements 25.1 – 25.7)
  // ─────────────────────────────────────────────────────────────────────────

  describe("file size validation", () => {
    it("rejects file > 100MB and does not call import_file (Req 25.3)", async () => {
      mockOpen.mockResolvedValueOnce("/tmp/huge.docx");
      // 150MB in bytes
      mockInvoke.mockImplementation(async (cmd) => {
        if (cmd === "get_file_size") return 150 * 1024 * 1024;
        return null;
      });

      const result = await importFile();

      expect(result.status).toBe("error");
      if (result.status === "error") {
        expect(result.message).toContain("100 MB");
      }
      // import_file should never be called
      expect(mockInvoke).not.toHaveBeenCalledWith(
        "import_file",
        expect.anything(),
      );
    });

    it("shows warning dialog for file between 20-100MB (Req 25.2)", async () => {
      const importResult: AuraImportResult = {
        document: makeAuraDocument(),
        aura_intent_id: null,
        warnings: [],
      };
      mockOpen.mockResolvedValueOnce("/tmp/medium.docx");
      mockInvoke.mockImplementation(async (cmd) => {
        if (cmd === "get_file_size") return 50 * 1024 * 1024; // 50MB
        if (cmd === "import_file") return importResult;
        return null;
      });

      const onFileSizeWarning = vi.fn().mockResolvedValue(true);
      await importFile({ onFileSizeWarning });

      expect(onFileSizeWarning).toHaveBeenCalledWith(
        expect.closeTo(50, 0.1), // fileSizeMB ≈ 50
        Math.ceil(50 / 5), // estimatedSeconds = 10
      );
    });

    it("does not call import_file when user cancels warning dialog (Req 25.4)", async () => {
      mockOpen.mockResolvedValueOnce("/tmp/medium.docx");
      mockInvoke.mockImplementation(async (cmd) => {
        if (cmd === "get_file_size") return 50 * 1024 * 1024; // 50MB
        return null;
      });

      const onFileSizeWarning = vi.fn().mockResolvedValue(false);
      const result = await importFile({ onFileSizeWarning });

      expect(result.status).toBe("cancelled");
      expect(mockInvoke).not.toHaveBeenCalledWith(
        "import_file",
        expect.anything(),
      );
    });

    it("calls import_file when user confirms warning dialog (Req 25.2)", async () => {
      const importResult: AuraImportResult = {
        document: makeAuraDocument(),
        aura_intent_id: null,
        warnings: [],
      };
      mockOpen.mockResolvedValueOnce("/tmp/medium.md");
      mockInvoke.mockImplementation(async (cmd) => {
        if (cmd === "get_file_size") return 50 * 1024 * 1024; // 50MB
        if (cmd === "import_file") return importResult;
        return null;
      });

      const onFileSizeWarning = vi.fn().mockResolvedValue(true);
      const result = await importFile({ onFileSizeWarning });

      expect(result.status).toBe("opened");
      expect(mockInvoke).toHaveBeenCalledWith("import_file", { path: "/tmp/medium.md" });
    });

    it("does not show warning for file < 20MB (Req 25.1)", async () => {
      const importResult: AuraImportResult = {
        document: makeAuraDocument(),
        aura_intent_id: null,
        warnings: [],
      };
      mockOpen.mockResolvedValueOnce("/tmp/small.md");
      mockInvoke.mockImplementation(async (cmd) => {
        if (cmd === "get_file_size") return 5 * 1024 * 1024; // 5MB
        if (cmd === "import_file") return importResult;
        return null;
      });

      const onFileSizeWarning = vi.fn();
      const result = await importFile({ onFileSizeWarning });

      expect(result.status).toBe("opened");
      expect(onFileSizeWarning).not.toHaveBeenCalled();
    });
  });
});
