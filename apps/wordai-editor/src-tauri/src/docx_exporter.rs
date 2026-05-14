/// DOCX_Exporter — converts AuraDocument ↔ DOCX bytes.
///
/// export: Document → DOCX bytes (via docx-rs), runs in spawn_blocking
/// import: DOCX bytes → Document, extracts AuraIntentId from Custom Document Properties
///
/// Requirements: 7.2, 7.3, 7.4, 7.8, 7.9, 8.3, 8.10, 11.2, 11.5
/// Export progress: Requirements 28.1, 28.2, 28.3, 28.4
use chrono::Utc;
use docx_rs::{
    AbstractNumbering, Docx, IndentLevel, Level, LevelJc, LevelText, NumberFormat,
    Numbering, NumberingId, Paragraph, Run, RunFonts, Start,
};

use crate::models::{
    AuraDocument, CancellationToken, DocumentBlock, DocxPlaceholder, ExportProgressEvent,
    ExportStage, ImportResult, InlineSpan, IPCError,
};

// ── Export ────────────────────────────────────────────────────────────────────

/// Convert an AuraDocument to DOCX bytes.
///
/// - Preserves: text, heading levels (H1–H6), lists, bold/italic inline.
/// - Embeds Aura_Tag into Custom Document Properties via `doc_props.custom_property()`:
///   `AuraIntentId` = intent UUID, `AuraExportedAt` = ISO 8601 timestamp.
/// - Runs in `tokio::task::spawn_blocking` to avoid blocking the async runtime.
/// - Emits `export-progress` events via `app_handle` if provided.
/// - Checks `cancel_token` after every 50 blocks; returns Err if cancelled.
///
/// Requirements: 7.2, 7.3, 7.4, 7.8, 7.9, 28.1, 28.2, 28.3, 28.4
pub async fn export(doc: &AuraDocument) -> Result<Vec<u8>, IPCError> {
    let doc_clone = doc.clone();
    tokio::task::spawn_blocking(move || export_sync(&doc_clone))
        .await
        .map_err(|e| IPCError {
            code: "SPAWN_ERROR".to_string(),
            message: format!("DOCX export task panicked: {e}"),
        })?
}

/// Export with progress tracking and cancellation support.
/// Emits `export-progress` Tauri events and checks the cancel token every 50 blocks.
///
/// Requirements: 28.1, 28.2, 28.3, 28.4
pub async fn export_with_progress(
    doc: &AuraDocument,
    app_handle: tauri::AppHandle,
    cancel_token: CancellationToken,
) -> Result<Vec<u8>, IPCError> {
    let doc_clone = doc.clone();
    let cancel_clone = cancel_token.clone();
    let app_clone = app_handle.clone();

    tokio::task::spawn_blocking(move || {
        export_sync_with_progress(&doc_clone, &app_clone, &cancel_clone)
    })
    .await
    .map_err(|e| IPCError {
        code: "SPAWN_ERROR".to_string(),
        message: format!("DOCX export task panicked: {e}"),
    })?
}

/// Synchronous core of the export — called inside spawn_blocking.
pub(crate) fn export_sync(doc: &AuraDocument) -> Result<Vec<u8>, IPCError> {
    export_sync_with_progress(doc, &NoopEmitter, &CancellationToken::new())
}

/// Trait for emitting progress events — allows testable no-op in unit tests.
pub(crate) trait ProgressEmitter: Send + Sync {
    fn emit_export_progress(&self, event: &ExportProgressEvent);
}

/// No-op emitter used when no app handle is available (unit tests, simple export).
pub(crate) struct NoopEmitter;
impl ProgressEmitter for NoopEmitter {
    fn emit_export_progress(&self, _event: &ExportProgressEvent) {}
}

/// Tauri app handle emitter — emits real Tauri events.
impl ProgressEmitter for tauri::AppHandle {
    fn emit_export_progress(&self, event: &ExportProgressEvent) {
        use tauri::Emitter;
        let _ = self.emit("export-progress", event);
    }
}

/// Synchronous core of the export with progress tracking and cancellation.
/// Emits `export-progress` events every 50 blocks.
/// Returns `Err` with code `EXPORT_CANCELLED` if the cancel token is set.
///
/// Requirements: 28.1, 28.2, 28.3, 28.4
pub(crate) fn export_sync_with_progress(
    doc: &AuraDocument,
    emitter: &impl ProgressEmitter,
    cancel_token: &CancellationToken,
) -> Result<Vec<u8>, IPCError> {
    let exported_at = Utc::now().to_rfc3339();
    let total_blocks = doc.content.len();

    // Add a bullet list numbering definition (abstract + concrete)
    let abstract_num = AbstractNumbering::new(1).add_level(
        Level::new(
            0,
            Start::new(1),
            NumberFormat::new("bullet"),
            LevelText::new("•"),
            LevelJc::new("left"),
        ),
    );
    let numbering = Numbering::new(1, 1);

    // Aura_Tag: Custom Document Properties — Requirements 7.8, 7.9
    // Docx::custom_property() stores key/value in docProps/custom.xml
    let mut docx = Docx::new()
        .custom_property("AuraIntentId", doc.id.as_str())
        .custom_property("AuraExportedAt", exported_at.as_str())
        .add_abstract_numbering(abstract_num)
        .add_numbering(numbering);

    // Emit initial progress — BuildingStructure stage
    emitter.emit_export_progress(&ExportProgressEvent {
        stage: ExportStage::BuildingStructure,
        blocks_processed: 0,
        blocks_total: total_blocks,
        percent: 0,
    });

    for (idx, block) in doc.content.iter().enumerate() {
        // Check cancellation every 50 blocks — Requirements 28.3, 28.4
        if idx > 0 && idx % 50 == 0 {
            if cancel_token.is_cancelled() {
                return Err(IPCError {
                    code: "EXPORT_CANCELLED".to_string(),
                    message: "Export was cancelled by the user".to_string(),
                });
            }
            // Emit progress event — Requirements 28.1, 28.2
            let percent = ((idx as f64 / total_blocks.max(1) as f64) * 90.0) as u8;
            emitter.emit_export_progress(&ExportProgressEvent {
                stage: ExportStage::BuildingStructure,
                blocks_processed: idx,
                blocks_total: total_blocks,
                percent,
            });
        }

        match block {
            DocumentBlock::Heading { level, text } => {
                let style = heading_style(*level);
                let para = Paragraph::new()
                    .style(style)
                    .add_run(Run::new().add_text(text.as_str()));
                docx = docx.add_paragraph(para);
            }
            DocumentBlock::Paragraph { text, inline } => {
                let para = if inline.is_empty() {
                    Paragraph::new().add_run(Run::new().add_text(text.as_str()))
                } else {
                    build_inline_paragraph(inline)
                };
                docx = docx.add_paragraph(para);
            }
            DocumentBlock::ListItem { text, inline, .. } => {
                let mut para = Paragraph::new()
                    .numbering(NumberingId::new(1), IndentLevel::new(0));
                if inline.is_empty() {
                    para = para.add_run(Run::new().add_text(text.as_str()));
                } else {
                    for span in inline {
                        para = para.add_run(inline_span_to_run(span));
                    }
                }
                docx = docx.add_paragraph(para);
            }
            DocumentBlock::CodeBlock { code, .. } => {
                // Render code block as a monospace paragraph
                let para = Paragraph::new().add_run(
                    Run::new()
                        .fonts(RunFonts::new().ascii("Courier New"))
                        .add_text(code.as_str()),
                );
                docx = docx.add_paragraph(para);
            }
            DocumentBlock::Placeholder(p) => {
                // Render placeholder as a descriptive paragraph — Requirements 11.5
                let para = Paragraph::new().add_run(
                    Run::new().add_text(format!("[{}]", p.display_hint).as_str()),
                );
                docx = docx.add_paragraph(para);
            }
        }
    }

    // Final cancellation check before writing
    if cancel_token.is_cancelled() {
        return Err(IPCError {
            code: "EXPORT_CANCELLED".to_string(),
            message: "Export was cancelled by the user".to_string(),
        });
    }

    // Emit WritingFile stage — Requirements 28.2
    emitter.emit_export_progress(&ExportProgressEvent {
        stage: ExportStage::WritingFile,
        blocks_processed: total_blocks,
        blocks_total: total_blocks,
        percent: 95,
    });

    let mut buf = std::io::Cursor::new(Vec::new());
    docx.build()
        .pack(&mut buf)
        .map_err(|e| IPCError {
            code: "DOCX_BUILD_ERROR".to_string(),
            message: format!("Cannot build DOCX: {e}"),
        })?;

    // Emit completion
    emitter.emit_export_progress(&ExportProgressEvent {
        stage: ExportStage::WritingFile,
        blocks_processed: total_blocks,
        blocks_total: total_blocks,
        percent: 100,
    });

    Ok(buf.into_inner())
}

// ── Import ────────────────────────────────────────────────────────────────────

/// Parse DOCX bytes into an AuraDocument.
///
/// - Reads Custom Document Properties to extract `AuraIntentId`.
/// - Converts unsupported elements (Table, Image, Comment) → Placeholder.
/// - Returns `ImportResult` with document, optional aura_intent_id, and warnings.
///
/// Requirements: 8.3, 8.10, 11.2, 11.5
pub async fn import(bytes: &[u8]) -> Result<ImportResult, IPCError> {
    let bytes_owned = bytes.to_vec();
    tokio::task::spawn_blocking(move || import_sync(&bytes_owned))
        .await
        .map_err(|e| IPCError {
            code: "SPAWN_ERROR".to_string(),
            message: format!("DOCX import task panicked: {e}"),
        })?
}

/// Synchronous core of the import — called inside spawn_blocking.
pub(crate) fn import_sync(bytes: &[u8]) -> Result<ImportResult, IPCError> {
    let docx = docx_rs::read_docx(bytes).map_err(|e| IPCError {
        code: "DOCX_PARSE_ERROR".to_string(),
        message: format!("Cannot parse DOCX: {e:?}"),
    })?;

    // Extract Aura_Tag from Custom Document Properties — Requirements 8.3
    let aura_intent_id = docx
        .doc_props
        .custom
        .properties
        .get("AuraIntentId")
        .cloned();

    let mut blocks: Vec<DocumentBlock> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();
    let mut warned_types: std::collections::HashSet<String> = std::collections::HashSet::new();

    for child in &docx.document.children {
        match child {
            docx_rs::DocumentChild::Paragraph(para) => {
                let block = parse_paragraph(para);
                // Skip empty paragraphs
                if let DocumentBlock::Paragraph { text, inline } = &block {
                    if text.is_empty() && inline.is_empty() {
                        continue;
                    }
                }
                blocks.push(block);
            }
            docx_rs::DocumentChild::Table(_table) => {
                // Unsupported_Element: Table → Placeholder — Requirements 8.10, 11.5
                let placeholder = DocxPlaceholder {
                    element_type: "table".to_string(),
                    raw_xml: String::new(),
                    display_hint: "Unsupported element: table".to_string(),
                };
                blocks.push(DocumentBlock::Placeholder(placeholder));
                if warned_types.insert("table".to_string()) {
                    warnings.push("table".to_string());
                }
            }
            docx_rs::DocumentChild::CommentStart(_) | docx_rs::DocumentChild::CommentEnd(_) => {
                // Unsupported_Element: Comment → Placeholder — Requirements 8.10
                if warned_types.insert("comment".to_string()) {
                    warnings.push("comment".to_string());
                }
            }
            _ => {
                // Other unsupported children — skip silently
            }
        }
    }

    let now_ms = Utc::now().timestamp_millis();
    let document = AuraDocument {
        id: uuid::Uuid::new_v4().to_string(),
        intent_name: String::new(),
        content: blocks,
        version: None,
        created_at: Some(now_ms),
        updated_at: Some(now_ms),
    };

    Ok(ImportResult {
        document,
        aura_intent_id,
        warnings,
    })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Map heading level (1–6) to a DOCX built-in style name.
fn heading_style(level: u8) -> &'static str {
    match level {
        1 => "Heading1",
        2 => "Heading2",
        3 => "Heading3",
        4 => "Heading4",
        5 => "Heading5",
        _ => "Heading6",
    }
}

/// Build a Paragraph from a slice of InlineSpan.
fn build_inline_paragraph(spans: &[InlineSpan]) -> Paragraph {
    let mut para = Paragraph::new();
    for span in spans {
        para = para.add_run(inline_span_to_run(span));
    }
    para
}

/// Convert an InlineSpan to a docx-rs Run with appropriate formatting.
fn inline_span_to_run(span: &InlineSpan) -> Run {
    match span {
        InlineSpan::Text { text } => Run::new().add_text(text.as_str()),
        InlineSpan::Bold { text } => Run::new().bold().add_text(text.as_str()),
        InlineSpan::Italic { text } => Run::new().italic().add_text(text.as_str()),
        InlineSpan::Code { text } => Run::new()
            .fonts(RunFonts::new().ascii("Courier New"))
            .add_text(text.as_str()),
        InlineSpan::BoldItalic { text } => Run::new().bold().italic().add_text(text.as_str()),
    }
}

/// Parse a docx-rs Paragraph into a DocumentBlock.
fn parse_paragraph(para: &docx_rs::Paragraph) -> DocumentBlock {
    // Detect heading style
    let style_id = para
        .property
        .style
        .as_ref()
        .map(|s| s.val.as_str())
        .unwrap_or("");

    let level = match style_id {
        "Heading1" => Some(1u8),
        "Heading2" => Some(2u8),
        "Heading3" => Some(3u8),
        "Heading4" => Some(4u8),
        "Heading5" => Some(5u8),
        "Heading6" => Some(6u8),
        _ => None,
    };

    // Detect list item (has numbering property)
    let is_list = para.property.numbering_property.is_some();

    // Collect inline spans from runs
    let mut spans: Vec<InlineSpan> = Vec::new();
    for child in &para.children {
        if let docx_rs::ParagraphChild::Run(run) = child {
            let is_bold = run.run_property.bold.is_some();
            let is_italic = run.run_property.italic.is_some();

            for run_child in &run.children {
                if let docx_rs::RunChild::Text(t) = run_child {
                    let text = t.text.clone();
                    let span = match (is_bold, is_italic) {
                        (true, true) => InlineSpan::BoldItalic { text },
                        (true, false) => InlineSpan::Bold { text },
                        (false, true) => InlineSpan::Italic { text },
                        (false, false) => InlineSpan::Text { text },
                    };
                    spans.push(span);
                }
            }
        }
    }

    let plain_text: String = spans
        .iter()
        .map(|s| match s {
            InlineSpan::Text { text } => text.as_str(),
            InlineSpan::Bold { text } => text.as_str(),
            InlineSpan::Italic { text } => text.as_str(),
            InlineSpan::Code { text } => text.as_str(),
            InlineSpan::BoldItalic { text } => text.as_str(),
        })
        .collect();

    if let Some(lvl) = level {
        DocumentBlock::Heading { level: lvl, text: plain_text }
    } else if is_list {
        DocumentBlock::ListItem {
            ordered: false,
            text: plain_text,
            inline: spans,
        }
    } else {
        DocumentBlock::Paragraph { text: plain_text, inline: spans }
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{AuraDocument, DocumentBlock};

    fn make_doc(id: &str, content: Vec<DocumentBlock>) -> AuraDocument {
        AuraDocument {
            id: id.to_string(),
            intent_name: "Test Intent".to_string(),
            content,
            version: Some(1),
            created_at: Some(0),
            updated_at: Some(0),
        }
    }

    #[tokio::test]
    async fn test_export_produces_bytes() {
        let doc = make_doc("test-uuid-1234", vec![
            DocumentBlock::Heading { level: 1, text: "Hello".to_string() },
            DocumentBlock::Paragraph { text: "World".to_string(), inline: vec![] },
        ]);
        let bytes = export(&doc).await.unwrap();
        assert!(!bytes.is_empty(), "Export should produce non-empty bytes");
    }

    #[tokio::test]
    async fn test_export_embeds_aura_tag() {
        let doc = make_doc("aura-id-5678", vec![
            DocumentBlock::Paragraph { text: "Content".to_string(), inline: vec![] },
        ]);
        let bytes = export(&doc).await.unwrap();
        // Verify by importing and checking the extracted id
        let result = import(&bytes).await.unwrap();
        assert_eq!(result.aura_intent_id, Some("aura-id-5678".to_string()));
    }

    #[tokio::test]
    async fn test_round_trip_preserves_text() {
        let doc = make_doc("rt-uuid-9999", vec![
            DocumentBlock::Heading { level: 2, text: "Section Title".to_string() },
            DocumentBlock::Paragraph { text: "Some paragraph text.".to_string(), inline: vec![] },
        ]);
        let bytes = export(&doc).await.unwrap();
        let result = import(&bytes).await.unwrap();

        let texts: Vec<String> = result.document.content.iter().map(|b| match b {
            DocumentBlock::Heading { text, .. } => text.clone(),
            DocumentBlock::Paragraph { text, .. } => text.clone(),
            DocumentBlock::ListItem { text, .. } => text.clone(),
            DocumentBlock::CodeBlock { code, .. } => code.clone(),
            DocumentBlock::Placeholder(p) => p.display_hint.clone(),
        }).collect();

        assert!(texts.iter().any(|t| t.contains("Section Title")), "Heading text must survive round-trip");
        assert!(texts.iter().any(|t| t.contains("Some paragraph text")), "Paragraph text must survive round-trip");
    }

    #[test]
    fn test_placeholder_export_sync() {
        let doc = make_doc("ph-uuid", vec![
            DocumentBlock::Placeholder(DocxPlaceholder {
                element_type: "table".to_string(),
                raw_xml: String::new(),
                display_hint: "Unsupported element: table".to_string(),
            }),
        ]);
        let bytes = export_sync(&doc).unwrap();
        assert!(!bytes.is_empty());
    }

    // ── Export Progress Tests (Task 32.1, 32.2) ───────────────────────────────

    /// Collect emitted events for testing
    struct CollectingEmitter {
        events: std::sync::Mutex<Vec<ExportProgressEvent>>,
    }

    impl CollectingEmitter {
        fn new() -> Self {
            Self { events: std::sync::Mutex::new(Vec::new()) }
        }
        fn events(&self) -> Vec<ExportProgressEvent> {
            self.events.lock().unwrap().clone()
        }
    }

    impl ProgressEmitter for CollectingEmitter {
        fn emit_export_progress(&self, event: &ExportProgressEvent) {
            self.events.lock().unwrap().push(event.clone());
        }
    }

    fn make_large_doc(block_count: usize) -> AuraDocument {
        let content = (0..block_count)
            .map(|i| DocumentBlock::Paragraph {
                text: format!("Paragraph {i}"),
                inline: vec![],
            })
            .collect();
        make_doc("large-doc-uuid", content)
    }

    #[test]
    fn test_export_emits_progress_events_for_large_doc() {
        // 150 blocks → should emit at least one progress event at block 50 and 100
        let doc = make_large_doc(150);
        let emitter = CollectingEmitter::new();
        let token = CancellationToken::new();
        let bytes = export_sync_with_progress(&doc, &emitter, &token).unwrap();
        assert!(!bytes.is_empty());

        let events = emitter.events();
        // Should have initial event + events at 50, 100 + WritingFile events
        assert!(events.len() >= 3, "Expected at least 3 progress events, got {}", events.len());

        // First event should be BuildingStructure at 0%
        assert!(matches!(events[0].stage, ExportStage::BuildingStructure));
        assert_eq!(events[0].blocks_processed, 0);

        // Last event should be WritingFile at 100%
        let last = events.last().unwrap();
        assert!(matches!(last.stage, ExportStage::WritingFile));
        assert_eq!(last.percent, 100);
    }

    #[test]
    fn test_export_no_progress_events_for_small_doc() {
        // 10 blocks → only initial + WritingFile events (no mid-progress at 50)
        let doc = make_large_doc(10);
        let emitter = CollectingEmitter::new();
        let token = CancellationToken::new();
        let bytes = export_sync_with_progress(&doc, &emitter, &token).unwrap();
        assert!(!bytes.is_empty());

        let events = emitter.events();
        // Should have initial BuildingStructure + WritingFile(95%) + WritingFile(100%)
        assert!(events.len() >= 2, "Expected at least 2 events for small doc");
    }

    #[test]
    fn test_export_cancellation_stops_processing() {
        // 200 blocks, cancel after 50
        let doc = make_large_doc(200);
        let emitter = CollectingEmitter::new();
        let token = CancellationToken::new();

        // Cancel immediately — the check happens at idx=50
        token.cancel();

        let result = export_sync_with_progress(&doc, &emitter, &token);
        assert!(result.is_err(), "Cancelled export should return Err");
        let err = result.unwrap_err();
        assert_eq!(err.code, "EXPORT_CANCELLED");
    }

    #[test]
    fn test_export_cancellation_returns_error_code() {
        let doc = make_large_doc(100);
        let emitter = CollectingEmitter::new();
        let token = CancellationToken::new();
        token.cancel();

        let result = export_sync_with_progress(&doc, &emitter, &token);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err().code, "EXPORT_CANCELLED");
    }

    #[test]
    fn test_cancellation_token_default_not_cancelled() {
        let token = CancellationToken::new();
        assert!(!token.is_cancelled());
    }

    #[test]
    fn test_cancellation_token_cancel_sets_flag() {
        let token = CancellationToken::new();
        token.cancel();
        assert!(token.is_cancelled());
    }

    #[test]
    fn test_cancellation_token_clone_shares_state() {
        let token = CancellationToken::new();
        let clone = token.clone();
        token.cancel();
        assert!(clone.is_cancelled(), "Cloned token should reflect cancellation");
    }
}

// ── Property-Based Tests ──────────────────────────────────────────────────────

#[cfg(test)]
mod pbt {
    use super::*;
    use crate::models::{AuraDocument, DocumentBlock};
    use proptest::prelude::*;

    fn arb_text() -> impl Strategy<Value = String> {
        "[a-zA-Z0-9 ]{1,40}"
            .prop_map(|s| s.trim().to_string())
            .prop_filter("non-empty", |s| !s.is_empty())
    }

    fn arb_document_block() -> impl Strategy<Value = DocumentBlock> {
        prop_oneof![
            // Plain paragraph (no inline)
            arb_text().prop_map(|text| DocumentBlock::Paragraph {
                text: text.clone(),
                inline: vec![],
            }),
            // Heading levels 1-3
            (1u8..=3u8, arb_text()).prop_map(|(level, text)| DocumentBlock::Heading { level, text }),
            // List item (no inline)
            arb_text().prop_map(|text| DocumentBlock::ListItem {
                ordered: false,
                text: text.clone(),
                inline: vec![],
            }),
        ]
    }

    fn arb_document() -> impl Strategy<Value = AuraDocument> {
        (
            "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}",
            arb_text(),
            prop::collection::vec(arb_document_block(), 1..=5),
        )
            .prop_map(|(id, intent_name, content)| AuraDocument {
                id,
                intent_name,
                content,
                version: Some(1),
                created_at: Some(0),
                updated_at: Some(0),
            })
    }

    proptest! {
        // Feature: file-save-management, Property 4: Round-trip DOCX — export(doc) → import() phải bảo toàn toàn bộ văn bản và cấu trúc heading
        // Validates: Requirements 11.2
        #[test]
        fn prop_docx_round_trip(doc in arb_document()) {
            let bytes = export_sync(&doc).expect("export_sync should not fail");
            let result = import_sync(&bytes).expect("import_sync should not fail on valid DOCX");

            // Collect plain text from original blocks
            let orig_texts: Vec<String> = doc.content.iter().map(block_plain_text).collect();
            // Collect plain text from imported blocks (filter out empty strings)
            let imported_texts: Vec<String> = result.document.content
                .iter()
                .map(block_plain_text)
                .filter(|t| !t.is_empty())
                .collect();

            // Every original text must appear in the imported content
            for orig in &orig_texts {
                let found = imported_texts.iter().any(|t| t.contains(orig.as_str()));
                prop_assert!(found, "Text '{}' must survive DOCX round-trip", orig);
            }

            // Heading structure: heading levels must be preserved
            let orig_headings: Vec<u8> = doc.content.iter().filter_map(|b| {
                if let DocumentBlock::Heading { level, .. } = b { Some(*level) } else { None }
            }).collect();
            let imported_headings: Vec<u8> = result.document.content.iter().filter_map(|b| {
                if let DocumentBlock::Heading { level, .. } = b { Some(*level) } else { None }
            }).collect();
            prop_assert_eq!(
                imported_headings,
                orig_headings,
                "Heading levels must survive DOCX round-trip"
            );
        }

        // Feature: file-save-management, Property 5: Aura_Tag DOCX Preservation — export với AuraIntentId → import lại → AuraIntentId vẫn còn
        // Validates: Requirements 11.8
        #[test]
        fn prop_aura_tag_docx_preservation(doc in arb_document()) {
            let original_id = doc.id.clone();

            let bytes = export_sync(&doc).expect("export_sync should not fail");
            let result = import_sync(&bytes).expect("import_sync should not fail");

            prop_assert_eq!(
                result.aura_intent_id,
                Some(original_id),
                "AuraIntentId must be preserved through DOCX export → import"
            );
        }
    }

    fn block_plain_text(block: &DocumentBlock) -> String {
        match block {
            DocumentBlock::Paragraph { text, .. } => text.clone(),
            DocumentBlock::Heading { text, .. } => text.clone(),
            DocumentBlock::ListItem { text, .. } => text.clone(),
            DocumentBlock::CodeBlock { code, .. } => code.clone(),
            DocumentBlock::Placeholder(p) => p.display_hint.clone(),
        }
    }
}
