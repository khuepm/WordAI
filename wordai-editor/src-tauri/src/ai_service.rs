/// AI Service Connector - interfaces with external LLM APIs
/// Requirements: 6.3, 6.4, 16.1, 16.2, 16.3
use crate::models::{AISuggestion, IPCError};

pub struct AIServiceConnector {
    pub api_key: String,
    pub endpoint: String,
}

impl AIServiceConnector {
    pub fn new(api_key: String, endpoint: String) -> Self {
        Self { api_key, endpoint }
    }

    pub async fn check_health(&self) -> bool {
        // Placeholder: will implement HTTP health check
        !self.api_key.is_empty()
    }

    pub async fn request_suggestion(
        &self,
        _context: &str,
        _selected_text: Option<&str>,
    ) -> Result<Vec<AISuggestion>, IPCError> {
        // Placeholder: will implement LLM API call
        Err(IPCError {
            code: "NOT_IMPLEMENTED".to_string(),
            message: "AI service not yet configured".to_string(),
        })
    }

    pub async fn send_chat_message(
        &self,
        _message: &str,
        _history: &[String],
    ) -> Result<String, IPCError> {
        // Placeholder: will implement chat API call
        Err(IPCError {
            code: "NOT_IMPLEMENTED".to_string(),
            message: "Chat not yet configured".to_string(),
        })
    }
}
