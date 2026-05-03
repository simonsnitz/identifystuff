# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**identifystuff** — a React web app that helps people memorize associations between two items via simple multiple-choice questions. Topics so far: codons, trees, mushrooms, metabolites.

## Stack & commands

Vite + React 18 (JSX, no TypeScript).

- `npm install` — install deps
- `npm run dev` — start dev server
- `npm run build` — production build to `dist/`
- `npm run preview` — preview production build

## Architecture

- All quiz data lives in a **single JSON file**: [src/data.json](src/data.json). This is the only source of truth — do not split it across multiple files or fetch from an API.
- Shape: `{ topics: { <key>: { label, prompt, pairs: [...] } } }`. Each topic's `pairs` array holds the item-to-association mappings used to generate multiple-choice questions.
- [src/App.jsx](src/App.jsx) is the entry component. The home screen reads topic labels from `data.json`.
