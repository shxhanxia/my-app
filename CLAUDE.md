# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Clinical PDF Data Extractor** — a single-page React app that ingests medical literature PDFs, uses AI to extract structured clinical case data, and exports results to Excel. Built from Google AI Studio's app template.

## Commands

```bash
npm install              # Install dependencies
npm run dev              # Dev server on port 3000 (0.0.0.0)
npm run build            # Production build
npm run lint             # Type-check only (tsc --noEmit)
```

Environment: set `GEMINI_API_KEY` in `.env.local` (see `.env.example`). For custom endpoints, configure base URL + API key in the app's settings panel.

## Architecture

```
src/
├── main.tsx              # React entry point, mounts <App /> into #root
├── App.tsx               # Entire application — state, UI, processing orchestration
├── types.ts              # ClinicalData, ModelConfig, ProcessingFile interfaces
├── index.css             # Tailwind CSS v4 imports + Inter/JetBrains Mono fonts
├── lib/
│   ├── aiService.ts      # Gemini SDK + OpenAI-compatible API calls, prompt engineering
│   ├── pdfWorker.ts      # pdfjs-dist text extraction with reference-section stripping
│   └── excelHelper.ts    # xlsx export with predefined column map
└── logo.jpg
```

### Key design decisions

- **No router, no state library** — the entire app is a single `App` component. State is managed with `useState` + `useRef` and persisted to `localStorage` (key: `ai_clinical_config`).
- **Dual AI backend** — if `baseUrl` contains `googleapis.com`, calls go through `@google/genai` SDK; otherwise uses OpenAI-compatible `/chat/completions` REST endpoint. Both paths share the same extraction prompt and `parseAIResponse()`.
- **Two input modes**: text mode (PDF → pdfjs text extraction, then text sent to AI) vs. multimodal mode (PDF base64 blob sent directly to the model).
- **Batch processing** — files are processed in configurable batch sizes (1–50). Within a batch, all PDFs are extracted in parallel via `Promise.all`, then sent together in a single AI call that returns a JSON array.
- **PDF text cleaning** — `cleanText()` in `pdfWorker.ts` strips Discussion/References/Acknowledgements sections (English + Chinese) to reduce token usage.
- **Deployment**: GitHub Actions workflow in `.github/workflows/deploy.yml` deploys to GitHub Pages. A separate `dependency-check-notify.yml` workflow monitors dependency health.
- **Theming**: Tailwind CSS v4 with `@tailwindcss/vite` plugin (no PostCSS config needed). Custom fonts via `@import` in CSS. Animations via `motion` (community fork of Framer Motion).

### Data flow

1. User uploads PDFs → `ProcessingFile[]` state with status `pending`
2. User clicks "Run the analysis" → `startProcessing()` batches pending files
3. Each batch: `extractTextFromPdf()` (or base64 for multimodal) → `processBatchOfPdfs()` → AI returns JSON → parsed by `parseAIResponse()` → results stored per-file in state
4. Results displayed in editable `<table>`, each cell backed by `updateResultField()`
5. Export: completed results flattened → `exportToExcel()` → `.xlsx` download
