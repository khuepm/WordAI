# WordAI

> **AI-powered content editor — write freely, publish anything.**
>
> 🌐 [BoongAI.com](https://BoongAI.com)

![WordAI Screenshot](https://raw.githubusercontent.com/khuepm/WordAI/main/ui/render_on_demand_desktop/screen.png)

---

## Key Features

### 🔮 AuraSphere
Just define your **intents** — publish in any format you want. AuraSphere takes your ideas and transforms them into PDFs, documents, web pages, or any output format you need. No templates, no rigid structures — only your creativity and AI doing the heavy lifting.

### ✨ Magic in Content Editing
No need to worry about formatting, styling, or layout. **AI takes care of it for you.** Simply write your content and let the magic happen — headings, lists, emphasis, and structure are applied automatically so you can stay in the flow of writing.

### 🧠 AI-Native Architecture
WordAI is built from the ground up with AI at its core. Every feature is designed to leverage large language models for intelligent content understanding, generation, and transformation.

### 🖥️ Cross-Platform Desktop App
Built with **Tauri 2**, WordAI runs natively on **Windows**, **macOS**, and **Linux** with a small footprint and fast startup.

---

## Tech Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| Desktop      | [Tauri 2](https://tauri.app/) (Rust) |
| Frontend     | React 18 · TypeScript · Vite 7     |
| Styling      | Tailwind CSS 4                      |
| Backend      | Rust (Tokio, Reqwest, Serde)        |
| PDF Export   | printpdf                            |
| Testing      | Vitest · Testing Library            |
| Package Mgr  | pnpm 9+ (monorepo workspace)       |
| Node         | v22+                                |

---

## Getting Started

### Prerequisites

- **Node.js** v22+ (see `.nvmrc`)
- **pnpm** 9+
- **Rust** toolchain (for Tauri)
- Platform-specific Tauri dependencies — see the [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/)

### Install Dependencies

```bash
pnpm install
```

### Development

```bash
# Run the desktop app in development mode
pnpm dev

# Or launch via Tauri CLI directly
pnpm tauri dev
```

### Build

```bash
# Build the frontend
pnpm build

# Build the native desktop app
pnpm tauri build
```

### Test

```bash
pnpm test
```

---

## Project Structure

```
WordAI/
├── apps/
│   └── wordai-editor/        # Main desktop application
│       ├── src/               # React + TypeScript frontend
│       ├── src-tauri/         # Rust backend (Tauri)
│       └── ...
├── ui/                        # UI prototypes & design references
├── package.json               # Monorepo root
└── pnpm-workspace.yaml
```

---

## Links

- 🌐 **Website**: [BoongAI.com](https://BoongAI.com)
- 📦 **Repository**: [github.com/khuepm/WordAI](https://github.com/khuepm/WordAI)

---

## License

This project is proprietary. All rights reserved.

---

<!-- ======================== 中文 ======================== -->

<details>
<summary>🇨🇳 中文</summary>

# WordAI

> **AI 驱动的内容编辑器 — 自由书写，随意发布。**
>
> 🌐 [BoongAI.com](https://BoongAI.com)

## 主要功能

### 🔮 AuraSphere
只需定义您的**意图**，即可发布任何格式。AuraSphere 将您的想法转化为 PDF、文档、网页或任何您需要的输出格式。无需模板，无需固定结构 — 只有您的创意和 AI 的强大能力。

### ✨ 内容编辑的魔法
无需担心排版、样式或布局。**AI 会为您处理一切。** 您只需书写内容，标题、列表、强调和结构都会自动应用，让您保持写作的流畅状态。

### 🧠 AI 原生架构
WordAI 从底层开始就以 AI 为核心构建。每个功能都旨在利用大语言模型进行智能内容理解、生成和转换。

### 🖥️ 跨平台桌面应用
基于 **Tauri 2** 构建，WordAI 在 **Windows**、**macOS** 和 **Linux** 上原生运行，体积小、启动快。

## 快速开始

```bash
pnpm install    # 安装依赖
pnpm dev        # 开发模式
pnpm build      # 构建前端
pnpm tauri build # 构建桌面应用
pnpm test       # 运行测试
```

</details>

<!-- ======================== 日本語 ======================== -->

<details>
<summary>🇯🇵 日本語</summary>

# WordAI

> **AI搭載のコンテンツエディター — 自由に書いて、何でも公開。**
>
> 🌐 [BoongAI.com](https://BoongAI.com)

## 主な機能

### 🔮 AuraSphere
**インテント**を定義するだけで、お好みの形式で公開できます。AuraSphere はあなたのアイデアを PDF、ドキュメント、ウェブページ、その他必要な出力形式に変換します。テンプレートも固定構造も不要 — あなたの創造性と AI が全てを処理します。

### ✨ コンテンツ編集のマジック
フォーマット、スタイル、レイアウトを気にする必要はありません。**AI がすべてを処理します。** コンテンツを書くだけで、見出し、リスト、強調、構造が自動的に適用され、執筆に集中できます。

### 🧠 AIネイティブアーキテクチャ
WordAI は AI をコアとしてゼロから構築されています。すべての機能は、大規模言語モデルによるインテリジェントなコンテンツ理解、生成、変換を活用するように設計されています。

### 🖥️ クロスプラットフォームデスクトップアプリ
**Tauri 2** で構築された WordAI は、**Windows**、**macOS**、**Linux** でネイティブに動作し、小さなフットプリントと高速起動を実現します。

## クイックスタート

```bash
pnpm install    # 依存関係をインストール
pnpm dev        # 開発モード
pnpm build      # フロントエンドをビルド
pnpm tauri build # デスクトップアプリをビルド
pnpm test       # テストを実行
```

</details>

<!-- ======================== Español ======================== -->

<details>
<summary>🇪🇸 Español</summary>

# WordAI

> **Editor de contenido impulsado por IA — escribe libremente, publica lo que quieras.**
>
> 🌐 [BoongAI.com](https://BoongAI.com)

## Características Principales

### 🔮 AuraSphere
Solo define tus **intenciones** — publica en cualquier formato que desees. AuraSphere transforma tus ideas en PDFs, documentos, páginas web o cualquier formato de salida que necesites. Sin plantillas, sin estructuras rígidas — solo tu creatividad y la IA haciendo el trabajo pesado.

### ✨ Magia en la Edición de Contenido
No te preocupes por el formato, el estilo o el diseño. **La IA se encarga de todo.** Simplemente escribe tu contenido y deja que la magia suceda — los títulos, listas, énfasis y estructura se aplican automáticamente para que puedas mantenerte en el flujo de escritura.

### 🧠 Arquitectura Nativa de IA
WordAI está construido desde cero con la IA en su núcleo. Cada función está diseñada para aprovechar los modelos de lenguaje grandes para la comprensión, generación y transformación inteligente de contenido.

### 🖥️ Aplicación de Escritorio Multiplataforma
Construido con **Tauri 2**, WordAI se ejecuta nativamente en **Windows**, **macOS** y **Linux** con un tamaño reducido y un inicio rápido.

## Inicio Rápido

```bash
pnpm install    # Instalar dependencias
pnpm dev        # Modo de desarrollo
pnpm build      # Compilar el frontend
pnpm tauri build # Compilar la aplicación de escritorio
pnpm test       # Ejecutar pruebas
```

</details>

<!-- ======================== Tiếng Việt ======================== -->

<details>
<summary>🇻🇳 Tiếng Việt</summary>

# WordAI

> **Trình soạn thảo nội dung hỗ trợ AI — viết tự do, xuất bản mọi thứ.**
>
> 🌐 [BoongAI.com](https://BoongAI.com)

## Tính Năng Chính

### 🔮 AuraSphere
Chỉ cần định nghĩa **ý định** của bạn — xuất bản với bất kỳ định dạng nào bạn muốn. AuraSphere biến ý tưởng của bạn thành PDF, tài liệu, trang web hoặc bất kỳ định dạng đầu ra nào bạn cần. Không cần mẫu, không cần cấu trúc cứng nhắc — chỉ có sự sáng tạo của bạn và AI làm phần việc nặng.

### ✨ Phép Màu Trong Biên Tập Nội Dung
Không cần lo lắng về định dạng, kiểu dáng hay bố cục. **AI sẽ lo tất cả cho bạn.** Chỉ cần viết nội dung và để phép màu xảy ra — tiêu đề, danh sách, nhấn mạnh và cấu trúc được áp dụng tự động để bạn luôn tập trung vào việc viết.

### 🧠 Kiến Trúc AI-Native
WordAI được xây dựng từ đầu với AI là cốt lõi. Mọi tính năng đều được thiết kế để tận dụng các mô hình ngôn ngữ lớn cho việc hiểu, tạo và chuyển đổi nội dung thông minh.

### 🖥️ Ứng Dụng Desktop Đa Nền Tảng
Được xây dựng với **Tauri 2**, WordAI chạy native trên **Windows**, **macOS** và **Linux** với dung lượng nhỏ và khởi động nhanh.

## Bắt Đầu Nhanh

```bash
pnpm install    # Cài đặt dependencies
pnpm dev        # Chế độ phát triển
pnpm build      # Build frontend
pnpm tauri build # Build ứng dụng desktop
pnpm test       # Chạy tests
```

</details>
