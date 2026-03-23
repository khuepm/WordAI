# Design Document: WordAI Text Editor

## Overview

WordAI là một ứng dụng desktop text editor hiện đại được xây dựng trên nền tảng Tauri (Rust backend) và React (TypeScript frontend), tích hợp AI assistant AuraSphere. Ứng dụng tuân theo triết lý "The Ethereal Editor" - một trải nghiệm soạn thảo tập trung vào nội dung (focus-first), nơi công cụ biến mất để lại không gian cho sáng tạo. AI không phải là một sidebar xâm lấn mà là một "soft, glowing presence" xuất hiện khi cần thiết và lùi vào nền khi người dùng đang trong trạng thái flow.

Hệ thống được thiết kế với ba màn hình chính: Editor Canvas với AI Assistant Panel, Negotiation Panel để so sánh và chấp nhận đề xuất AI, và Render-on-Demand Drawer cho việc xuất bản và định dạng tài liệu. Design system sử dụng glassmorphism, tonal shifts thay vì hard borders, và typography cao cấp (Newsreader serif cho nội dung, Manrope sans-serif cho UI).

## Architecture

```mermaid
graph TB
    subgraph "Frontend - React + TypeScript"
        UI[UI Layer]
        State[State Management]
        Editor[Editor Core]
        AI[AI Integration Layer]
    end
    
    subgraph "Tauri Bridge"
        IPC[IPC Commands]
        Events[Event System]
    end
    
    subgraph "Backend - Rust"
        FileSystem[File System Manager]
        DocStore[Document Store]
        PDFExport[PDF Export Engine]
        AIService[AI Service Connector]
    end
    
    subgraph "External Services"
        LLM[LLM API - OpenAI/Anthropic]
        Cloud[Cloud Storage - Optional]
    end
    
    UI --> State
    State --> Editor
    State --> AI
    Editor --> IPC
    AI --> IPC
    IPC --> FileSystem
    IPC --> DocStore
    IPC --> PDFExport
    IPC --> AIService
    AIService --> LLM
    DocStore --> Cloud
```

## Main Workflow

```mermaid
sequenceDiagram
    participant User
    participant EditorUI
    participant StateManager
    participant TauriBridge
    participant RustBackend
    participant AIService
    participant LLM

    User->>EditorUI: Nhập văn bản
    EditorUI->>StateManager: Update document state
    StateManager->>TauriBridge: Auto-save command
    TauriBridge->>RustBackend: Save to local storage
    
    User->>EditorUI: Trigger AI (Cmd+K)
    EditorUI->>StateManager: Request AI suggestion
    StateManager->>TauriBridge: Invoke AI command
    TauriBridge->>RustBackend: Process AI request
    RustBackend->>AIService: Forward to AI service
    AIService->>LLM: API call with context
    LLM-->>AIService: Return suggestions
    AIService-->>RustBackend: Process response
    RustBackend-->>TauriBridge: Return suggestions
    TauriBridge-->>StateManager: Update AI state
    StateManager-->>EditorUI: Display suggestions
    
    User->>EditorUI: Select suggestion
    EditorUI->>StateManager: Show negotiation panel
    User->>EditorUI: Accept changes
    EditorUI->>StateManager: Apply changes
    StateManager->>TauriBridge: Save updated document
```

## Components and Interfaces

### Component 1: EditorCanvas

**Purpose**: Màn hình soạn thảo chính với typography cao cấp và trải nghiệm minimal

**Interface**:
```typescript
interface EditorCanvasProps {
  document: Document
  onDocumentChange: (doc: Document) => void
  onAITrigger: (selection: TextSelection) => void
  isAIPanelOpen: boolean
}

interface Document {
  id: string
  title: string
  content: string // Rich text format (Markdown or custom)
  metadata: DocumentMetadata
  version: number
  lastModified: Date
}

interface DocumentMetadata {
  wordCount: number
  readingTime: number
  status: 'draft' | 'archived' | 'published'
  tags: string[]
}

interface TextSelection {
  start: number
  end: number
  text: string
}
```

**Responsibilities**:
- Render editor canvas với Newsreader font cho nội dung
- Handle text input và formatting
- Manage cursor position và text selection
- Trigger AI suggestions khi user nhấn Cmd+K
- Auto-save document changes
- Display document metadata (word count, last edited)

### Component 2: AuraSpherePanel

**Purpose**: AI assistant sidebar với chat interface và suggestion cards

**Interface**:
```typescript
interface AuraSpherePanel
