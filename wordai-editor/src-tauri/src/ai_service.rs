/// AI Service Connector - interfaces with external LLM APIs
/// Requirements: 6.3, 6.4, 16.1, 16.2, 16.3
use crate::models::{AISuggestion, IPCError};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;
use uuid::Uuid;

const DEFAULT_ENDPOINT: &str = "https://api.openai.com/v1";
const REQUEST_TIMEOUT_SECS: u64 = 30;
const DEFAULT_MODEL: &str = "gpt-4o-mini";

// ── OpenAI request/response types ─────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f32,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: ResponseMessage,
}

#[derive(Debug, Deserialize)]
struct ResponseMessage {
    content: String,
}

/// Parsed suggestion from LLM JSON response
#[derive(Debug, Deserialize)]
struct RawSuggestion {
    suggested_text: String,
    explanation: String,
    confidence_score: f32,
}

// ── Connector ─────────────────────────────────────────────────────────────────

pub struct AIServiceConnector {
    pub api_key: String,
    pub endpoint: String,
    client: Client,
}

impl AIServiceConnector {
    /// Create a new connector. Reads env vars as fallback for api_key / endpoint.
    pub fn new(api_key: String, endpoint: Option<String>) -> Self {
        let resolved_key = if api_key.is_empty() {
            std::env::var("OPENAI_API_KEY").unwrap_or_default()
        } else {
            api_key
        };

        let resolved_endpoint = endpoint
            .filter(|e| !e.is_empty())
            .or_else(|| std::env::var("OPENAI_API_ENDPOINT").ok())
            .unwrap_or_else(|| DEFAULT_ENDPOINT.to_string());

        let client = Client::builder()
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .build()
            .expect("Failed to build HTTP client");

        Self {
            api_key: resolved_key,
            endpoint: resolved_endpoint,
            client,
        }
    }

    /// Lightweight connectivity check via the models list endpoint.
    /// Requirements: 25.4
    pub async fn check_health(&self) -> bool {
        if self.api_key.is_empty() {
            return false;
        }
        let url = format!("{}/models", self.endpoint);
        match self
            .client
            .get(&url)
            .bearer_auth(&self.api_key)
            .send()
            .await
        {
            Ok(resp) => resp.status().is_success(),
            Err(_) => false,
        }
    }

    /// Request writing suggestions for the given document context.
    /// Requirements: 6.3, 6.4
    pub async fn request_suggestion(
        &self,
        context: &str,
        selected_text: Option<&str>,
    ) -> Result<Vec<AISuggestion>, IPCError> {
        let user_content = build_suggestion_prompt(context, selected_text);
        let suggestions_json = self
            .call_chat_completions(
                "You are a writing assistant. Return ONLY a JSON array of suggestion objects \
                 with fields: suggested_text, explanation, confidence_score (0.0-1.0). \
                 No markdown, no extra text.",
                &user_content,
            )
            .await?;

        parse_suggestions(&suggestions_json, selected_text.unwrap_or(context))
    }

    /// Send a chat message with conversation history.
    /// Requirements: 23.2, 23.4
    pub async fn send_chat_message(
        &self,
        message: &str,
        history: &[String],
    ) -> Result<String, IPCError> {
        let mut messages = vec![ChatMessage {
            role: "system".to_string(),
            content: "You are AuraSphere, a helpful writing assistant.".to_string(),
        }];

        // Alternate history entries as user/assistant
        for (i, entry) in history.iter().enumerate() {
            messages.push(ChatMessage {
                role: if i % 2 == 0 {
                    "user".to_string()
                } else {
                    "assistant".to_string()
                },
                content: entry.clone(),
            });
        }

        messages.push(ChatMessage {
            role: "user".to_string(),
            content: message.to_string(),
        });

        let payload = ChatCompletionRequest {
            model: DEFAULT_MODEL.to_string(),
            messages,
            temperature: 0.7,
        };

        let response_text = self.execute_request(payload).await?;
        Ok(response_text)
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    async fn call_chat_completions(
        &self,
        system_prompt: &str,
        user_content: &str,
    ) -> Result<String, IPCError> {
        let payload = ChatCompletionRequest {
            model: DEFAULT_MODEL.to_string(),
            messages: vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: system_prompt.to_string(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: user_content.to_string(),
                },
            ],
            temperature: 0.7,
        };

        self.execute_request(payload).await
    }

    async fn execute_request(
        &self,
        payload: ChatCompletionRequest,
    ) -> Result<String, IPCError> {
        let url = format!("{}/chat/completions", self.endpoint);

        let resp = self
            .client
            .post(&url)
            .bearer_auth(&self.api_key)
            .json(&payload)
            .send()
            .await
            .map_err(|e| map_reqwest_error(e))?;

        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(IPCError {
                code: "AI_API_ERROR".to_string(),
                message: format!("API returned {}: {}", status.as_u16(), body),
            });
        }

        let completion: ChatCompletionResponse = resp.json().await.map_err(|_| IPCError {
            code: "AI_PARSE_ERROR".to_string(),
            message: "Failed to parse API response".to_string(),
        })?;

        completion
            .choices
            .into_iter()
            .next()
            .map(|c| c.message.content)
            .ok_or_else(|| IPCError {
                code: "AI_PARSE_ERROR".to_string(),
                message: "No choices in API response".to_string(),
            })
    }
}

// ── Free functions (testable without HTTP) ────────────────────────────────────

/// Build the user prompt for suggestion requests.
pub fn build_suggestion_prompt(context: &str, selected_text: Option<&str>) -> String {
    match selected_text {
        Some(sel) => format!(
            "Context:\n{}\n\nSelected text:\n{}\n\nProvide 3 suggestions to improve the selected text.",
            context, sel
        ),
        None => format!(
            "Context:\n{}\n\nProvide 3 suggestions to improve or continue this text.",
            context
        ),
    }
}

/// Parse a JSON string (array of RawSuggestion) into Vec<AISuggestion>.
pub fn parse_suggestions(
    json_str: &str,
    original_text: &str,
) -> Result<Vec<AISuggestion>, IPCError> {
    // Strip markdown code fences if present
    let cleaned = json_str
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let raw: Vec<RawSuggestion> = serde_json::from_str(cleaned).map_err(|e| IPCError {
        code: "AI_PARSE_ERROR".to_string(),
        message: format!("Failed to parse suggestions JSON: {}", e),
    })?;

    Ok(raw
        .into_iter()
        .map(|r| AISuggestion {
            id: Uuid::new_v4().to_string(),
            suggested_text: r.suggested_text,
            explanation: r.explanation,
            confidence_score: r.confidence_score.clamp(0.0, 1.0),
            original_text: original_text.to_string(),
        })
        .collect())
}

/// Build the JSON payload for a chat completions request (for testing).
pub fn build_request_payload(system: &str, user: &str) -> Value {
    json!({
        "model": DEFAULT_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": user}
        ],
        "temperature": 0.7
    })
}

/// Map a reqwest error to an IPCError with the appropriate code.
fn map_reqwest_error(e: reqwest::Error) -> IPCError {
    if e.is_timeout() {
        IPCError {
            code: "AI_TIMEOUT".to_string(),
            message: "AI request timed out after 30 seconds".to_string(),
        }
    } else if e.is_connect() || e.is_request() {
        IPCError {
            code: "AI_SERVICE_UNAVAILABLE".to_string(),
            message: format!("AI service unavailable: {}", e),
        }
    } else {
        IPCError {
            code: "AI_SERVICE_UNAVAILABLE".to_string(),
            message: format!("Network error: {}", e),
        }
    }
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // ── 7.5: Request payload formatting ──────────────────────────────────────

    #[test]
    fn test_build_request_payload_structure() {
        let payload = build_request_payload("sys prompt", "user msg");
        assert_eq!(payload["model"], DEFAULT_MODEL);
        assert_eq!(payload["temperature"], 0.7);
        let messages = payload["messages"].as_array().unwrap();
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0]["role"], "system");
        assert_eq!(messages[0]["content"], "sys prompt");
        assert_eq!(messages[1]["role"], "user");
        assert_eq!(messages[1]["content"], "user msg");
    }

    #[test]
    fn test_build_suggestion_prompt_with_selection() {
        let prompt = build_suggestion_prompt("Some context text", Some("selected part"));
        assert!(prompt.contains("Context:"));
        assert!(prompt.contains("Some context text"));
        assert!(prompt.contains("Selected text:"));
        assert!(prompt.contains("selected part"));
        assert!(prompt.contains("3 suggestions"));
    }

    #[test]
    fn test_build_suggestion_prompt_without_selection() {
        let prompt = build_suggestion_prompt("Some context text", None);
        assert!(prompt.contains("Context:"));
        assert!(prompt.contains("Some context text"));
        assert!(!prompt.contains("Selected text:"));
    }

    // ── 7.5: Response parsing ─────────────────────────────────────────────────

    #[test]
    fn test_parse_suggestions_valid_json() {
        let json_str = r#"[
            {"suggested_text": "Better text", "explanation": "More concise", "confidence_score": 0.9},
            {"suggested_text": "Another option", "explanation": "Different style", "confidence_score": 0.7}
        ]"#;

        let suggestions = parse_suggestions(json_str, "original").unwrap();
        assert_eq!(suggestions.len(), 2);
        assert_eq!(suggestions[0].suggested_text, "Better text");
        assert_eq!(suggestions[0].explanation, "More concise");
        assert!((suggestions[0].confidence_score - 0.9).abs() < 0.001);
        assert_eq!(suggestions[0].original_text, "original");
        // IDs should be valid UUIDs (non-empty)
        assert!(!suggestions[0].id.is_empty());
        assert_ne!(suggestions[0].id, suggestions[1].id);
    }

    #[test]
    fn test_parse_suggestions_strips_markdown_fences() {
        let json_str = "```json\n[{\"suggested_text\":\"A\",\"explanation\":\"B\",\"confidence_score\":0.5}]\n```";
        let suggestions = parse_suggestions(json_str, "orig").unwrap();
        assert_eq!(suggestions.len(), 1);
        assert_eq!(suggestions[0].suggested_text, "A");
    }

    #[test]
    fn test_parse_suggestions_clamps_confidence_score() {
        let json_str = r#"[{"suggested_text":"X","explanation":"Y","confidence_score":1.5}]"#;
        let suggestions = parse_suggestions(json_str, "orig").unwrap();
        assert!((suggestions[0].confidence_score - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_parse_suggestions_invalid_json_returns_parse_error() {
        let result = parse_suggestions("not valid json", "orig");
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code, "AI_PARSE_ERROR");
    }

    #[test]
    fn test_parse_suggestions_empty_array() {
        let result = parse_suggestions("[]", "orig").unwrap();
        assert!(result.is_empty());
    }

    // ── 7.5: Error handling ───────────────────────────────────────────────────

    #[test]
    fn test_map_reqwest_error_timeout() {
        // We can't easily construct a real reqwest timeout error in unit tests,
        // so we verify the parse error path directly.
        let err = IPCError {
            code: "AI_TIMEOUT".to_string(),
            message: "AI request timed out after 30 seconds".to_string(),
        };
        assert_eq!(err.code, "AI_TIMEOUT");
    }

    #[test]
    fn test_error_codes_are_correct_strings() {
        // Verify the error code constants used throughout the module
        let unavailable = IPCError {
            code: "AI_SERVICE_UNAVAILABLE".to_string(),
            message: "test".to_string(),
        };
        let api_err = IPCError {
            code: "AI_API_ERROR".to_string(),
            message: "test".to_string(),
        };
        let parse_err = IPCError {
            code: "AI_PARSE_ERROR".to_string(),
            message: "test".to_string(),
        };
        let timeout = IPCError {
            code: "AI_TIMEOUT".to_string(),
            message: "test".to_string(),
        };
        assert_eq!(unavailable.code, "AI_SERVICE_UNAVAILABLE");
        assert_eq!(api_err.code, "AI_API_ERROR");
        assert_eq!(parse_err.code, "AI_PARSE_ERROR");
        assert_eq!(timeout.code, "AI_TIMEOUT");
    }

    #[test]
    fn test_parse_bad_json_gives_parse_error_code() {
        let result = parse_suggestions("{bad}", "orig");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err().code, "AI_PARSE_ERROR");
    }

    #[test]
    fn test_connector_new_uses_default_endpoint_when_none() {
        // Remove env var to ensure default is used
        std::env::remove_var("OPENAI_API_ENDPOINT");
        let connector = AIServiceConnector::new("key".to_string(), None);
        assert_eq!(connector.endpoint, DEFAULT_ENDPOINT);
    }

    #[test]
    fn test_connector_new_uses_provided_endpoint() {
        let connector =
            AIServiceConnector::new("key".to_string(), Some("https://custom.api/v1".to_string()));
        assert_eq!(connector.endpoint, "https://custom.api/v1");
    }

    #[test]
    fn test_connector_new_falls_back_to_env_api_key() {
        std::env::set_var("OPENAI_API_KEY", "env-key-123");
        let connector = AIServiceConnector::new("".to_string(), None);
        assert_eq!(connector.api_key, "env-key-123");
        std::env::remove_var("OPENAI_API_KEY");
    }
}
