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
npm test                 # Unit tests (vitest)
```

Environment: set `GEMINI_API_KEY` in `.env.local` (see `.env.example`). For custom endpoints, configure base URL + API key in the app's settings panel.

## Architecture

```
src/
├── main.tsx              # React entry point, mounts <App /> into #root
├── App.tsx               # Root state, UI layout, processing orchestration
├── config.ts             # Shared constants (DEFAULT_MODEL, localStorage keys)
├── types.ts              # ClinicalData, ModelConfig, ProcessingFile interfaces
├── index.css             # Tailwind CSS v4 imports + Inter/JetBrains Mono fonts
├── lib/
│   ├── aiService.ts      # Gemini SDK + OpenAI-compatible API calls, prompt engineering
│   ├── clinicalFields.ts # Single source of truth for the 19 extracted fields
│   ├── parseAIResponse.ts# AI JSON parsing + normalizeClinicalData validation
│   ├── pdfWorker.ts      # pdfjs-dist text extraction with reference-section stripping
│   ├── excelHelper.ts    # exceljs export with column map driven by clinicalFields
│   └── utils.ts          # cn() class merge helper
├── components/
│   ├── SettingsPanel.tsx # Model config, API key, batch size, connection test
│   ├── UploadPanel.tsx   # Dropzone + file list + progress + run/cancel
│   ├── ResultsTable.tsx  # Editable results grid, headers from clinicalFields
│   ├── EditableCell.tsx  # Inline-editable table cell
│   └── ErrorBoundary.tsx # Catches render errors in the results section
└── logo.jpg
```

### Key design decisions

- **No router, no state library** — the entire app is a single `App` component. State is managed with `useState` + `useRef` and persisted to `localStorage` (key: `ai_clinical_config`).
- **Dual AI backend** — if `baseUrl` contains `googleapis.com`, calls go through `@google/genai` SDK (supports `abortSignal`); otherwise uses OpenAI-compatible `/chat/completions` REST endpoint. Both paths share the same extraction prompt and `parseAIResponse()`.
- **Two input modes**: text mode (PDF → pdfjs text extraction, then text sent to AI) vs. multimodal mode (PDF base64 blob sent directly to the model).
- **Per-file processing with concurrency limit** — files are processed independently (one API call per file) with a configurable concurrency limit (batchSize, 1–50), so one failure doesn't sink the batch. Cancel uses an `AbortController` to abort in-flight calls; interrupted files revert to `pending`.
- **Field metadata driven by `clinicalFields.ts`** — the 19 `CLINICAL_FIELDS` (key/label/width/prompt type) drive the extraction prompt, the results table headers/cells, and the Excel export. Add or reorder a field in one place.
- **AI response normalization** — `normalizeClinicalData()` in `parseAIResponse.ts` fills missing fields with null, coerces numeric strings (age, maxDiameterMm, followUpMonths, tumorCount) to numbers, and drops non-object entries.
- **PDF text cleaning** — `cleanText()` in `pdfWorker.ts` strips Discussion/References/Acknowledgements sections (English + Chinese) to reduce token usage. The pdfjs worker is bundled locally via Vite (`?worker` import), no CDN dependency.
- **Results persistence** — completed results are debounce-saved to `localStorage` (key: `ai_clinical_results`) and restored on reload, so a page refresh doesn't lose extracted data. Uploaded files are deduplicated by name + size.
- **Deployment**: GitHub Actions workflow in `.github/workflows/deploy.yml` deploys to GitHub Pages (runs type-check + tests before building). A separate `dependency-check-notify.yml` workflow (Saturdays and Sundays) monitors dependency health and opens a notification issue.
- **Theming**: Tailwind CSS v4 with `@tailwindcss/vite` plugin (no PostCSS config needed). Custom fonts via `@import` in CSS. Animations via `motion` (community fork of Framer Motion).

### Data flow

1. User uploads PDFs → `ProcessingFile[]` state with status `pending` (duplicates skipped)
2. User clicks "Run the analysis" → `startProcessing()` processes pending/error files with concurrency `batchSize`
3. Each file: `extractTextFromPdf()` (or base64 for multimodal) → `processPdf()` → AI returns JSON → parsed and normalized by `parseAIResponse()` → results stored per-file in state
4. Results displayed in editable `<table>`, each cell backed by `updateResultField()`
5. Export: completed results flattened → `exportToExcel()` (exceljs) → `.xlsx` download
