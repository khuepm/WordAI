# Requirements Document: WordAI Text Editor

## Introduction

WordAI là một ứng dụng desktop text editor hiện đại được xây dựng trên nền tảng Tauri (Rust backend) và React (TypeScript frontend), tích hợp AI assistant AuraSphere. Ứng dụng tuân theo triết lý "The Ethereal Editor" - một trải nghiệm soạn thảo tập trung vào nội dung (focus-first writing experience), nơi công cụ biến mất để lại không gian cho sáng tạo.

Hệ thống cung cấp ba màn hình chính: Editor Canvas với AI Assistant Panel, Negotiation Panel để so sánh và chấp nhận đề xuất AI, và Render-on-Demand Drawer cho việc xuất bản và định dạng tài liệu. Design system sử dụng glassmorphism effects, tonal shifts thay vì hard borders, và typography cao cấp (Newsreader serif cho nội dung, Manrope sans-serif cho UI).

## Glossary

- **Editor_Canvas**: Màn hình soạn thảo chính với typography cao cấp và trải nghiệm minimal
- **AuraSphere_Panel**: AI assistant sidebar với chat interface và suggestion cards
- **Negotiation_Panel**: Modal để so sánh và chấp nhận đề xuất AI
- **Render_Drawer**: Export panel với templates và formatting options
- **Document**: Đối tượng chứa nội dung văn bản, metadata, và version information
- **Text_Selection**: Vùng văn bản được chọn bởi người dùng (start position, end position, text content)
- **AI_Suggestion**: Đề xuất từ AI service bao gồm suggested text, explanation, và confidence score
- **IPC_Bridge**: Tauri Inter-Process Communication layer kết nối frontend và backend
- **File_System_Manager**: Rust backend service quản lý file operations
- **Document_Store**: Rust backend service quản lý document persistence
- **PDF_Export_Engine**: Rust backend service xử lý PDF generation
- **AI_Service_Connector**: Rust backend service kết nối với external LLM APIs

## Requirements

### Requirement 1: Document Creation and Management

**User Story:** Là một writer, tôi muốn tạo và quản lý documents, để tôi có thể tổ chức nội dung viết của mình.

#### Acceptance Criteria

1. WHEN a user creates a new document, THE Editor_Canvas SHALL initialize an empty document with a unique ID, timestamp, and default metadata
2. WHEN a user opens an existing document, THE File_System_Manager SHALL load the document content and metadata from local storage
3. WHEN a document is loaded, THE Editor_Canvas SHALL display the document content with Newsreader font typography
4. WHEN a user types text, THE Editor_Canvas SHALL update the document content in real-time
5. THE Document_Store SHALL maintain document version numbers and increment them on each save operation

### Requirement 2: Auto-Save Functionality

**User Story:** Là một writer, tôi muốn documents được tự động lưu, để tôi không mất nội dung khi có sự cố.

#### Acceptance Criteria

1. WHEN a user modifies document content, THE Editor_Canvas SHALL trigger an auto-save operation after 2 seconds of inactivity
2. WHEN an auto-save is triggered, THE IPC_Bridge SHALL send the document data to the File_System_Manager
3. WHEN the File_System_Manager receives save request, THE File_System_Manager SHALL persist the document to local storage
4. WHEN a save operation completes successfully, THE Editor_Canvas SHALL update the lastModified timestamp
5. IF a save operation fails, THEN THE Editor_Canvas SHALL display an error notification and retry after 5 seconds

### Requirement 3: Text Selection and Cursor Management

**User Story:** Là một writer, tôi muốn select và navigate text dễ dàng, để tôi có thể edit hiệu quả.

#### Acceptance Criteria

1. WHEN a user clicks in the editor, THE Editor_Canvas SHALL position the cursor at the clicked location
2. WHEN a user drags to select text, THE Editor_Canvas SHALL create a Text_Selection object with start position, end position, and selected text
3. WHEN a text selection exists, THE Editor_Canvas SHALL highlight the selected text with a subtle background color
4. WHEN a user presses keyboard shortcuts (Cmd+A), THE Editor_Canvas SHALL select all document content
5. THE Editor_Canvas SHALL maintain cursor position across document saves and reloads

### Requirement 4: Document Metadata Display

**User Story:** Là một writer, tôi muốn xem document statistics, để tôi có thể track progress của mình.

#### Acceptance Criteria

1. WHEN document content changes, THE Editor_Canvas SHALL recalculate word count in real-time
2. WHEN document content changes, THE Editor_Canvas SHALL recalculate estimated reading time based on 200 words per minute
3. THE Editor_Canvas SHALL display word count and reading time in the UI
4. THE Editor_Canvas SHALL display last modified timestamp in human-readable format
5. WHERE a document has tags, THE Editor_Canvas SHALL display the tags in the metadata section

### Requirement 5: AI Assistant Trigger

**User Story:** Là một writer, tôi muốn trigger AI assistant, để tôi có thể nhận suggestions cho nội dung của mình.

#### Acceptance Criteria

1. WHEN a user presses Cmd+K, THE Editor_Canvas SHALL trigger the AI assistant with current text selection or cursor context
2. WHEN AI is triggered with a text selection, THE Editor_Canvas SHALL pass the Text_Selection object to the AuraSphere_Panel
3. WHEN AI is triggered without selection, THE Editor_Canvas SHALL pass the current paragraph or sentence as context
4. WHEN AI is triggered, THE AuraSphere_Panel SHALL open with a smooth slide-in animation
5. WHILE the AuraSphere_Panel is open, THE Editor_Canvas SHALL adjust its width to accommodate the panel

### Requirement 6: AI Suggestion Request

**User Story:** Là một writer, tôi muốn request AI suggestions, để tôi có thể improve nội dung của mình.

#### Acceptance Criteria

1. WHEN a user submits an AI request, THE AuraSphere_Panel SHALL display a loading indicator
2. WHEN an AI request is submitted, THE IPC_Bridge SHALL forward the request with document context to the AI_Service_Connector
3. WHEN the AI_Service_Connector receives a request, THE AI_Service_Connector SHALL call the external LLM API with appropriate context
4. WHEN the LLM API returns suggestions, THE AI_Service_Connector SHALL parse the response into AI_Suggestion objects
5. WHEN AI_Suggestion objects are received, THE AuraSphere_Panel SHALL display them as suggestion cards

### Requirement 7: AI Suggestion Display

**User Story:** Là một writer, tôi muốn xem AI suggestions clearly, để tôi có thể evaluate chúng dễ dàng.

#### Acceptance Criteria

1. WHEN AI suggestions are displayed, THE AuraSphere_Panel SHALL show each suggestion as a card with suggested text and explanation
2. WHERE a suggestion has a confidence score, THE AuraSphere_Panel SHALL display the confidence level visually
3. WHEN multiple suggestions are available, THE AuraSphere_Panel SHALL display them in order of confidence score
4. WHEN a user hovers over a suggestion card, THE AuraSphere_Panel SHALL highlight the card with a subtle glow effect
5. THE AuraSphere_Panel SHALL use Manrope sans-serif font for all UI text

### Requirement 8: Negotiation Panel for Suggestion Comparison

**User Story:** Là một writer, tôi muốn compare original text với AI suggestions, để tôi có thể make informed decisions.

#### Acceptance Criteria

1. WHEN a user clicks on a suggestion card, THE AuraSphere_Panel SHALL open the Negotiation_Panel as a modal
2. WHEN the Negotiation_Panel opens, THE Negotiation_Panel SHALL display original text on the left side
3. WHEN the Negotiation_Panel opens, THE Negotiation_Panel SHALL display suggested text on the right side
4. WHEN displaying text comparison, THE Negotiation_Panel SHALL highlight differences between original and suggested text
5. THE Negotiation_Panel SHALL provide Accept, Reject, and Edit buttons for user action

### Requirement 9: Suggestion Acceptance

**User Story:** Là một writer, tôi muốn accept AI suggestions, để tôi có thể incorporate chúng vào document của mình.

#### Acceptance Criteria

1. WHEN a user clicks Accept in the Negotiation_Panel, THE Negotiation_Panel SHALL close and apply the suggested text to the document
2. WHEN a suggestion is accepted, THE Editor_Canvas SHALL replace the original text with the suggested text
3. WHEN text is replaced, THE Editor_Canvas SHALL maintain proper cursor position after the replaced text
4. WHEN a suggestion is accepted, THE Document_Store SHALL increment the document version number
5. WHEN a suggestion is accepted, THE Editor_Canvas SHALL trigger an auto-save operation

### Requirement 10: Suggestion Rejection and Editing

**User Story:** Là một writer, tôi muốn reject hoặc edit AI suggestions, để tôi có thể maintain control over nội dung của mình.

#### Acceptance Criteria

1. WHEN a user clicks Reject in the Negotiation_Panel, THE Negotiation_Panel SHALL close without modifying the document
2. WHEN a user clicks Edit in the Negotiation_Panel, THE Negotiation_Panel SHALL enable inline editing of the suggested text
3. WHEN a user edits suggested text, THE Negotiation_Panel SHALL update the preview in real-time
4. WHEN a user accepts edited text, THE Editor_Canvas SHALL apply the modified suggestion to the document
5. WHEN the Negotiation_Panel closes, THE AuraSphere_Panel SHALL remain open for additional suggestions


### Requirement 11: Render-on-Demand Export

**User Story:** Là một writer, tôi muốn export documents sang different formats, để tôi có thể share và publish nội dung của mình.

#### Acceptance Criteria

1. WHEN a user triggers export action, THE Editor_Canvas SHALL open the Render_Drawer as a slide-out panel
2. WHEN the Render_Drawer opens, THE Render_Drawer SHALL display available export templates (PDF, Markdown, HTML, DOCX)
3. WHEN a user selects an export format, THE Render_Drawer SHALL display format-specific options
4. WHERE PDF export is selected, THE Render_Drawer SHALL provide options for page size, margins, and typography settings
5. WHEN a user confirms export, THE IPC_Bridge SHALL send the export request to the appropriate backend service

### Requirement 12: PDF Export Generation

**User Story:** Là một writer, tôi muốn export documents sang PDF với professional formatting, để tôi có thể share polished content.

#### Acceptance Criteria

1. WHEN a PDF export is requested, THE PDF_Export_Engine SHALL receive the document content and formatting options
2. WHEN generating PDF, THE PDF_Export_Engine SHALL apply the selected typography settings (Newsreader font for content)
3. WHEN generating PDF, THE PDF_Export_Engine SHALL apply the specified page size and margin settings
4. WHEN PDF generation completes, THE PDF_Export_Engine SHALL save the file to the user-specified location
5. IF PDF generation fails, THEN THE Render_Drawer SHALL display an error message with details

### Requirement 13: File System Operations

**User Story:** Là một writer, tôi muốn save và load documents từ file system, để tôi có thể manage files của mình.

#### Acceptance Criteria

1. WHEN a save operation is requested, THE File_System_Manager SHALL write document data to the specified file path
2. WHEN a load operation is requested, THE File_System_Manager SHALL read document data from the specified file path
3. WHEN reading a file, THE File_System_Manager SHALL parse the file content into a Document object
4. WHEN writing a file, THE File_System_Manager SHALL serialize the Document object to the appropriate format
5. IF a file operation fails due to permissions, THEN THE File_System_Manager SHALL return a descriptive error message

### Requirement 14: Document Serialization and Deserialization

**User Story:** Là một developer, tôi muốn serialize và deserialize documents correctly, để data integrity được maintained.

#### Acceptance Criteria

1. WHEN serializing a document, THE Document_Store SHALL convert the Document object to JSON format
2. WHEN deserializing a document, THE Document_Store SHALL parse JSON data into a Document object
3. WHEN serializing, THE Document_Store SHALL include all document fields (id, title, content, metadata, version, lastModified)
4. WHEN deserializing, THE Document_Store SHALL validate that all required fields are present
5. IF deserialization fails due to invalid data, THEN THE Document_Store SHALL return a validation error

### Requirement 15: IPC Communication

**User Story:** Là một developer, tôi muốn reliable communication giữa frontend và backend, để application hoạt động correctly.

#### Acceptance Criteria

1. WHEN the frontend invokes an IPC command, THE IPC_Bridge SHALL serialize the command parameters
2. WHEN the backend receives an IPC command, THE IPC_Bridge SHALL deserialize the parameters and route to the appropriate service
3. WHEN a backend service completes an operation, THE IPC_Bridge SHALL serialize the result and return to the frontend
4. WHEN the frontend receives an IPC response, THE IPC_Bridge SHALL deserialize the result and update application state
5. IF an IPC command fails, THEN THE IPC_Bridge SHALL return an error object with error code and message

### Requirement 16: AI Service Error Handling

**User Story:** Là một writer, tôi muốn graceful error handling khi AI service fails, để tôi có thể continue working.

#### Acceptance Criteria

1. IF the LLM API is unavailable, THEN THE AI_Service_Connector SHALL return an error indicating service unavailability
2. IF the LLM API returns an error, THEN THE AI_Service_Connector SHALL parse the error and return a user-friendly message
3. WHEN an AI request times out after 30 seconds, THE AI_Service_Connector SHALL cancel the request and return a timeout error
4. WHEN an AI error occurs, THE AuraSphere_Panel SHALL display the error message to the user
5. WHEN an AI error occurs, THE AuraSphere_Panel SHALL provide a retry button for the user

### Requirement 17: UI State Management

**User Story:** Là một developer, tôi muốn consistent UI state management, để application behavior là predictable.

#### Acceptance Criteria

1. WHEN application state changes, THE State_Manager SHALL update all dependent UI components
2. WHEN a document is modified, THE State_Manager SHALL mark the document as having unsaved changes
3. WHEN an auto-save completes, THE State_Manager SHALL clear the unsaved changes flag
4. WHEN the AuraSphere_Panel opens, THE State_Manager SHALL update the isAIPanelOpen flag
5. WHEN the AuraSphere_Panel closes, THE State_Manager SHALL update the isAIPanelOpen flag and reset AI state

### Requirement 18: Glassmorphism Visual Effects

**User Story:** Là một writer, tôi muốn beautiful và calming UI, để tôi có thể focus on writing.

#### Acceptance Criteria

1. WHEN rendering UI panels, THE UI_Layer SHALL apply glassmorphism effects with backdrop blur
2. WHEN rendering panel backgrounds, THE UI_Layer SHALL use semi-transparent backgrounds with subtle gradients
3. WHEN rendering borders, THE UI_Layer SHALL use tonal shifts instead of hard borders
4. WHEN rendering shadows, THE UI_Layer SHALL apply ambient shadows for depth perception
5. THE UI_Layer SHALL maintain Material Design 3 color system consistency across all components

### Requirement 19: Typography System

**User Story:** Là một writer, tôi muốn premium typography, để reading experience là comfortable và professional.

#### Acceptance Criteria

1. WHEN rendering document content, THE Editor_Canvas SHALL use Newsreader serif font
2. WHEN rendering UI elements, THE UI_Layer SHALL use Manrope sans-serif font
3. WHEN rendering document content, THE Editor_Canvas SHALL apply appropriate line height (1.6-1.8) for readability
4. WHEN rendering document content, THE Editor_Canvas SHALL apply appropriate font size (16-18px base size)
5. THE Editor_Canvas SHALL support font size adjustment through user preferences

### Requirement 20: Animation and Transitions

**User Story:** Là một writer, tôi muốn smooth animations, để UI transitions không disrupt flow của tôi.

#### Acceptance Criteria

1. WHEN the AuraSphere_Panel opens, THE AuraSphere_Panel SHALL animate with a smooth slide-in transition over 300ms
2. WHEN the AuraSphere_Panel closes, THE AuraSphere_Panel SHALL animate with a smooth slide-out transition over 300ms
3. WHEN the Negotiation_Panel opens, THE Negotiation_Panel SHALL fade in with a backdrop blur over 200ms
4. WHEN the Render_Drawer opens, THE Render_Drawer SHALL slide up from the bottom over 250ms
5. WHEN suggestion cards appear, THE AuraSphere_Panel SHALL stagger the card animations for visual polish

### Requirement 21: Keyboard Shortcuts

**User Story:** Là một writer, tôi muốn keyboard shortcuts, để tôi có thể work efficiently without using mouse.

#### Acceptance Criteria

1. WHEN a user presses Cmd+K (or Ctrl+K on Windows), THE Editor_Canvas SHALL trigger the AI assistant
2. WHEN a user presses Cmd+S (or Ctrl+S on Windows), THE Editor_Canvas SHALL trigger a manual save operation
3. WHEN a user presses Cmd+E (or Ctrl+E on Windows), THE Editor_Canvas SHALL open the Render_Drawer
4. WHEN a user presses Escape, THE application SHALL close any open modal or panel
5. WHEN a user presses Cmd+A (or Ctrl+A on Windows), THE Editor_Canvas SHALL select all document content

### Requirement 22: Document Version Control

**User Story:** Là một writer, tôi muốn track document versions, để tôi có thể revert changes nếu cần.

#### Acceptance Criteria

1. WHEN a document is created, THE Document_Store SHALL initialize version number to 1
2. WHEN a document is saved, THE Document_Store SHALL increment the version number
3. WHEN a document is loaded, THE Document_Store SHALL include version information in the Document object
4. THE Document_Store SHALL maintain version history for the last 10 versions
5. WHERE version history exists, THE Editor_Canvas SHALL provide a version history UI for browsing past versions

### Requirement 23: Chat Interface in AuraSphere Panel

**User Story:** Là một writer, tôi muốn chat với AI assistant, để tôi có thể ask questions và get guidance.

#### Acceptance Criteria

1. WHEN the AuraSphere_Panel is open, THE AuraSphere_Panel SHALL display a chat input field at the bottom
2. WHEN a user types a message and presses Enter, THE AuraSphere_Panel SHALL send the message to the AI_Service_Connector
3. WHEN a chat message is sent, THE AuraSphere_Panel SHALL display the user message in the chat history
4. WHEN the AI responds, THE AuraSphere_Panel SHALL display the AI response in the chat history
5. THE AuraSphere_Panel SHALL maintain chat history for the current session

### Requirement 24: Suggestion Card Interaction

**User Story:** Là một writer, tôi muốn interact với suggestion cards easily, để tôi có thể quickly evaluate options.

#### Acceptance Criteria

1. WHEN a user hovers over a suggestion card, THE AuraSphere_Panel SHALL apply a subtle glow effect to the card
2. WHEN a user clicks a suggestion card, THE AuraSphere_Panel SHALL open the Negotiation_Panel with that suggestion
3. WHEN a user dismisses a suggestion card, THE AuraSphere_Panel SHALL remove the card with a fade-out animation
4. WHERE multiple suggestions exist, THE AuraSphere_Panel SHALL allow keyboard navigation (arrow keys) between cards
5. WHEN a suggestion card is focused via keyboard, THE AuraSphere_Panel SHALL apply the same visual feedback as hover

### Requirement 25: Application Initialization

**User Story:** Là một writer, tôi muốn application start quickly, để tôi có thể begin writing immediately.

#### Acceptance Criteria

1. WHEN the application starts, THE application SHALL initialize the Tauri window within 1 second
2. WHEN the application starts, THE application SHALL load the last opened document if one exists
3. WHEN the application starts, THE application SHALL initialize the Editor_Canvas with default empty document if no previous document exists
4. WHEN the application starts, THE application SHALL verify AI service connectivity in the background
5. IF AI service is unavailable at startup, THEN THE application SHALL display a warning but allow editing to continue

