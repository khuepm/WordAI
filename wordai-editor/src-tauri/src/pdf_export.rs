/// PDF Export Engine - generates PDF documents
/// Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
use crate::models::IPCError;
use printpdf::{BuiltinFont, Mm, PdfDocument};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::BufWriter;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PDFExportOptions {
    pub page_size: String, // "A4", "Letter", "Legal"
    pub margin_top: f32,
    pub margin_bottom: f32,
    pub margin_left: f32,
    pub margin_right: f32,
    pub font_size: f32,
}

impl Default for PDFExportOptions {
    fn default() -> Self {
        Self {
            page_size: "A4".to_string(),
            margin_top: 25.4,
            margin_bottom: 25.4,
            margin_left: 25.4,
            margin_right: 25.4,
            font_size: 12.0,
        }
    }
}

/// Returns (width_mm, height_mm) for the given page size name.
fn page_dimensions(page_size: &str) -> (f32, f32) {
    match page_size {
        "Letter" => (215.9, 279.4),
        "Legal" => (215.9, 355.6),
        _ => (210.0, 297.0), // A4 default
    }
}

/// Estimate how many characters fit on one line given the printable width in mm and font size in pt.
/// Rough approximation: average character width ≈ 0.5 * font_size_pt * 0.352778 mm (pt → mm).
fn chars_per_line(printable_width_mm: f32, font_size_pt: f32) -> usize {
    let char_width_mm = 0.5 * font_size_pt * 0.352778;
    if char_width_mm <= 0.0 {
        return 80;
    }
    (printable_width_mm / char_width_mm).floor() as usize
}

pub struct PDFExportEngine;

impl PDFExportEngine {
    /// Generate a PDF from `content`, writing it to `output_path`.
    /// Uses the Helvetica built-in font (conceptually "Newsreader" per design).
    /// Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
    pub fn generate_pdf(
        content: &str,
        output_path: &str,
        options: &PDFExportOptions,
    ) -> Result<(), IPCError> {
        let (page_w, page_h) = page_dimensions(&options.page_size);

        // Printable area dimensions
        let printable_w = page_w - options.margin_left - options.margin_right;
        let printable_h = page_h - options.margin_top - options.margin_bottom;

        // Line height in mm (1.4× font size converted from pt to mm)
        let font_size_pt = options.font_size;
        let line_height_mm = font_size_pt * 0.352778 * 1.4;

        let max_lines_per_page = if line_height_mm > 0.0 {
            (printable_h / line_height_mm).floor() as usize
        } else {
            40
        };

        let cpl = chars_per_line(printable_w, font_size_pt);

        // Wrap all content into display lines
        let display_lines = wrap_text(content, cpl);

        // Create the PDF document with the first page
        let (doc, first_page_idx, first_layer_idx) = PdfDocument::empty("WordAI Document");

        // Use Helvetica as the built-in font (conceptually "Newsreader")
        let font = doc
            .add_builtin_font(BuiltinFont::Helvetica)
            .map_err(|e| IPCError {
                code: "PDF_FONT_ERROR".to_string(),
                message: format!("Failed to load built-in font: {e}"),
            })?;

        // Resize the first page to the desired dimensions
        {
            let page = doc.get_page(first_page_idx);
            page.set_media_box(Mm(0.0), Mm(0.0), Mm(page_w), Mm(page_h));
        }

        // Paginate lines across pages
        let chunk_size = if max_lines_per_page > 0 { max_lines_per_page } else { 1 };
        let chunks: Vec<&[String]> = display_lines.chunks(chunk_size).collect();

        for (page_num, chunk) in chunks.iter().enumerate() {
            let layer = if page_num == 0 {
                doc.get_page(first_page_idx).get_layer(first_layer_idx)
            } else {
                let (new_page_idx, new_layer_idx) = doc.add_page(Mm(page_w), Mm(page_h), "Layer 1");
                doc.get_page(new_page_idx).get_layer(new_layer_idx)
            };

            for (line_idx, line) in chunk.iter().enumerate() {
                // Y position: start from top margin, move down per line
                let y = page_h - options.margin_top - (line_idx as f32 + 1.0) * line_height_mm;
                let x = options.margin_left;
                layer.use_text(line.as_str(), font_size_pt as f64, Mm(x), Mm(y), &font);
            }
        }

        // Save to file
        let file = File::create(output_path).map_err(|e| IPCError {
            code: "FILE_WRITE_ERROR".to_string(),
            message: format!("Failed to create output file '{}': {}", output_path, e),
        })?;

        doc.save(&mut BufWriter::new(file)).map_err(|e| IPCError {
            code: "FILE_WRITE_ERROR".to_string(),
            message: format!("Failed to write PDF to '{}': {}", output_path, e),
        })?;

        Ok(())
    }
}

/// Wrap `text` into lines of at most `max_chars` characters.
/// Preserves existing newlines and word-wraps long lines.
fn wrap_text(text: &str, max_chars: usize) -> Vec<String> {
    let max_chars = if max_chars == 0 { 80 } else { max_chars };
    let mut result = Vec::new();

    for paragraph in text.lines() {
        if paragraph.is_empty() {
            result.push(String::new());
            continue;
        }

        let mut current_line = String::new();
        for word in paragraph.split_whitespace() {
            if current_line.is_empty() {
                if word.len() > max_chars {
                    for chunk in word.as_bytes().chunks(max_chars) {
                        result.push(String::from_utf8_lossy(chunk).into_owned());
                    }
                } else {
                    current_line.push_str(word);
                }
            } else if current_line.len() + 1 + word.len() <= max_chars {
                current_line.push(' ');
                current_line.push_str(word);
            } else {
                result.push(current_line.clone());
                current_line.clear();
                if word.len() > max_chars {
                    for chunk in word.as_bytes().chunks(max_chars) {
                        result.push(String::from_utf8_lossy(chunk).into_owned());
                    }
                } else {
                    current_line.push_str(word);
                }
            }
        }
        if !current_line.is_empty() {
            result.push(current_line);
        }
    }

    result
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn temp_path(name: &str) -> String {
        let mut p = env::temp_dir();
        p.push(name);
        p.to_string_lossy().into_owned()
    }

    #[test]
    fn test_generate_pdf_a4() {
        let opts = PDFExportOptions {
            page_size: "A4".to_string(),
            ..Default::default()
        };
        let result = PDFExportEngine::generate_pdf("Hello A4 world", &temp_path("test_a4.pdf"), &opts);
        assert!(result.is_ok(), "A4 PDF generation failed: {:?}", result);
    }

    #[test]
    fn test_generate_pdf_letter() {
        let opts = PDFExportOptions {
            page_size: "Letter".to_string(),
            ..Default::default()
        };
        let result = PDFExportEngine::generate_pdf("Hello Letter world", &temp_path("test_letter.pdf"), &opts);
        assert!(result.is_ok(), "Letter PDF generation failed: {:?}", result);
    }

    #[test]
    fn test_generate_pdf_legal() {
        let opts = PDFExportOptions {
            page_size: "Legal".to_string(),
            ..Default::default()
        };
        let result = PDFExportEngine::generate_pdf("Hello Legal world", &temp_path("test_legal.pdf"), &opts);
        assert!(result.is_ok(), "Legal PDF generation failed: {:?}", result);
    }

    #[test]
    fn test_generate_pdf_custom_margins() {
        let opts = PDFExportOptions {
            page_size: "A4".to_string(),
            margin_top: 10.0,
            margin_bottom: 10.0,
            margin_left: 15.0,
            margin_right: 15.0,
            font_size: 10.0,
        };
        let result = PDFExportEngine::generate_pdf("Custom margins content", &temp_path("test_margins.pdf"), &opts);
        assert!(result.is_ok(), "Custom margins PDF generation failed: {:?}", result);
    }

    #[test]
    fn test_generate_pdf_multipage() {
        let line = "This is a line of text that will be repeated many times to force multiple pages. ";
        let content = line.repeat(200);
        let opts = PDFExportOptions::default();
        let result = PDFExportEngine::generate_pdf(&content, &temp_path("test_multipage.pdf"), &opts);
        assert!(result.is_ok(), "Multi-page PDF generation failed: {:?}", result);
    }

    #[test]
    fn test_generate_pdf_file_write_error() {
        let opts = PDFExportOptions::default();
        let result = PDFExportEngine::generate_pdf("Some content", "/nonexistent_dir/out.pdf", &opts);
        assert!(result.is_err(), "Expected error for invalid path");
        let err = result.unwrap_err();
        assert_eq!(err.code, "FILE_WRITE_ERROR");
    }
}
