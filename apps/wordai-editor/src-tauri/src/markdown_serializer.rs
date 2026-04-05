/// Markdown_Serializer — converts AuraDocument ↔ Markdown string.
///
/// serialize: Document → Markdown with YAML frontmatter Aura_Tag
/// parse:     Markdown → Document, extracting aura_intent_id from frontmatter
///
/// Requirements: 6.3, 6.4, 6.8, 6.9, 8.2, 11.1, 11.3, 11.4, 11.9
use chrono::Utc;
use pulldown_cmark::{Event, HeadingLevel, Options, Parser, Tag, TagEnd};

use crate::models::{AuraDocument, DocumentBlock, InlineSpan, IPCError};

// ── Serialize ─────────────────────────────────────────────────────────────────

/// Convert an AuraDocument to a Markdown string with YAML frontmatter Aura_Tag.
///
/// Frontmatter format:
/// ```
/// ---
/// aura_intent_id: <uuid>
/// aura_exported_at: <iso8601>
/// ---
/// ```
///
/// Requirements: 6.3, 6.4, 6.8, 6.9, 11.1
pub fn serialize(doc: &AuraDocument) -> Result<String, IPCError> {
    let mut out = String::new();

    // YAML frontmatter — Requirements 6.8, 6.9
    let exported_at = Utc::now().to_rfc3339();
    out.push_str("---\n");
    out.push_str(&format!("aura_intent_id: {}\n", doc.id));
    out.push_str(&format!("aura_exported_at: {}\n", exported_at));
    out.push_str("---\n\n");

    // Content blocks — Requirements 6.3, 6.4
    let mut i = 0;
    while i < doc.content.len() {
        let block = &doc.content[i];
        match block {
            DocumentBlock::Heading { level, text } => {
                let hashes = "#".repeat(*level as usize);
                out.push_str(&format!("{} {}\n\n", hashes, text));
                i += 1;
            }
            DocumentBlock::Paragraph { text, inline } => {
                if inline.is_empty() {
                    out.push_str(text);
                } else {
                    out.push_str(&render_inline(inline));
                }
                out.push_str("\n\n");
                i += 1;
            }
            DocumentBlock::ListItem { .. } => {
                // Collect all consecutive list items into one list block
                let start = i;
                while i < doc.content.len() {
                    if let DocumentBlock::ListItem { ordered: _, text, inline } = &doc.content[i] {
                        let content = if inline.is_empty() {
                            text.clone()
                        } else {
                            render_inline(inline)
                        };
                        out.push_str(&format!("- {}\n", content));
                        i += 1;
                    } else {
                        break;
                    }
                }
                // Blank line after the list group to separate from next block
                let _ = start;
                out.push('\n');
            }
            DocumentBlock::CodeBlock { language, code } => {
                let lang = language.as_deref().unwrap_or("");
                out.push_str(&format!("```{}\n{}\n```\n\n", lang, code));
                i += 1;
            }
            DocumentBlock::Placeholder(p) => {
                // Render placeholder as a comment-style block so it survives round-trip
                out.push_str(&format!(
                    "<!-- placeholder: {} -->\n\n",
                    p.display_hint
                ));
                i += 1;
            }
        }
    }

    // Trim trailing whitespace
    let trimmed = out.trim_end().to_string();
    Ok(trimmed)
}

/// Render a slice of InlineSpan into a Markdown string.
fn render_inline(spans: &[InlineSpan]) -> String {
    let mut s = String::new();
    for span in spans {
        match span {
            InlineSpan::Text { text } => s.push_str(text),
            InlineSpan::Bold { text } => s.push_str(&format!("**{}**", text)),
            InlineSpan::Italic { text } => s.push_str(&format!("*{}*", text)),
            InlineSpan::Code { text } => s.push_str(&format!("`{}`", text)),
            InlineSpan::BoldItalic { text } => s.push_str(&format!("***{}***", text)),
        }
    }
    s
}

// ── Parse ─────────────────────────────────────────────────────────────────────

/// Parse a Markdown string into an AuraDocument.
///
/// - Reads YAML frontmatter to extract `aura_intent_id` (not included in content).
/// - Uses pulldown-cmark for the body.
/// - Returns `(document, Option<aura_intent_id>)`.
///
/// Requirements: 8.2, 11.3, 11.4, 11.9
pub fn parse(markdown: &str) -> Result<(AuraDocument, Option<String>), IPCError> {
    // Strip and parse YAML frontmatter
    let (body, aura_intent_id) = extract_frontmatter(markdown)?;

    // Parse Markdown body with pulldown-cmark
    let options = Options::ENABLE_STRIKETHROUGH;
    let parser = Parser::new_ext(body, options);

    let mut blocks: Vec<DocumentBlock> = Vec::new();
    let mut current_paragraph: Option<Vec<InlineSpan>> = None;
    let mut current_heading: Option<(u8, String)> = None;
    let mut current_list_item: Option<Vec<InlineSpan>> = None;
    let mut in_code_block = false;
    let mut code_lang: Option<String> = None;
    let mut code_buf = String::new();
    let mut inline_stack: Vec<InlineKind> = Vec::new();

    for event in parser {
        match event {
            Event::Start(Tag::Heading { level, .. }) => {
                let lvl = heading_level_to_u8(level);
                current_heading = Some((lvl, String::new()));
            }
            Event::End(TagEnd::Heading(_)) => {
                if let Some((level, text)) = current_heading.take() {
                    blocks.push(DocumentBlock::Heading { level, text });
                }
            }
            Event::Start(Tag::Paragraph) => {
                // If we're inside a list item, don't start a new paragraph block —
                // the text will flow into current_list_item via push_span.
                if current_list_item.is_none() {
                    current_paragraph = Some(Vec::new());
                }
            }
            Event::End(TagEnd::Paragraph) => {
                if let Some(spans) = current_paragraph.take() {
                    let text = spans_to_plain_text(&spans);
                    blocks.push(DocumentBlock::Paragraph { text, inline: spans });
                }
                // If inside a list item, End(Paragraph) is a no-op here
            }
            Event::Start(Tag::Item) => {
                current_list_item = Some(Vec::new());
            }
            Event::End(TagEnd::Item) => {
                if let Some(spans) = current_list_item.take() {
                    let text = spans_to_plain_text(&spans);
                    blocks.push(DocumentBlock::ListItem {
                        ordered: false,
                        text,
                        inline: spans,
                    });
                }
            }
            Event::Start(Tag::List(_)) | Event::End(TagEnd::List(_)) => {
                // List container — no block needed
            }
            Event::Start(Tag::CodeBlock(kind)) => {
                in_code_block = true;
                code_lang = match kind {
                    pulldown_cmark::CodeBlockKind::Fenced(lang) => {
                        let s = lang.to_string();
                        if s.is_empty() { None } else { Some(s) }
                    }
                    pulldown_cmark::CodeBlockKind::Indented => None,
                };
                code_buf.clear();
            }
            Event::End(TagEnd::CodeBlock) => {
                in_code_block = false;
                // Remove trailing newline added by pulldown-cmark
                let code = code_buf.trim_end_matches('\n').to_string();
                blocks.push(DocumentBlock::CodeBlock {
                    language: code_lang.take(),
                    code,
                });
                code_buf.clear();
            }
            Event::Start(Tag::Strong) => {
                inline_stack.push(InlineKind::Bold);
            }
            Event::End(TagEnd::Strong) => {
                inline_stack.pop();
            }
            Event::Start(Tag::Emphasis) => {
                inline_stack.push(InlineKind::Italic);
            }
            Event::End(TagEnd::Emphasis) => {
                inline_stack.pop();
            }
            Event::Code(text) => {
                // Inline code span
                let span = InlineSpan::Code { text: text.to_string() };
                push_span(&mut current_paragraph, &mut current_list_item, &mut current_heading, span);
            }
            Event::Text(text) => {
                if in_code_block {
                    code_buf.push_str(&text);
                } else {
                    let span = make_span(&inline_stack, text.to_string());
                    push_span(&mut current_paragraph, &mut current_list_item, &mut current_heading, span);
                }
            }
            Event::SoftBreak | Event::HardBreak => {
                if !in_code_block {
                    let span = InlineSpan::Text { text: " ".to_string() };
                    push_span(&mut current_paragraph, &mut current_list_item, &mut current_heading, span);
                }
            }
            Event::Html(html) => {
                // Preserve HTML comments (e.g. placeholder comments) as plain text
                let text = html.to_string();
                let span = InlineSpan::Text { text };
                push_span(&mut current_paragraph, &mut current_list_item, &mut current_heading, span);
            }
            _ => {}
        }
    }

    let now_ms = Utc::now().timestamp_millis();
    let doc = AuraDocument {
        id: uuid::Uuid::new_v4().to_string(),
        intent_name: String::new(),
        content: blocks,
        version: None,
        created_at: Some(now_ms),
        updated_at: Some(now_ms),
    };

    Ok((doc, aura_intent_id))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq)]
enum InlineKind {
    Bold,
    Italic,
}

fn make_span(stack: &[InlineKind], text: String) -> InlineSpan {
    let has_bold = stack.contains(&InlineKind::Bold);
    let has_italic = stack.contains(&InlineKind::Italic);
    match (has_bold, has_italic) {
        (true, true) => InlineSpan::BoldItalic { text },
        (true, false) => InlineSpan::Bold { text },
        (false, true) => InlineSpan::Italic { text },
        (false, false) => InlineSpan::Text { text },
    }
}

fn push_span(
    para: &mut Option<Vec<InlineSpan>>,
    list: &mut Option<Vec<InlineSpan>>,
    heading: &mut Option<(u8, String)>,
    span: InlineSpan,
) {
    if let Some(ref mut spans) = para {
        spans.push(span);
    } else if let Some(ref mut spans) = list {
        spans.push(span);
    } else if let Some((_, ref mut text)) = heading {
        // For headings, just accumulate plain text
        match &span {
            InlineSpan::Text { text: t } => text.push_str(t),
            InlineSpan::Bold { text: t } => text.push_str(t),
            InlineSpan::Italic { text: t } => text.push_str(t),
            InlineSpan::Code { text: t } => text.push_str(t),
            InlineSpan::BoldItalic { text: t } => text.push_str(t),
        }
    }
}

fn spans_to_plain_text(spans: &[InlineSpan]) -> String {
    spans
        .iter()
        .map(|s| match s {
            InlineSpan::Text { text } => text.as_str(),
            InlineSpan::Bold { text } => text.as_str(),
            InlineSpan::Italic { text } => text.as_str(),
            InlineSpan::Code { text } => text.as_str(),
            InlineSpan::BoldItalic { text } => text.as_str(),
        })
        .collect()
}

fn heading_level_to_u8(level: HeadingLevel) -> u8 {
    match level {
        HeadingLevel::H1 => 1,
        HeadingLevel::H2 => 2,
        HeadingLevel::H3 => 3,
        HeadingLevel::H4 => 4,
        HeadingLevel::H5 => 5,
        HeadingLevel::H6 => 6,
    }
}

/// Extract YAML frontmatter from the start of a Markdown string.
///
/// Returns `(body_without_frontmatter, Option<aura_intent_id>)`.
/// Requirements: 8.2, 11.9
fn extract_frontmatter(markdown: &str) -> Result<(&str, Option<String>), IPCError> {
    let trimmed = markdown.trim_start_matches('\n');

    if !trimmed.starts_with("---") {
        return Ok((markdown, None));
    }

    // Find the closing ---
    let after_open = &trimmed[3..];
    // Skip optional newline right after opening ---
    let after_open = after_open.trim_start_matches('\n');

    let close_pos = after_open.find("\n---").ok_or_else(|| IPCError {
        code: "PARSE_ERROR".to_string(),
        message: "YAML frontmatter opened with '---' but closing '---' not found".to_string(),
    })?;

    let frontmatter = &after_open[..close_pos];
    let rest = &after_open[close_pos + 4..]; // skip "\n---"
    // Skip one optional newline after closing ---
    let body = rest.trim_start_matches('\n');

    // Extract aura_intent_id from frontmatter lines
    let aura_intent_id = frontmatter.lines().find_map(|line| {
        let line = line.trim();
        if let Some(val) = line.strip_prefix("aura_intent_id:") {
            let id = val.trim().to_string();
            if !id.is_empty() { Some(id) } else { None }
        } else {
            None
        }
    });

    Ok((body, aura_intent_id))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{AuraDocument, DocumentBlock, InlineSpan};

    fn make_doc(content: Vec<DocumentBlock>) -> AuraDocument {
        AuraDocument {
            id: "test-id-1234".to_string(),
            intent_name: "Test Intent".to_string(),
            content,
            version: Some(1),
            created_at: Some(0),
            updated_at: Some(0),
        }
    }

    #[test]
    fn test_serialize_heading() {
        let doc = make_doc(vec![DocumentBlock::Heading {
            level: 1,
            text: "Hello World".to_string(),
        }]);
        let md = serialize(&doc).unwrap();
        assert!(md.contains("# Hello World"), "Should contain H1");
        assert!(md.contains("aura_intent_id: test-id-1234"), "Should have frontmatter");
    }

    #[test]
    fn test_serialize_paragraph_with_inline() {
        let doc = make_doc(vec![DocumentBlock::Paragraph {
            text: "Hello World".to_string(),
            inline: vec![
                InlineSpan::Text { text: "Hello ".to_string() },
                InlineSpan::Bold { text: "World".to_string() },
            ],
        }]);
        let md = serialize(&doc).unwrap();
        assert!(md.contains("Hello **World**"), "Should render bold inline");
    }

    #[test]
    fn test_serialize_code_block() {
        let doc = make_doc(vec![DocumentBlock::CodeBlock {
            language: Some("rust".to_string()),
            code: "fn main() {}".to_string(),
        }]);
        let md = serialize(&doc).unwrap();
        assert!(md.contains("```rust\nfn main() {}\n```"), "Should render fenced code block");
    }

    #[test]
    fn test_serialize_list_item() {
        let doc = make_doc(vec![DocumentBlock::ListItem {
            ordered: false,
            text: "Item one".to_string(),
            inline: vec![],
        }]);
        let md = serialize(&doc).unwrap();
        assert!(md.contains("- Item one"), "Should render list item");
    }

    #[test]
    fn test_frontmatter_present() {
        let doc = make_doc(vec![]);
        let md = serialize(&doc).unwrap();
        assert!(md.starts_with("---\naura_intent_id:"), "Frontmatter must be at start");
        assert!(md.contains("aura_exported_at:"), "Must have exported_at");
    }

    #[test]
    fn test_parse_extracts_aura_intent_id() {
        let md = "---\naura_intent_id: abc-123\naura_exported_at: 2025-01-01T00:00:00Z\n---\n\n# Title\n";
        let (doc, id) = parse(md).unwrap();
        assert_eq!(id, Some("abc-123".to_string()));
        assert!(!doc.content.is_empty(), "Should have content");
    }

    #[test]
    fn test_parse_no_frontmatter() {
        let md = "# Hello\n\nSome paragraph.\n";
        let (doc, id) = parse(md).unwrap();
        assert_eq!(id, None);
        assert!(!doc.content.is_empty());
    }

    #[test]
    fn test_parse_heading_levels() {
        let md = "# H1\n\n## H2\n\n### H3\n";
        let (doc, _) = parse(md).unwrap();
        let headings: Vec<_> = doc.content.iter().filter_map(|b| {
            if let DocumentBlock::Heading { level, text } = b {
                Some((*level, text.clone()))
            } else {
                None
            }
        }).collect();
        assert_eq!(headings, vec![(1, "H1".to_string()), (2, "H2".to_string()), (3, "H3".to_string())]);
    }

    #[test]
    fn test_parse_unclosed_frontmatter_error() {
        let md = "---\naura_intent_id: abc\n# No closing\n";
        let result = parse(md);
        assert!(result.is_err(), "Unclosed frontmatter should return error");
    }

    #[test]
    fn test_round_trip_heading() {
        let doc = make_doc(vec![
            DocumentBlock::Heading { level: 2, text: "Section".to_string() },
            DocumentBlock::Paragraph { text: "Content here".to_string(), inline: vec![] },
        ]);
        let md = serialize(&doc).unwrap();
        let (parsed, id) = parse(&md).unwrap();
        assert_eq!(id, Some("test-id-1234".to_string()));
        // Check heading preserved
        let has_heading = parsed.content.iter().any(|b| matches!(b, DocumentBlock::Heading { level: 2, text } if text == "Section"));
        assert!(has_heading, "Heading should survive round-trip");
    }

    #[test]
    fn test_round_trip_code_block() {
        let doc = make_doc(vec![
            DocumentBlock::CodeBlock {
                language: Some("python".to_string()),
                code: "print('hello')".to_string(),
            },
        ]);
        let md = serialize(&doc).unwrap();
        let (parsed, _) = parse(&md).unwrap();
        let has_code = parsed.content.iter().any(|b| {
            matches!(b, DocumentBlock::CodeBlock { language: Some(lang), code } if lang == "python" && code == "print('hello')")
        });
        assert!(has_code, "Code block should survive round-trip");
    }
}

// ── Property-Based Tests ──────────────────────────────────────────────────────

#[cfg(test)]
mod pbt {
    use super::*;
    use crate::models::{AuraDocument, DocumentBlock, InlineSpan};
    use proptest::prelude::*;

    fn arb_text() -> impl Strategy<Value = String> {
        "[a-zA-Z0-9 ]{1,40}".prop_map(|s| s.trim().to_string()).prop_filter("non-empty", |s| !s.is_empty())
    }

    fn arb_document_block() -> impl Strategy<Value = DocumentBlock> {
        prop_oneof![
            // Paragraph with no inline (plain text only — avoids nested formatting ambiguity)
            arb_text().prop_map(|text| DocumentBlock::Paragraph {
                text: text.clone(),
                inline: vec![],
            }),
            // Heading levels 1-6
            (1u8..=6u8, arb_text()).prop_map(|(level, text)| DocumentBlock::Heading { level, text }),
            // ListItem with no inline
            arb_text().prop_map(|text| DocumentBlock::ListItem {
                ordered: false,
                text: text.clone(),
                inline: vec![],
            }),
            // CodeBlock
            (arb_text(), arb_text()).prop_map(|(lang, code)| DocumentBlock::CodeBlock {
                language: Some(lang),
                code,
            }),
        ]
    }

    fn arb_document() -> impl Strategy<Value = AuraDocument> {
        (
            "[a-f0-9\\-]{36}".prop_map(|s| s),
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
        // Feature: file-save-management, Property 2: Round-trip Markdown — serialize(doc) → parse() phải tạo Document tương đương về content
        // Validates: Requirements 11.1, 11.3
        #[test]
        fn prop_markdown_round_trip(doc in arb_document()) {
            let md = serialize(&doc).expect("serialize should not fail");
            let (parsed, _id) = parse(&md).expect("parse should not fail on valid serialized markdown");

            // The number of blocks must match
            prop_assert_eq!(
                parsed.content.len(),
                doc.content.len(),
                "Round-trip must preserve block count"
            );

            // Each block's plain text content must match
            for (orig, parsed_block) in doc.content.iter().zip(parsed.content.iter()) {
                let orig_text = block_plain_text(orig);
                let parsed_text = block_plain_text(parsed_block);
                prop_assert_eq!(
                    parsed_text.trim(),
                    orig_text.trim(),
                    "Block text must survive round-trip"
                );
            }
        }

        // Feature: file-save-management, Property 3: Aura_Tag Preservation — file có YAML frontmatter aura_intent_id → parse → serialize → vẫn còn aura_intent_id
        // Validates: Requirements 11.8, 11.9
        #[test]
        fn prop_aura_tag_preservation(doc in arb_document()) {
            let original_id = doc.id.clone();

            // Step 1: serialize → produces markdown with frontmatter containing aura_intent_id
            let md = serialize(&doc).expect("serialize should not fail");

            // Step 2: parse → extract aura_intent_id from frontmatter
            let (_parsed_doc, extracted_id) = parse(&md).expect("parse should not fail");

            // The extracted aura_intent_id must equal the original document id
            prop_assert_eq!(
                extracted_id,
                Some(original_id),
                "aura_intent_id must be preserved through serialize → parse"
            );
        }
    }

    /// Extract plain text from a DocumentBlock for comparison.
    fn block_plain_text(block: &DocumentBlock) -> String {
        match block {
            DocumentBlock::Paragraph { text, inline } => {
                if inline.is_empty() {
                    text.clone()
                } else {
                    inline.iter().map(|s| match s {
                        InlineSpan::Text { text } => text.clone(),
                        InlineSpan::Bold { text } => text.clone(),
                        InlineSpan::Italic { text } => text.clone(),
                        InlineSpan::Code { text } => text.clone(),
                        InlineSpan::BoldItalic { text } => text.clone(),
                    }).collect()
                }
            }
            DocumentBlock::Heading { text, .. } => text.clone(),
            DocumentBlock::ListItem { text, inline, .. } => {
                if inline.is_empty() {
                    text.clone()
                } else {
                    inline.iter().map(|s| match s {
                        InlineSpan::Text { text } => text.clone(),
                        InlineSpan::Bold { text } => text.clone(),
                        InlineSpan::Italic { text } => text.clone(),
                        InlineSpan::Code { text } => text.clone(),
                        InlineSpan::BoldItalic { text } => text.clone(),
                    }).collect()
                }
            }
            DocumentBlock::CodeBlock { code, .. } => code.clone(),
            DocumentBlock::Placeholder(p) => p.display_hint.clone(),
        }
    }
}
