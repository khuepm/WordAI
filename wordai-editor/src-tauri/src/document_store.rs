/// Document Store - manages document serialization, deserialization, and version control
/// Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 22.1, 22.2, 22.3
use crate::models::{Document, DocumentMetadata, DocumentStatus, IPCError};

/// Serialize a Document to a pretty-printed JSON string.
/// Req 14.1, 14.3
pub fn serialize_document(document: &Document) -> Result<String, IPCError> {
    serde_json::to_string_pretty(document).map_err(|e| IPCError {
        code: "SERIALIZE_ERROR".to_string(),
        message: format!("Failed to serialize document: {}", e),
    })
}

/// Deserialize a Document from a JSON string, validating all required fields.
/// Req 14.2, 14.4, 14.5
pub fn deserialize_document(json: &str) -> Result<Document, IPCError> {
    let doc: Document = serde_json::from_str(json).map_err(|e| IPCError {
        code: "DESERIALIZE_ERROR".to_string(),
        message: format!("Invalid document data: {}", e),
    })?;

    validate_document(&doc)?;
    Ok(doc)
}

/// Validate that all required fields are present and non-empty.
/// Req 14.4, 14.5
fn validate_document(doc: &Document) -> Result<(), IPCError> {
    if doc.id.is_empty() {
        return Err(IPCError {
            code: "VALIDATION_ERROR".to_string(),
            message: "Document 'id' is required and must not be empty".to_string(),
        });
    }
    if doc.last_modified.is_empty() {
        return Err(IPCError {
            code: "VALIDATION_ERROR".to_string(),
            message: "Document 'last_modified' is required and must not be empty".to_string(),
        });
    }
    Ok(())
}

/// Increment the document version number in-place.
/// Req 22.2
pub fn increment_version(document: &mut Document) {
    document.version += 1;
}

/// Create a new Document with version initialized to 1.
/// Req 22.1
pub fn create_document(id: String, title: String, last_modified: String) -> Document {
    Document {
        id,
        title,
        content: String::new(),
        metadata: DocumentMetadata {
            word_count: 0,
            reading_time: 0,
            status: DocumentStatus::Draft,
            tags: vec![],
        },
        version: 1,
        last_modified,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── Helpers ───────────────────────────────────────────────────────────────

    fn sample_document() -> Document {
        Document {
            id: "doc-001".to_string(),
            title: "Test Document".to_string(),
            content: "Hello, world!".to_string(),
            metadata: DocumentMetadata {
                word_count: 2,
                reading_time: 1,
                status: DocumentStatus::Draft,
                tags: vec!["rust".to_string(), "test".to_string()],
            },
            version: 3,
            last_modified: "2024-01-15T10:30:00Z".to_string(),
        }
    }

    // ── Serialization tests (Req 14.1, 14.3) ─────────────────────────────────

    #[test]
    fn test_serialize_produces_valid_json() {
        let doc = sample_document();
        let result = serialize_document(&doc);
        assert!(result.is_ok(), "serialize_document should succeed");
        let json = result.unwrap();
        // Must be parseable JSON
        let parsed: serde_json::Value = serde_json::from_str(&json).expect("output must be valid JSON");
        assert!(parsed.is_object());
    }

    #[test]
    fn test_serialize_includes_all_fields() {
        // Req 14.3 – all fields must be present in the serialized output
        let doc = sample_document();
        let json = serialize_document(&doc).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed["id"], "doc-001");
        assert_eq!(parsed["title"], "Test Document");
        assert_eq!(parsed["content"], "Hello, world!");
        assert_eq!(parsed["version"], 3);
        assert_eq!(parsed["last_modified"], "2024-01-15T10:30:00Z");
        // metadata sub-fields
        assert_eq!(parsed["metadata"]["word_count"], 2);
        assert_eq!(parsed["metadata"]["reading_time"], 1);
        assert_eq!(parsed["metadata"]["status"], "draft");
        assert_eq!(parsed["metadata"]["tags"][0], "rust");
        assert_eq!(parsed["metadata"]["tags"][1], "test");
    }

    #[test]
    fn test_serialize_roundtrip_preserves_data() {
        // Req 14.1, 14.2 – serialize then deserialize must yield identical document
        let original = sample_document();
        let json = serialize_document(&original).unwrap();
        let restored = deserialize_document(&json).unwrap();

        assert_eq!(restored.id, original.id);
        assert_eq!(restored.title, original.title);
        assert_eq!(restored.content, original.content);
        assert_eq!(restored.version, original.version);
        assert_eq!(restored.last_modified, original.last_modified);
        assert_eq!(restored.metadata.word_count, original.metadata.word_count);
        assert_eq!(restored.metadata.reading_time, original.metadata.reading_time);
        assert_eq!(restored.metadata.tags, original.metadata.tags);
    }

    // ── Deserialization with valid data (Req 14.2) ────────────────────────────

    #[test]
    fn test_deserialize_valid_json() {
        let json = r#"{
            "id": "abc-123",
            "title": "My Doc",
            "content": "Some content",
            "metadata": {
                "word_count": 2,
                "reading_time": 1,
                "status": "draft",
                "tags": []
            },
            "version": 1,
            "last_modified": "2024-06-01T00:00:00Z"
        }"#;

        let result = deserialize_document(json);
        assert!(result.is_ok(), "valid JSON should deserialize successfully");
        let doc = result.unwrap();
        assert_eq!(doc.id, "abc-123");
        assert_eq!(doc.title, "My Doc");
        assert_eq!(doc.version, 1);
    }

    // ── Deserialization with invalid / missing fields (Req 14.4, 14.5) ────────

    #[test]
    fn test_deserialize_invalid_json_returns_error() {
        // Req 14.5 – malformed JSON must return an error
        let result = deserialize_document("not valid json at all");
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code, "DESERIALIZE_ERROR");
    }

    #[test]
    fn test_deserialize_missing_id_returns_validation_error() {
        // Req 14.4 – missing required field 'id' must return VALIDATION_ERROR
        let json = r#"{
            "id": "",
            "title": "No ID Doc",
            "content": "",
            "metadata": {
                "word_count": 0,
                "reading_time": 0,
                "status": "draft",
                "tags": []
            },
            "version": 1,
            "last_modified": "2024-06-01T00:00:00Z"
        }"#;

        let result = deserialize_document(json);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
        assert!(err.message.contains("id"));
    }

    #[test]
    fn test_deserialize_missing_last_modified_returns_validation_error() {
        // Req 14.4 – missing required field 'last_modified' must return VALIDATION_ERROR
        let json = r#"{
            "id": "doc-xyz",
            "title": "No Timestamp",
            "content": "",
            "metadata": {
                "word_count": 0,
                "reading_time": 0,
                "status": "draft",
                "tags": []
            },
            "version": 1,
            "last_modified": ""
        }"#;

        let result = deserialize_document(json);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code, "VALIDATION_ERROR");
        assert!(err.message.contains("last_modified"));
    }

    #[test]
    fn test_deserialize_missing_required_struct_field_returns_error() {
        // Req 14.5 – JSON missing a required struct field (e.g. version) must fail
        let json = r#"{
            "id": "doc-xyz",
            "title": "Missing version",
            "content": "",
            "metadata": {
                "word_count": 0,
                "reading_time": 0,
                "status": "draft",
                "tags": []
            },
            "last_modified": "2024-06-01T00:00:00Z"
        }"#;

        let result = deserialize_document(json);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code, "DESERIALIZE_ERROR");
    }

    // ── Version number increment logic (Req 22.2) ─────────────────────────────

    #[test]
    fn test_increment_version_increases_by_one() {
        let mut doc = sample_document(); // version = 3
        increment_version(&mut doc);
        assert_eq!(doc.version, 4);
    }

    #[test]
    fn test_increment_version_multiple_times() {
        let mut doc = sample_document(); // version = 3
        increment_version(&mut doc);
        increment_version(&mut doc);
        increment_version(&mut doc);
        assert_eq!(doc.version, 6);
    }

    #[test]
    fn test_increment_version_does_not_modify_other_fields() {
        let mut doc = sample_document();
        let original_id = doc.id.clone();
        let original_title = doc.title.clone();
        increment_version(&mut doc);
        assert_eq!(doc.id, original_id);
        assert_eq!(doc.title, original_title);
    }

    // ── create_document initializes version to 1 (Req 22.1) ──────────────────

    #[test]
    fn test_create_document_initializes_version_to_one() {
        let doc = create_document(
            "new-id".to_string(),
            "New Title".to_string(),
            "2024-01-01T00:00:00Z".to_string(),
        );
        assert_eq!(doc.version, 1);
    }

    #[test]
    fn test_create_document_sets_correct_fields() {
        let doc = create_document(
            "id-42".to_string(),
            "My Title".to_string(),
            "2024-03-10T08:00:00Z".to_string(),
        );
        assert_eq!(doc.id, "id-42");
        assert_eq!(doc.title, "My Title");
        assert_eq!(doc.last_modified, "2024-03-10T08:00:00Z");
        assert!(doc.content.is_empty());
        assert_eq!(doc.metadata.word_count, 0);
        assert_eq!(doc.metadata.reading_time, 0);
        assert!(doc.metadata.tags.is_empty());
    }
}
