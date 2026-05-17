# Requirements Document

## Introduction

The Archive Management feature provides a dedicated full-screen view within the WordAI desktop editor (Tauri + React) for managing archived documents — including old versions, paused projects, and inactive drafts. The Archive view is accessible via the "Archive" tab in the TopNavBar and presents a bento-grid layout with AI-powered review suggestions, version history browsing, and paused project folders. Users can search, filter, restore, compare, and permanently delete archived items. A right-side drawer overlay provides detailed metadata, AI summaries, and contextual actions for individual archived items. The feature integrates with the existing AuraBrain backend and the AuraSphere AI system for intelligent archival suggestions.

## Glossary

- **Archive_View**: The full-screen view rendered when the user activates the Archive tab in the TopNavBar, replacing the Editor_View or Library_View.
- **Archive_Item**: A document or project that has been moved to the archive. Contains metadata including archived date, reason, related current file, and AI-accessible memory flag.
- **Archive_Sidebar**: The left navigation panel within the Archive_View containing category links (Drafts, Projects, Versions, Trash) and a "New Entry" button.
- **Archive_Search_Bar**: The large search input in the Archive_View header area used to filter archived items by name, content, or metadata.
- **Suggestion_Card**: An AI-powered card in the "Suggested to Review" section that highlights archived items relevant to the user's current active work.
- **Version_List_Item**: A row component in the "Old Versions" section displaying a single archived document version with metadata and quick actions.
- **Paused_Project_Card**: A folder card in the "Paused Projects" section representing a collection of archived documents grouped as a project.
- **Detail_Drawer**: A right-side overlay panel that displays full metadata, AI summary, memory access toggle, and action buttons for a selected Archive_Item.
- **Memory_Access_Toggle**: A switch control in the Detail_Drawer that enables or disables AuraSphere AI from referencing the archived item when generating content.
- **AuraBrain**: The Rust/Tauri backend storage engine responsible for persisting archived documents locally.
- **AuraSphere**: The AI assistant system that can reference archived items for context when generating content.
- **Bento_Grid**: The asymmetric grid layout used in the Archive_View main content area (4-column left + 8-column right on desktop).
- **Scrim**: The semi-transparent backdrop overlay displayed behind the Detail_Drawer when it is open.

## Requirements

---

### Requirement 1: Archive Tab Navigation

**User Story:** As a user, I want to click the Archive tab in the top navigation bar so that I can switch to the Archive view and manage my archived documents.

#### Acceptance Criteria

1. WHEN the user clicks the "Archive" link in the TopNavBar, THE Archive_View SHALL render as the primary content area, replacing the Editor_View or Library_View, within 200 milliseconds of the click event.
2. WHEN the user clicks the "Drafts" link in the TopNavBar while Archive_View is active, THE Editor_View SHALL render as the primary content area displaying the document that was loaded prior to navigating to Archive_View.
3. WHILE Archive_View is active, THE TopNavBar SHALL display the "Archive" tab link with the active visual style (font-weight 600, primary color text, 2px solid bottom border in primary color).
4. WHILE Archive_View is active, THE TopNavBar SHALL display all other tab links (Drafts, Library) with the inactive visual style (font-weight 400, secondary text color, transparent bottom border).
5. THE Archive_View SHALL preserve the TopNavBar, left sidebar, and all global UI chrome when rendered.
6. IF the user navigates to Archive_View while the current document has unsaved changes, THEN THE system SHALL retain the unsaved document state in memory so that returning to Editor_View restores the document with unsaved changes intact.
7. WHEN the user clicks the "Library" link in the TopNavBar while Archive_View is active, THE Library_View SHALL render as the primary content area, replacing the Archive_View.

---

### Requirement 2: Archive View Layout

**User Story:** As a user, I want the Archive view to present a clear, organized layout so that I can easily navigate between different categories of archived content.

#### Acceptance Criteria

1. THE Archive_View SHALL render a left sidebar (Archive_Sidebar) with a fixed width of 288px containing navigation links for Drafts, Projects, Versions, and Trash categories.
2. THE Archive_Sidebar SHALL display a "New Entry" button spanning the full sidebar width with primary color background, centered text, and an add icon positioned to the left of the label.
3. THE Archive_Sidebar SHALL highlight the currently active category link with a white background, primary color text, bold font weight, and a box shadow of 0 2px 8px rgba(0, 0, 0, 0.08).
4. THE Archive_View main content area SHALL display a header section containing the title "Archive" in font-headline at 3rem size with font-extrabold weight.
5. THE Archive_View header SHALL display a subtitle in font-body at 1.25rem with a maximum length of 120 characters describing the archive's purpose.
6. THE Archive_View main content area SHALL use a 12-column grid layout on desktop viewports (lg breakpoint: 1024px and above) with an 8px gap between grid cells.
7. WHEN the viewport width is below the lg breakpoint (1024px), THE Bento_Grid SHALL collapse to a single-column stacked layout.
8. WHEN the viewport width is below the md breakpoint (768px), THE Archive_Sidebar SHALL be hidden and a mobile bottom navigation bar SHALL be displayed containing the same category links (Drafts, Projects, Versions, and Trash) as icon-label pairs.
9. THE Archive_Sidebar SHALL display inactive category links with transparent background, on-surface-variant color text, and normal font weight.
10. IF the Archive_Sidebar contains more category links than can fit within the visible viewport height, THEN THE Archive_Sidebar SHALL display a vertical scrollbar to access overflow content.

---

### Requirement 3: Archive Search and Filtering

**User Story:** As a user, I want to search and filter my archived items so that I can quickly find specific documents, versions, or projects.

#### Acceptance Criteria

1. THE Archive_View SHALL display an Archive_Search_Bar below the header subtitle, spanning a maximum width of 768px.
2. THE Archive_Search_Bar SHALL render with a glass-panel effect (white background with blur backdrop), rounded-xl corners, a 1px solid border using the application's outline-variant color token, and a search icon on the left.
3. WHEN the user types in the Archive_Search_Bar, THE Archive_View SHALL filter all displayed items (Suggestion_Cards, Version_List_Items, Paused_Project_Cards) within 300ms to show only items whose title or description contains the query as a case-insensitive substring, starting from the first character entered.
4. THE Archive_Search_Bar SHALL display a "Filters" button on the right side.
5. WHEN the user activates the "Filters" button, THE Archive_View SHALL display a filter panel containing filter options for item type (Suggestions, Versions, Paused Projects) and date range (Last 7 days, Last 30 days, Last 90 days, All time).
6. WHEN the user selects one or more filter options in the filter panel, THE Archive_View SHALL display only items matching both the active text search query and all selected filter criteria simultaneously.
7. WHEN the Archive_Search_Bar is empty and no filter options are selected, THE Archive_View SHALL display all items without filtering.
8. WHEN the search query and active filters match zero items, THE Archive_View SHALL display an empty-state message indicating no results were found and a button to clear all filters.
9. THE Archive_Search_Bar SHALL display a clear button when the text input is non-empty; WHEN the user activates the clear button, THE Archive_Search_Bar SHALL reset to empty and THE Archive_View SHALL re-apply only the active filter criteria.

---

### Requirement 4: AI-Powered Review Suggestions

**User Story:** As a user, I want the AI to suggest archived items that are relevant to my current work so that I can review and potentially reuse valuable content.

#### Acceptance Criteria

1. THE Archive_View SHALL display a "Suggested to Review" section in the left column (4 columns) of the Bento_Grid, preceded by an auto_awesome icon in primary color and a headline-style section title.
2. THE "Suggested to Review" section SHALL render a maximum of 5 Suggestion_Cards, each containing: a category badge (e.g., "Unused Concept", "Referenced Work"), a document title, a description excerpt (max 3 lines, truncated with ellipsis), an archived-date label showing relative time, and a "Review" action link.
3. WHEN the user clicks the "Review" action on a Suggestion_Card, THE Detail_Drawer SHALL open displaying the full details of the corresponding Archive_Item.
4. THE Suggestion_Card with category "Referenced Work" SHALL display "Compare" and "Restore" action buttons instead of the "Review" link. WHEN the user clicks "Compare", THE application SHALL open a side-by-side comparison view between the archived item and its related current file. WHEN the user clicks "Restore", THE application SHALL display a confirmation dialog before restoring the archived item to the active workspace.
5. THE first Suggestion_Card in the list SHALL be styled as the primary suggestion with glass-panel effect, aura-shadow, and a primary/10 border. All subsequent Suggestion_Cards SHALL be styled as secondary suggestions with glass-panel effect, ambient-shadow, and outline-variant/10 border.
6. WHEN no AI suggestions are available, THE "Suggested to Review" section SHALL display a placeholder message indicating that suggestions will appear as the user works on active documents.
7. WHILE AI suggestions are being generated, THE "Suggested to Review" section SHALL display a loading skeleton with a "Finding relevant items..." label in place of Suggestion_Cards.
8. WHEN the Archive_View is rendered and the user has at least one active document in the Editor_View, THE application SHALL request AI suggestions from AuraSphere based on the content of the user's currently active document.

---

### Requirement 5: Old Versions List

**User Story:** As a user, I want to browse old versions of my documents so that I can compare them with current versions or restore them if needed.

#### Acceptance Criteria

1. THE Archive_View SHALL display an "Old Versions" section in the right column (8 columns) of the Bento_Grid with a history icon and a headline-style section title.
2. THE "Old Versions" section header SHALL include a "View All" link aligned to the right that navigates to the Archive_Sidebar "Versions" category sub-view displaying the complete list of all archived versions.
3. THE "Old Versions" section SHALL render a maximum of 5 Version_List_Items sorted by archival date descending, each containing: a document icon in a rounded container, the document title in font-headline at base size with semibold weight, a timestamp showing relative time since archival (e.g., "2 days ago", "3 weeks ago"), and the archival reason.
4. EACH Version_List_Item SHALL display "Compare" and "Restore" circular action buttons on the right side, visible on hover or always visible on touch devices.
5. WHEN the user clicks a Version_List_Item title or body area, THE Detail_Drawer SHALL open displaying the full details of the corresponding Archive_Item.
6. WHEN the user clicks the "Compare" button on a Version_List_Item, THE application SHALL open a side-by-side comparison view between the archived version and its current counterpart, highlighting differences between the two documents.
7. IF the current counterpart of an archived version no longer exists when the user clicks "Compare", THEN THE application SHALL display an inline error message on the Version_List_Item indicating the related document is unavailable.
8. WHEN the user clicks the "Restore" button on a Version_List_Item, THE application SHALL display a confirmation dialog stating the document title and asking the user to confirm replacing the current version with the archived version.
9. WHEN the user confirms the restore action in the confirmation dialog, THE application SHALL replace the current counterpart with the archived version in the active workspace, close the confirmation dialog, and navigate to the Editor_View with the restored document loaded.
10. WHEN no archived versions exist, THE "Old Versions" section SHALL display an empty-state message indicating no old versions are available.

---

### Requirement 6: Paused Projects Section

**User Story:** As a user, I want to see my paused projects as folder cards so that I can resume or manage entire project collections.

#### Acceptance Criteria

1. THE Archive_View SHALL display a "Paused Projects" section below the "Old Versions" section in the right column, with a pause_circle icon and a headline-style section title.
2. THE "Paused Projects" section SHALL render Paused_Project_Cards in a 2-column grid on md viewports and above, collapsing to 1 column on smaller viewports, displaying a maximum of 6 cards with a "View All" link when more paused projects exist.
3. EACH Paused_Project_Card SHALL display: a folder icon in a 48px rounded container, the project name (truncated with ellipsis at 60 characters) in font-headline with semibold weight, a document count label showing the integer number of documents, a description excerpt (max 2 lines, truncated with ellipsis), a relative timestamp showing time since pausing, and an "Open Folder" action link.
4. WHEN the user clicks a Paused_Project_Card or its "Open Folder" link, THE Archive_View SHALL navigate to a sub-view displaying all documents within that paused project, with a back button that returns the user to the Archive_View Paused Projects section.
5. THE Paused_Project_Card SHALL render with surface-container-lowest background, rounded-xl corners, outline-variant/10 border, ambient-shadow, and a decorative circular element (64px diameter) in the top-right corner that scales to 1.1x on hover with a 300ms ease-in-out transition.
6. WHEN no paused projects exist, THE "Paused Projects" section SHALL display an empty-state message indicating no projects are currently paused.
7. IF the retrieval of paused projects fails, THEN THE "Paused Projects" section SHALL display an error message describing the failure and a retry button.
8. WHILE paused project data is being loaded, THE "Paused Projects" section SHALL display a loading indicator in place of the Paused_Project_Cards.

---

### Requirement 7: Archive Item Detail Drawer

**User Story:** As a user, I want to see full details of an archived item in a side panel so that I can review its metadata, AI summary, and take actions without leaving the archive view.

#### Acceptance Criteria

1. WHEN the user selects an Archive_Item (via Suggestion_Card, Version_List_Item, or Paused_Project_Card), THE Detail_Drawer SHALL slide in from the right edge of the viewport with a max-width of 672px and a 500ms ease-out transition, and SHALL move keyboard focus to the first focusable element within the drawer.
2. WHEN the Detail_Drawer opens, THE application SHALL display a Scrim overlay behind it with inverse-surface/10 background color and a 2px backdrop blur.
3. THE Detail_Drawer header SHALL display: an archive type badge (e.g., "Archived Draft") with an inventory_2 icon, and the document title in font-headline at 2rem with extrabold weight.
4. THE Detail_Drawer SHALL display a close button (X icon) positioned absolutely at top-right (top-8, right-8) that closes the drawer when activated.
5. WHEN the user clicks the Scrim overlay, THE Detail_Drawer SHALL close with a 500ms ease-in reverse slide-out animation and return keyboard focus to the element that triggered the drawer.
6. WHEN the user presses the Escape key while the Detail_Drawer is open, THE Detail_Drawer SHALL close with a 500ms ease-in reverse slide-out animation and return keyboard focus to the element that triggered the drawer.
7. THE Detail_Drawer content area SHALL be scrollable independently of the main Archive_View.
8. WHILE the Detail_Drawer is open, THE Detail_Drawer SHALL trap keyboard focus so that Tab and Shift+Tab cycle only through focusable elements within the drawer.
9. THE Detail_Drawer content area SHALL display the following sections in order: a metadata section showing the archived date, original creation date, and archive reason; an AI-generated summary section; and an actions section containing at minimum a "Restore" button and a "Delete Permanently" button.
10. IF the Archive_Item data fails to load when the Detail_Drawer opens, THEN THE Detail_Drawer SHALL display an error message indicating the failure and a retry button, and SHALL NOT display the metadata, summary, or actions sections.

---

### Requirement 8: Archive Item Metadata Display

**User Story:** As a user, I want to see structured metadata about an archived item so that I can understand when and why it was archived.

#### Acceptance Criteria

1. THE Detail_Drawer SHALL display a metadata section with surface-container-low background, rounded-xl corners, and a 2-column grid layout.
2. THE metadata section SHALL display the "Archived Date" field with a label in uppercase tracking-widest style and the date value formatted as a locale-appropriate short date (e.g., "Jan 15, 2024") in font-headline sm size with medium weight.
3. THE metadata section SHALL display the "Reason" field with the same label styling and the archival reason as the value, truncated to a maximum of 200 characters with an ellipsis if the reason exceeds that length; IF the archival reason is empty or not provided, THEN THE metadata section SHALL display a placeholder text "No reason provided" in on-surface-variant color.
4. THE metadata section SHALL display a "Related Current File" field spanning both columns, separated by a top border, containing a document icon in primary color and a clickable link to the related active document; IF the Archive_Item has no related current file, THEN THE metadata section SHALL hide the "Related Current File" field entirely.
5. WHEN the user clicks the "Related Current File" link, THE application SHALL navigate to the Editor_View and load the referenced document.
6. IF the user clicks the "Related Current File" link and the referenced document no longer exists in AuraBrain, THEN THE application SHALL display an inline error message indicating the related document is unavailable and SHALL NOT navigate away from the Detail_Drawer.

---

### Requirement 9: AI Summary in Detail Drawer

**User Story:** As a user, I want to see an AI-generated summary of the archived item so that I can quickly understand its content without reading the full document.

#### Acceptance Criteria

1. THE Detail_Drawer SHALL display an "AI Summary" section with a surface background, rounded-xl corners, ambient-shadow, and a decorative primary/5 blur element in the top-right corner.
2. THE "AI Summary" section header SHALL display an auto_awesome icon with FILL 1 in primary color and the title "AI Summary" in font-headline base size with bold weight.
3. THE "AI Summary" section body SHALL render AI-generated summary text in font-body at base size with relaxed line-height and on-surface-variant color, displaying a maximum of 500 characters with no truncation indicator if the summary is shorter.
4. WHEN the Detail_Drawer opens for an Archive_Item, THE "AI Summary" section SHALL initiate summary generation and display a loading skeleton with a "Generating summary..." label until the summary is received or a 30-second timeout elapses.
5. IF the AI summary generation fails or the 30-second timeout elapses without a response, THEN THE "AI Summary" section SHALL display a fallback message indicating the summary is unavailable and a retry button.
6. WHEN the user activates the retry button, THE "AI Summary" section SHALL re-initiate summary generation up to a maximum of 3 retry attempts, displaying the loading skeleton during each attempt.
7. IF all 3 retry attempts fail, THEN THE "AI Summary" section SHALL display the fallback message with the retry button disabled.

---

### Requirement 10: Memory Access Toggle

**User Story:** As a user, I want to control whether the AI can reference an archived item when generating new content so that I can manage my AI's knowledge context.

#### Acceptance Criteria

1. THE Detail_Drawer SHALL display a "Memory Access Toggle" section with surface-container-lowest background, rounded-xl corners, and a border that transitions to primary/30 on hover.
2. THE "Memory Access Toggle" section SHALL display a memory icon, the title "Memory Access Toggle" in font-headline sm bold, and a description explaining the toggle's purpose in font-headline xs with on-surface-variant color.
3. THE section SHALL display a toggle switch control aligned to the right side of the section, with the toggle defaulting to enabled (checked) when an Archive_Item is first archived.
4. WHEN the toggle is enabled (checked), THE AuraSphere AI SHALL include the archived item's content in its retrieval context when generating new content or answering queries in the active workspace.
5. WHEN the toggle is disabled (unchecked), THE AuraSphere AI SHALL exclude the archived item's content from its retrieval context in all generation and query responses.
6. WHEN the user changes the toggle state, THE application SHALL persist the new state to AuraBrain within 2 seconds without requiring a separate save action, and SHALL update the toggle's visual state to reflect the persisted value.
7. IF the persistence of the toggle state to AuraBrain fails, THEN THE application SHALL revert the toggle to its previous state and display an inline error message within the "Memory Access Toggle" section indicating the state could not be saved.
8. THE Memory_Access_Toggle SHALL announce its current state ("enabled" or "disabled") to screen readers when toggled.

---

### Requirement 11: Detail Drawer Actions

**User Story:** As a user, I want to perform actions on an archived item from the detail panel so that I can restore, compare, view, save, or delete it.

#### Acceptance Criteria

1. THE Detail_Drawer SHALL display a sticky footer action bar at the bottom with a frosted-glass background (surface-container-lowest/90 with 12px backdrop blur) and a top border.
2. THE primary action row SHALL contain three buttons: "Restore to Drafts" (primary background, full width flex-1), "Compare with Current" (surface-container background, flex-1), and "Open Read-only" (surface-container-lowest background with border, fixed width).
3. THE secondary action row SHALL contain "Save to Library" (left-aligned, on-surface-variant text with bookmark_add icon) and "Delete Permanently" (right-aligned, error color text with delete_forever icon).
4. WHEN the user clicks "Restore to Drafts", THE application SHALL move the Archive_Item back to the active workspace as a draft document, remove it from the Archive_View list, close the Detail_Drawer, and display a non-blocking success notification indicating the item has been restored.
5. WHEN the user clicks "Compare with Current", THE application SHALL open a side-by-side comparison view between the archived item and its related current file as identified by the Archive_Item's "Related Current File" metadata.
6. IF the Archive_Item has no related current file, THEN THE "Compare with Current" button SHALL be displayed in a disabled state with reduced opacity.
7. WHEN the user clicks "Open Read-only", THE application SHALL open the archived item in a read-only view mode where all editing controls are disabled and a visible indicator communicates that the document is read-only.
8. WHEN the user clicks "Save to Library", THE application SHALL copy the archived item to the Library as a new AuraIntentDocument via the `sync_intent` AuraBrain IPC command and display a non-blocking success notification upon completion.
9. WHEN the user clicks "Delete Permanently", THE application SHALL display a confirmation dialog stating the item name and warning that deletion is irreversible.
10. WHEN the user confirms permanent deletion, THE application SHALL invoke the `delete_intent` operation on AuraBrain, close the Detail_Drawer, and remove the item from the Archive_View list.
11. WHEN the user cancels the deletion confirmation dialog, THE application SHALL close the dialog and return to the Detail_Drawer without modifying the Archive_Item.
12. IF the delete operation on AuraBrain fails, THEN THE application SHALL display an error notification indicating the deletion failed and the Archive_Item SHALL remain in the Archive_View unchanged.

---

### Requirement 12: Archive View Visual Design

**User Story:** As a user, I want the Archive view to be visually consistent with the application's design system so that the experience feels cohesive and polished.

#### Acceptance Criteria

1. THE Archive_View SHALL use the application's CSS design tokens (`--md-sys-color-*`, `--font-family-ui`, `--font-family-content`, `--font-family-label`, `--radius-*`, `--shadow-*`) for all color, typography, border-radius, and shadow values, with no hardcoded color or font values outside the token system.
2. THE Archive_View SHALL use Manrope font-family (`--font-family-ui`) for all headlines, navigation text, labels, and UI text elements.
3. THE Archive_View SHALL use Newsreader font-family (`--font-family-content`) for body text, descriptions, and content excerpts.
4. THE Archive_View SHALL use Inter font-family (`--font-family-label`) for small labels, timestamps, and metadata values.
5. THE Archive_View SHALL use Material Symbols Outlined icons with FILL 0 for default/inactive icon states and FILL 1 for active/selected icon states.
6. THE Archive_View SHALL implement glass-panel effects (rgba white background with `--glass-blur` backdrop blur) for container elements that overlay other content, including modal overlays, floating toolbars, and dropdown panels.
7. THE Archive_View SHALL apply `--shadow-ambient` for standard card elevation and `--shadow-ambient-strong` for elements displaying AI-generated or AI-assisted content indicators.
8. THE Archive_View SHALL apply the `--transition-normal` duration (300ms ease-in-out) for hover state changes, color transitions, and layout shifts, with no transition exceeding 500ms.

---

### Requirement 13: Archive View Responsiveness

**User Story:** As a user, I want the Archive view to work well on different screen sizes so that I can manage my archive on both desktop and smaller viewports.

#### Acceptance Criteria

1. WHEN the viewport width is at or above the md breakpoint (768px), THE Archive_View SHALL display the Archive_Sidebar as a fixed left panel with its defined width of 288px.
2. WHEN the viewport width is below the md breakpoint, THE Archive_View SHALL hide the Archive_Sidebar and display a mobile bottom navigation bar with icons for Drafts, Projects, Archive (active), and Profile, where each navigation icon maintains a minimum touch target size of 48×48px.
3. WHEN the viewport width is at or above the lg breakpoint (1024px), THE Bento_Grid SHALL render in a 12-column layout with the suggestions column spanning 4 columns and the content column spanning 8 columns.
4. WHEN the viewport width is below the lg breakpoint, THE Bento_Grid SHALL collapse to a single-column stacked layout with the suggestions section above the content sections.
5. WHEN the viewport width is below the md breakpoint, THE Detail_Drawer SHALL occupy the full viewport width and full viewport height, rendering as a full-screen overlay instead of a side panel, and SHALL display a visible close button within the overlay header.
6. THE Archive_Search_Bar SHALL maintain a minimum touch target height of 48px on all viewport sizes.
7. WHEN the viewport width crosses a breakpoint boundary (md at 768px or lg at 1024px), THE Archive_View SHALL re-render the layout to match the target breakpoint configuration without requiring a page reload.

---

### Requirement 14: Archive View Accessibility

**User Story:** As a user, I want the Archive view to be accessible via keyboard and screen readers so that all users can manage their archived content.

#### Acceptance Criteria

1. THE Archive_View SHALL be navigable using keyboard Tab, Shift+Tab, Enter, Space, and Escape keys, with all interactive elements (Archive_Sidebar links, Archive_Search_Bar, Suggestion_Cards, Version_List_Items, Paused_Project_Cards, Detail_Drawer controls, and action buttons) reachable via keyboard focus in a logical reading order.
2. WHILE the Detail_Drawer is open, THE Detail_Drawer SHALL trap keyboard focus by wrapping Tab from the last focusable element to the first, and Shift+Tab from the first to the last, preventing focus from reaching elements behind the Scrim.
3. WHEN the Detail_Drawer is closed (via Escape key, Scrim click, or close button), THE application SHALL return keyboard focus to the element that triggered the Detail_Drawer to open.
4. THE Archive_View SHALL assign ARIA landmark roles as follows: role="main" on the Bento_Grid content area, role="navigation" on the Archive_Sidebar, role="search" on the Archive_Search_Bar container, and role="complementary" on the Detail_Drawer.
5. WHILE the Detail_Drawer is open, THE Detail_Drawer SHALL have role="dialog" and aria-modal="true" to communicate its modal nature to assistive technologies.
6. WHEN the user toggles the Memory_Access_Toggle, THE Memory_Access_Toggle SHALL announce its new state ("enabled" or "disabled") to screen readers via an aria-live="polite" region or equivalent ARIA state update.
7. WHILE the Detail_Drawer is open, THE Scrim overlay SHALL have aria-hidden="true" to prevent screen readers from announcing it as interactive content.
8. ALL interactive elements in the Archive_View SHALL provide a visible focus indicator using the application's existing focus-visible style (2px solid primary outline with 2px offset).
9. THE Memory_Access_Toggle SHALL be operable via the Space key to change its state, consistent with the standard switch control interaction pattern.
