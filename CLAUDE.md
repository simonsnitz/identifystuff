# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**identifystuff** — a React web app that helps people memorize associations between items via multiple-choice questions. Working topics: **codons**, **trees**. Coming: mushrooms, metabolites, and a chemistry/pharma-reactions quiz.

## Stack & commands

Vite + React 18 (JSX, no TypeScript).

- `npm install` — install deps
- `npm run dev` — start dev server (port 5173)
- `npm run build` — production build to `dist/`
- `npm run preview` — preview production build

## Architecture

### Data: one JSON file

All quiz data lives in **[src/data.json](src/data.json)** — the only source of truth. Don't split it across files or fetch from an API. Image assets (tree photos) live in `public/<topic>/`; small molecule structures are *not* shipped as files — they're SMILES strings rendered at runtime (see below).

The original `pairs` shape from the scaffold has evolved: each topic chooses whatever subkey makes sense for its data. Current topics:
- `topics.codons.aminoAcids[]` with `{name, three, one, smiles, codons[]}`
- `topics.trees.species[]` with `{name, slug}` (image at `/trees/<slug>.jpg` and `/trees/<slug>-bark.jpg`)

New topics should follow the same convention: pick a topic-appropriate plural key, store one row per "thing being identified."

### Routing

[src/App.jsx](src/App.jsx) is the home screen + a state-based router (no react-router). Each topic that has data points to its own `<TopicName>QuestionPage` component, which takes `onExit`.

### The quiz-page pattern

Every topic-specific page (`CodonsQuestionPage.jsx`, `TreesQuestionPage.jsx`) shares the same shell:

- `.quiz-layout` grid: collapsible sidebar (`.sidebar`) + main quiz area (`.quiz`).
- `.sidebar-toggle` (mobile hamburger) appears below 768px and slides the sidebar in/out via the `.sidebar-open` class on `.quiz-layout`.
- Question render uses `.question-display` with a `question-<kind>` modifier; options use `.option` with `option-<kind>`. Add new kind-specific CSS rules instead of restyling the base class.
- Flash animations come from `.flash-correct` / `.flash-wrong` (~0.3s soft color flash). Don't reinvent.
- Keyboard: ←/→ horizontal toggle, ↑/↓ vertical toggle in 2×2 grid, Enter or Shift to submit, Esc closes sidebar then exits.

### renderItem dispatch

Each quiz page has a `renderItem(item, kind, ...)` helper. The question and the four options each store their *kind* on the question object (`questionKind`, `answerKind`), and rendering reads from the **question's** stored kinds — not the live preference state. This avoids a one-frame crash when the user switches modes (stale options would otherwise be rendered with the new kind's renderer).

### No-repeat sliding window

Each quiz page keeps a `useRef([])` of the last 3 question signatures and re-rolls up to 12 times to avoid repeating. Signature should encode what's *visible* (e.g. the codon string when codon is the prompt, the amino acid when AA is the prompt) and ideally the question kind, so signatures from different modes don't conflict.

### Chemistry / SMILES rendering

Small molecule structures are stored as SMILES strings in `data.json` and rendered in-browser via the `smiles-drawer` npm package onto a `<canvas>`. See `AminoAcidImage` in [src/CodonsQuestionPage.jsx](src/CodonsQuestionPage.jsx) for the canonical pattern:

- A `drawerCache` Map keyed by pixel size, so we reuse `SmilesDrawer.Drawer` instances instead of allocating one per render.
- `useEffect` parses the SMILES with `SmilesDrawer.parse` and draws into the canvas; size the canvas via the `width`/`height` attributes (bitmap pixels) and let CSS handle visual sizing.
- Use `null` SMILES for entries that have no structure (e.g. Stop codon); the caller is responsible for not asking such entries to render as a structure (the codon page excludes them when the question or answer kind is `aa-image`).

When adding new chemistry quizzes, reuse this pattern — don't ship PNG renders.
