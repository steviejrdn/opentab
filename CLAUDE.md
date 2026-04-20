# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Tabulator** is a survey data cross-tabulation tool. Users upload CSV data, optionally pair it with MDD metadata, define variables, and build custom crosstabs with statistical summaries via a drag-and-drop interface.

## Development Commands

### Both services
```bash
bash start.sh    # Starts backend on :8000 (background) + frontend dev server
```

> **Port mismatch**: `frontend/src/lib/api.ts` hardcodes `http://localhost:8001`, but `start.sh` launches uvicorn on port 8000. Run uvicorn manually on 8001 or update `api.ts` accordingly.

### Frontend (port 5173)
```bash
cd frontend
npm run dev       # Dev server
npm run build     # tsc -b && vite build
npm run lint      # ESLint
```

### Backend
```bash
cd backend
uvicorn main:app --reload --port 8001   # Match the port in api.ts
```

### Tests
```bash
python test_phase1.py    # Core module tests (run from repo root)
```

## Architecture

### Backend (FastAPI)
- **Entry point**: `backend/main.py` — mounts three routers under `/api/data`, `/api/tables`, `/api/compute`
- **Global state**: `backend/api/data.py` uses a module-level `data_store` dict to persist the loaded DataFrame and metadata across requests — not multi-user safe
- **Routers**:
  - `api/data.py` — upload CSV/MDD, load sample, return variables and data info
  - `api/tables.py` — CRUD for table definitions (not actively used by the frontend)
  - `api/compute.py` — `POST /crosstab` is the core endpoint; handles weighted counts, per-column stats, and filter application

### Core Python Modules (`backend/core/`)
- `tabulator.py` — `create_crosstab(df, row_defs, col_defs, weight_col, filter_def)` builds the cross-tab matrix; returns a DataFrame with row/column totals
- `code_parser.py` — `parse_code_def(code_def, df)` converts a code definition string into a pandas boolean Series mask. Supported syntax:
  - `Q1/1,2,3` — discrete codes
  - `Q1/1..5` — range
  - `Q1/1+Q2/2` — OR (union of masks)
  - `Q1/1.Q2/2` — AND (intersection)
  - `!Q1/1` — negation
  - `Q1/*` — has any value
- `statistics.py` — `calculate_frequencies()` returns row%, col%, total% from a crosstab DataFrame
- `mdd_parser.py` — parses IBM Dimensions XML metadata; handles namespace variants and gracefully degrades
- `data_loader.py` — `load_csv()` with chardet encoding detection and delimiter inference

> **Legacy**: `core/` and `ui/` at the repo root are Streamlit-era copies. Always use `backend/core/` for active development.

### Frontend (React + TypeScript + Vite)

**All pages are inlined in `App.tsx`** — there is no separate `pages/` directory with standalone files. The single 1000+ line `App.tsx` contains BuildPage, WelcomeScreen, ResultTab, and EditVariablesPage as local components.

**State**: `frontend/src/store/useStore.ts` (Zustand) is the single source of truth. All mutations use action functions — never mutate state directly. Key slices:
- `variables` — variable metadata fetched from backend (name, label, type, codes, stat toggles)
- `tables` — array of table definitions, each with `row_items`, `col_items`, `filter_def`, and `result`
- `activeTableId` — which table is being edited/viewed
- `displayOptions` — `counts`, `colPct`, `showPctSign`, `decimalPlaces`

**API**: `frontend/src/lib/api.ts` (axios). Three clients: `dataApi`, `tablesApi`, `computeApi`. `computeApi.crosstab()` is the primary call.

**Drag-and-drop**: dnd-kit. Variables drag from the sidebar VariableList into one of three drop zones in BuildPage — Header (columns), Sidebreak (rows), or Filter. All drag logic lives in `App.tsx`.

## Key Data Flows

**Loading data**: Upload CSV or load sample → backend stores DataFrame in `data_store` → frontend calls `getVariables()` → Zustand stores variable metadata.

**Building a table**: Drag variables to Header/Sidebreak zones → each drop creates an item with `codeDef` (e.g., `Q1/1,2,3`) → click Run → `computeApi.crosstab()` sends `row_items`, `col_items`, optional `filter_def` and `mean_score_mappings` → result stored in `tables[activeTableId].result` → ResultTab renders it.

**Mean/stats computation**: On the EditVariablesPage, users assign numeric scores to codes and toggle `showMean` / `showStdError` etc. per variable. These are sent as `mean_score_mappings` in the crosstab request; the backend computes stats per column and returns them alongside counts.

## Supported File Formats
- **Data**: CSV/TXT only — encoding and delimiter are auto-detected
- **Metadata**: MDD in text/XML format paired with CSV — binary DDF/DZF, compiled MDD, and ZIP uploads are not supported
