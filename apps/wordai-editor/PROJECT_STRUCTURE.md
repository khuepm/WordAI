# WordAI Text Editor - Project Structure

## Overview
WordAI is a desktop text editor built with Tauri (Rust backend) + React (TypeScript frontend), featuring an integrated AI assistant following "The Ethereal Editor" philosophy.

## Directory Structure

```
wordai-editor/
├── src/                      # Frontend source code (React + TypeScript)
│   ├── components/          # React components (EditorCanvas, AuraSpherePanel, etc.)
│   ├── services/            # Frontend services (documentService, stateManager, etc.)
│   ├── types/               # TypeScript type definitions
│   ├── App.tsx              # Main application component
│   └── main.tsx             # Application entry point
│
├── src-tauri/               # Backend source code (Rust)
│   └── src/                 # Rust source files
│       ├── lib.rs           # Library entry point
│       └── main.rs          # Application entry point
│
├── public/                  # Static assets
├── dist/                    # Build output (generated)
├── package.json             # NPM dependencies and scripts
├── tsconfig.json            # TypeScript configuration (strict mode enabled)
├── vite.config.ts           # Vite bundler configuration
└── Cargo.toml               # Rust dependencies
```

## Technology Stack

### Frontend
- **React 19.1.0** - UI framework
- **TypeScript 5.8.3** - Type-safe JavaScript (strict mode enabled)
- **Vite 7.0.4** - Build tool and dev server
- **Tauri API 2.x** - Desktop integration APIs

### Backend
- **Rust 2021 Edition** - Systems programming language
- **Tauri 2.x** - Desktop application framework
- **Serde** - Serialization/deserialization library

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run Tauri commands
npm run tauri [command]
```

## Configuration

- **TypeScript**: Strict mode enabled with additional linting rules
- **Module System**: ESNext with bundler resolution
- **Target**: ES2020 for modern JavaScript features
- **JSX**: React JSX transform

## Next Steps

Refer to `.kiro/specs/wordai-text-editor/tasks.md` for the implementation plan.
