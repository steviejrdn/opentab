# AGENTS.md

## Project Overview
opentab_ is a survey data cross-tabulation tool with React frontend and FastAPI backend. Users upload CSV data, optionally pair with MDD metadata, define variables, and build crosstabs via drag-and-drop.

## Architecture
- **Frontend**: React 19 + TypeScript + Vite + Zustand (state) + dnd-kit (drag-drop) + Tailwind CSS 4 + react-router-dom
- **Backend**: FastAPI with `allow_origins=["*"]`, three routers: `/api/data`, `/api/tables`, `/api/compute`
- **Core Logic**: `backend/core/` contains all active Python modules (tabulator, code_parser, statistics, mdd_parser, data_loader).

## Development Commands

### Both Services (Docker — recommended)
```bash
docker-compose up    # Backend :8001, Frontend :5173
```

### Both Services (local — Windows)
- `start.sh` starts backend on **port 8000** but frontend expects **8001**. Use manual commands below instead.

### Frontend (port 5173)
```bash
cd frontend
npm install          # First time only
npm run dev          # Dev server
npm run build        # tsc -b && vite build
npm run lint         # ESLint
```

### Backend (port 8001)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

### Environment Variables
- `VITE_API_URL` — backend URL for frontend (default: `http://localhost:8001`). See `.env.example`.
- Docker Compose sets `VITE_API_URL=http://backend:8001` internally.

## Key Patterns

### Frontend Structure
- **Main component**: `frontend/src/App.tsx` (~900 lines) contains the inline `BuildPage`, `BuildPageLayout`, `WelcomeScreen`, `EditVariablesPage`, `ResultTab`, `TableList`, `VariableList` as local components.
- **Components directory** (`frontend/src/components/`): Only `FilterTab` is imported from a separate file. Everything else is inline in App.tsx.
- Zustand store (`frontend/src/store/useStore.ts`) is single source of truth. Never mutate state directly.
- Key slices: `variables`, `tables` (each with `row_items`, `col_items`, `filter_items`, `filter_def`, `result`), `activeTableId`, `displayOptions` (`counts`, `colPct`, `showPctSign`, `decimalPlaces`).
- Session save/load exports `.opentab` files.

### Code Definition Syntax (parsed by `backend/core/code_parser.py`)
- `Q1/1,2,3` — discrete codes
- `Q1/1..5` — range
- `Q1/1+Q2/2` — OR (union)
- `Q1/1.Q2/2` — AND (intersection, uses `.`)
- `!Q1/1` — negation
- `Q1/*` — has any value

### API Communication
- Frontend: `frontend/src/lib/api.ts` (axios). Three clients: `dataApi`, `tablesApi`, `computeApi`.
- Primary call: `computeApi.crosstab()` → `POST /api/compute/crosstab`
- Backend state: `backend/api/data.py` uses module-level `data_store` dict — **not multi-user safe**.
- `/api/tables` router exists but is **not actively used by the frontend**.

### Data Flow
1. Upload CSV (or CSV+MDD) → backend stores DataFrame in `data_store` → frontend fetches variables
2. Drag variables to Header (columns) / Sidebreak (rows) / Filter zones
3. Click Run → `computeApi.crosstab()` sends `row_items`, `col_items`, optional `filter_def`, `weight_col`, `mean_score_mappings`
4. Result stored in `tables[activeTableId].result` → rendered by ResultTab

### Data Format Support
- **Data**: CSV/TXT only (auto-detects encoding via chardet and delimiter)
- **Metadata**: MDD text/XML format (IBM Dimensions) paired with CSV
- Binary DDF/DZF, compiled MDD, and ZIP uploads are NOT supported

### Variable Editing & Statistics
- Edit variables page: edit labels, codes, and assign mean scores per code
- Stats toggles (`showMean`, `showStdError`, `showStdDev`, `showVariance`) per variable
- Mean scores sent as `mean_score_mappings` in crosstab request; backend computes stats per column

## Important Notes
- **Port mismatch**: `start.sh` launches uvicorn on 8000, but `api.ts` defaults to 8001. Always use `--port 8001` manually.
- Code definitions must maintain backward compatibility.
- Sample data in `sample_data/` directory.
- Log files: `backend.log`, `frontend.log`.
- See `CLAUDE.md` for more detailed architecture guide.
