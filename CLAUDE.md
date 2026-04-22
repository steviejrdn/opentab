# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**opentab_** is a survey data cross-tabulation tool. Users upload CSV data, optionally pair it with MDD metadata, define variables, and build custom crosstabs with statistical summaries via a drag-and-drop interface.

## Development Commands

### Docker (recommended)
```bash
docker-compose up    # Backend :8001, Frontend :5173
```

### Manual (Windows)
```bash
# Backend — run from backend/
cd backend
uvicorn main:app --reload --port 8001

# Frontend — run from frontend/
cd frontend
npm run dev          # Dev server on :5173
npm run build        # tsc -b && vite build
npm run lint         # ESLint
```

> **Port mismatch**: `start.sh` launches uvicorn on port 8000, but `frontend/src/lib/api.ts` defaults to `http://localhost:8001`. Always start the backend manually on 8001, or set `VITE_API_URL=http://localhost:8000`.

### Environment Variables
- `VITE_API_URL` — backend base URL for the frontend (default: `http://localhost:8001`). Set in `.env` or `.env.local`.

## Architecture

### Backend (FastAPI)
- **Entry point**: `backend/main.py` — mounts three routers under `/api/data`, `/api/tables`, `/api/compute`
- **Global state**: `backend/api/data.py` uses a module-level `data_store` dict — not multi-user safe
- **Routers**:
  - `api/data.py` — upload CSV/MDD/ZIP, load sample, return variables and data info, variable merge operations
  - `api/tables.py` — CRUD for table definitions (not actively used by the frontend)
  - `api/compute.py` — `POST /crosstab` is the core endpoint; handles weighted counts, per-column stats, and filter application

### Core Python Modules (`backend/core/`)
- `tabulator.py` — `create_crosstab(df, row_defs, col_defs, weight_col, filter_def)` builds the cross-tab matrix
- `code_parser.py` — `parse_code_def(code_def, df)` converts a code definition string into a pandas boolean mask. Supported syntax:
  - `Q1/1,2,3` — discrete codes
  - `Q1/1..5` — range
  - `Q1/1+Q2/2` — OR (union)
  - `Q1/1.Q2/2` — AND (intersection, dot operator)
  - `!Q1/1` — negation
  - `Q1/*` — has any value
- `statistics.py` — `calculate_frequencies()` returns row%, col%, total% from a crosstab DataFrame
- `mdd_parser.py` — parses IBM Dimensions XML metadata; handles namespace variants
- `data_loader.py` — `load_csv()` with chardet encoding detection and delimiter inference

> **Legacy**: `core/` and `ui/` at the repo root are Streamlit-era copies. Always use `backend/core/` for active development.

### Frontend (React + TypeScript + Vite)

**Most pages are inlined in `App.tsx`** (~900+ lines): `BuildPage`, `BuildPageLayout`, `WelcomeScreen`, `ResultTab`, `EditVariablesPage`, `TableList`, and `VariableList` are all local components. The only external component import is `FilterTab` from `frontend/src/components/FilterTab.tsx`.

**State**: `frontend/src/store/useStore.ts` (Zustand) is the single source of truth. All mutations use action functions — never mutate state directly. Key slices:
- `variables` — variable metadata fetched from backend (name, label, type, codes, stat toggles)
- `tables` — array of table definitions, each with `row_items`, `col_items`, `filter_items`, `filter_def`, and `result`
- `activeTableId` — which table is being edited/viewed
- `folders` — optional grouping for tables
- `displayOptions` — `counts`, `colPct`, `showPctSign`, `decimalPlaces`

**API**: `frontend/src/lib/api.ts` (axios). Three clients: `dataApi`, `tablesApi`, `computeApi`. `computeApi.crosstab()` is the primary call.

**Drag-and-drop**: dnd-kit. Variables drag from the sidebar into three drop zones in BuildPage — Header (columns), Sidebreak (rows), or Filter. Nesting is supported: dropping onto an existing item creates a child. All drag logic lives in `App.tsx`.

## Key Data Flows

**Loading data**: Upload CSV (or CSV+MDD pair, or ZIP containing both) → backend stores DataFrame in `data_store` → frontend calls `getVariables()` → Zustand stores variable metadata. `mergeAndSetVariables` is used on re-upload to preserve user-edited labels/scores.

**Building a table**: Drag variables to Header/Sidebreak zones → each drop creates a `DropItem` with `codeDef` (e.g., `Q1/1,2,3`) → click Run → `computeApi.crosstab()` sends `row_items`, `col_items`, optional `filter_def`, `weight_col`, and `mean_score_mappings` → result stored in `tables[activeTableId].result` → ResultTab renders it.

**Mean/stats computation**: On EditVariablesPage, users assign numeric `factor` scores to codes and toggle `showMean` / `showStdError` / `showStdDev` / `showVariance` per variable. These are collected and sent as `mean_score_mappings` in the crosstab request; the backend computes stats per column and returns them alongside counts.

**Session persistence**: Users can save/load the full app state as `.opentab` files (JSON) via export/import in the UI. State import goes through `importState()` in the store.

## Supported File Formats
- **Data**: CSV/TXT — encoding and delimiter are auto-detected
- **Metadata**: MDD text/XML format (IBM Dimensions) — binary/compiled MDD is rejected with an error
- **Upload options**: single CSV, single MDD, CSV+MDD pair, or ZIP containing both
