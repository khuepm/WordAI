# Requirements Document

## Introduction

The Library Tab is a dedicated view within the WordAI desktop editor (Tauri + React) that serves as the central hub for managing AuraSphere intent documents. It replaces the currently static "Library" navigation link in the TopNavBar with a fully functional view that allows users to browse, search, filter, create, open, import, and delete AuraSphere intent documents stored in AuraBrain. The Library Tab integrates with the existing navigation model (Drafts / Archive / Library) and the AuraBrain Tauri backend (`list_intents`, `get_intent`, `sync_intent`, `delete_intent` IPC commands).

## Glossary

- **AuraBrain**: The Rust/Tauri backend storage engine responsible for persisting AuraSphere intent documents locally.
- **AuraIntentDocument**: The canonical document format used by WordAI, consisting of `id`, `intent_name`, `content: AuraDocumentBlock[]`, `version`, `created_at`, and `updated_at`.
- **AuraIntentSummary**: A lightweight summary of an intent document containing `id`, `intent_name`, `created_at`, `updated_at`, and `version`, returned by `list_intents`.
- **Library_View**: The full-screen view rendered when the user activates the Library tab in the TopNavBar.
- **Library_Card**: A grid card component that displays metadata for a single AuraIntentSummary in the Library_View.
- **Document_Grid**: The scrollable grid layout within Library_View that renders Library_Cards.
- **Search_Bar**: The text input component in Library_View used to filter documents by name.
- **Filter_Chip**: A selectable tag button in Library_View used to filter documents by category or status.
- **Import_Service**: The existing `importFile` function in `exportService.ts` that converts DOCX, TXT, and MD files into AuraIntentDocument format.
- **Editor_View**: The main document editing view (currently the only view in App.tsx), containing the EditorCanvas and associated panels.
- **TopNavBar**: The fixed top navigation bar containing the Drafts, Archive, and Library tab links.
- **Active_Tab**: The currently selected tab in the TopNavBar, determining which view is rendered.
- **Confirmation_Dialog**: A modal dialog that requires explicit user confirmation before a destructive action is executed.

## Requirements

---

### Requirement 1: Library Tab Navigation

**User Story:** As a user, I want to click the Library tab in the top navigation bar so that I can switch between the Editor view and the Library view without losing my current document state.

#### Acceptance Criteria

1. WHEN the user clicks the "Library" link in the TopNavBar, THE Library_View SHALL render as the primary content area, replacing the Editor_View.
2. WHEN the user clicks the "Drafts" link in the TopNavBar while Library_View is active, THE Editor_View SHALL render as the primary content area, restoring the previously loaded document.
3. WHILE Library_View is active, THE TopNavBar SHALL display the "Library" tab link with the active visual style (bold weight, primary color underline) and the "Drafts" tab link with the inactive visual style.
4. WHILE Editor_View is active, THE TopNavBar SHALL display the "Drafts" tab link with the active visual style and the "Library" tab link with the inactive visual style.
5. THE Library_View SHALL preserve the TopNavBar, left sidebar, and all global UI chrome when rendered.

---

### Requirement 2: Display Document List

**User Story:** As a user, I want to see all my saved AuraSphere documents in the Library so that I can quickly find and access my work.

#### Acceptance Criteria

1. WHEN Library_View is rendered, THE Library_View SHALL invoke the `list_intents` AuraBrain IPC command to retrieve all AuraIntentSummary records.
2. WHEN `list_intents` returns a non-empty array, THE Document_Grid SHALL render one Library_Card per AuraIntentSummary, sorted by `updated_at` descending.
3. WHEN `list_intents` returns an empty array, THE Library_View SHALL display an empty-state message indicating no documents exist and prompting the user to create or import one.
4. WHILE the `list_intents` IPC call is in progress, THE Library_View SHALL display a loading indicator in place of the Document_Grid.
5. IF the `list_intents` IPC call fails, THEN THE Library_View SHALL display an error message describing the failure and a retry button.
6. THE Library_Card SHALL display the `intent_name`, a human-readable relative timestamp derived from `updated_at` (e.g., "Updated 2h ago"), and the document `version` number.
7. THE Library_Card SHALL display a document type icon appropriate to the AuraIntentDocument content.

---

### Requirement 3: Create New Document

**User Story:** As a user, I want to create a new blank document from the Library so that I can start writing without leaving the Library context.

#### Acceptance Criteria

1. THE Library_View SHALL display a "New Document" button that is always visible and accessible.
2. WHEN the user activates the "New Document" button, THE Library_View SHALL create a new in-memory AuraIntentDocument with a generated UUID, a default `intent_name` of "Untitled Intent", an empty `content` array, and `version` 1.
3. WHEN the new AuraIntentDocument is created, THE Editor_View SHALL become the Active_Tab, loading the new document into the EditorCanvas.
4. WHEN the new AuraIntentDocument is created, THE TopNavBar SHALL switch the Active_Tab indicator to "Drafts".

---

### Requirement 4: Open Document from Library

**User Story:** As a user, I want to open a document from the Library so that I can continue editing it in the editor.

#### Acceptance Criteria

1. WHEN the user clicks a Library_Card, THE Library_View SHALL invoke the `get_intent` AuraBrain IPC command with the corresponding `id`.
2. WHEN `get_intent` returns a valid AuraIntentDocument, THE Editor_View SHALL become the Active_Tab, loading the returned document into the EditorCanvas.
3. WHEN the document is loaded into the EditorCanvas, THE TopNavBar SHALL switch the Active_Tab indicator to "Drafts".
4. WHEN the document is loaded into the EditorCanvas, THE application SHALL store the document `id` in `localStorage` under the key `wordai_last_intent_id`.
5. IF the `get_intent` IPC call fails, THEN THE Library_View SHALL display an inline error message on the corresponding Library_Card and SHALL NOT navigate away from Library_View.
6. WHILE the `get_intent` IPC call is in progress for a card, THE Library_Card SHALL display a loading state indicator.

---

### Requirement 5: Open File from File System

**User Story:** As a user, I want to browse my file system and open a traditional document file so that I can import it into my Library as an AuraSphere document.

#### Acceptance Criteria

1. THE Library_View SHALL display an "Open File" button that opens the native OS file picker dialog.
2. WHEN the user activates the "Open File" button, THE Library_View SHALL invoke the native file picker restricted to files with extensions `.docx`, `.txt`, and `.md`.
3. WHEN the user selects a file and confirms the dialog, THE Library_View SHALL pass the selected file path to the Import_Service for conversion.
4. WHEN the user dismisses the file picker without selecting a file, THE Library_View SHALL remain in its current state with no error displayed.
5. WHILE the Import_Service is processing the selected file, THE Library_View SHALL display a progress indicator and disable the "Open File" button.
6. IF the Import_Service returns an error for the selected file, THEN THE Library_View SHALL display an error message describing the failure without navigating away.

---

### Requirement 6: Convert and Save Imported Document

**User Story:** As a user, I want imported traditional documents to be automatically converted to AuraSphere format and saved to AuraBrain so that they appear in my Library and are available for editing.

#### Acceptance Criteria

1. WHEN the Import_Service successfully converts a file, THE Library_View SHALL invoke the `sync_intent` AuraBrain IPC command to persist the resulting AuraIntentDocument.
2. WHEN `sync_intent` succeeds, THE Document_Grid SHALL refresh to include the newly imported document as a Library_Card.
3. WHEN `sync_intent` succeeds, THE Editor_View SHALL become the Active_Tab, loading the imported document into the EditorCanvas.
4. WHEN the imported document is loaded into the EditorCanvas, THE TopNavBar SHALL switch the Active_Tab indicator to "Drafts".
5. IF the Import_Service produces conversion warnings, THEN THE Library_View SHALL display the warnings as a non-blocking notification before navigating to the Editor_View.
6. WHEN a file with the same `intent_name` already exists in AuraBrain, THE Library_View SHALL display a Confirmation_Dialog offering the user the choice to update the existing document or create a new one.
7. WHEN the user selects "Update" in the Confirmation_Dialog, THE Library_View SHALL invoke `sync_intent` with the existing document's `id`.
8. WHEN the user selects "Create New" in the Confirmation_Dialog, THE Library_View SHALL invoke `sync_intent` with a newly generated UUID.
9. WHEN the user cancels the Confirmation_Dialog, THE Library_View SHALL remain in its current state and SHALL NOT persist the imported document.

---

### Requirement 7: Search Documents

**User Story:** As a user, I want to search for documents by name in the Library so that I can quickly locate a specific document among many.

#### Acceptance Criteria

1. THE Library_View SHALL display a Search_Bar that accepts free-text input.
2. WHEN the user types in the Search_Bar, THE Document_Grid SHALL update within 300ms to display only Library_Cards whose `intent_name` contains the search query as a case-insensitive substring.
3. WHEN the Search_Bar is empty, THE Document_Grid SHALL display all Library_Cards without filtering.
4. WHEN the search query matches zero documents, THE Document_Grid SHALL display an empty-state message indicating no results were found for the query.
5. THE Search_Bar SHALL display a clear button when the input is non-empty; WHEN the user activates the clear button, THE Search_Bar SHALL reset to empty and THE Document_Grid SHALL display all Library_Cards.

---

### Requirement 8: Filter Documents by Category

**User Story:** As a user, I want to filter documents by category using filter chips so that I can narrow down the list to a specific type of content.

#### Acceptance Criteria

1. THE Library_View SHALL display a row of Filter_Chips with at minimum the following labels: "All", "Documents", "AI-ready".
2. WHEN the user activates a Filter_Chip, THE Document_Grid SHALL update to display only Library_Cards matching the selected filter category.
3. WHEN the "All" Filter_Chip is active, THE Document_Grid SHALL display all Library_Cards regardless of category.
4. WHEN a non-"All" Filter_Chip is active, THE Filter_Chip SHALL render with the active visual style (primary color background and border).
5. WHEN the user activates the "All" Filter_Chip, THE Library_View SHALL deactivate all other Filter_Chips and display all Library_Cards.
6. THE Library_View SHALL apply Search_Bar filtering and Filter_Chip filtering simultaneously, displaying only Library_Cards that satisfy both conditions.

---

### Requirement 9: Delete Document

**User Story:** As a user, I want to delete a document from the Library so that I can remove content I no longer need.

#### Acceptance Criteria

1. THE Library_Card SHALL expose a delete action accessible via a hover action button or a context menu.
2. WHEN the user activates the delete action on a Library_Card, THE Library_View SHALL display a Confirmation_Dialog asking the user to confirm permanent deletion of the document.
3. WHEN the user confirms deletion in the Confirmation_Dialog, THE Library_View SHALL invoke the `delete_intent` AuraBrain IPC command with the document's `id`.
4. WHEN `delete_intent` succeeds, THE Document_Grid SHALL remove the corresponding Library_Card without requiring a full page reload.
5. WHEN the user cancels the Confirmation_Dialog, THE Library_View SHALL remain in its current state and SHALL NOT invoke `delete_intent`.
6. IF the `delete_intent` IPC call fails, THEN THE Library_View SHALL display an error message and SHALL retain the Library_Card in the Document_Grid.
7. WHEN the document being deleted is the currently loaded document in the EditorCanvas, THE Library_View SHALL reset the EditorCanvas to a new blank document after successful deletion.

---

### Requirement 10: Library View Layout and Accessibility

**User Story:** As a user, I want the Library view to be visually consistent with the rest of the application and accessible via keyboard so that I can use it efficiently.

#### Acceptance Criteria

1. THE Library_View SHALL render the Document_Grid in a responsive grid layout with a minimum of 1 column and a maximum of 3 columns, adjusting based on available viewport width.
2. THE Library_View SHALL be fully navigable using keyboard Tab and Enter keys, with all interactive elements (Library_Cards, buttons, Search_Bar, Filter_Chips) reachable via keyboard focus.
3. THE Library_Card SHALL provide a visible focus indicator when focused via keyboard navigation.
4. THE Search_Bar SHALL receive keyboard focus automatically when Library_View becomes the Active_Tab.
5. THE Library_View SHALL use ARIA landmark roles (`main`, `search`, `region`) and ARIA labels on interactive elements to support screen readers.
6. THE Library_View SHALL apply the application's existing CSS design tokens (`--md-sys-color-*`, `--font-family-ui`, `--radius-*`) for visual consistency with the Editor_View.
