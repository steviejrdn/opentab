# AGENTS.md

## Project Overview
opentab_ is a survey data cross-tabulation tool. Users upload CSV data, pair with optional MDD metadata, define variables, and build crosstabs via drag-and-drop.

## Architecture
- **Frontend**: React 19 + TypeScript + Vite + Zustand + dnd-kit + Tailwind CSS 4
- **Backend**: FastAPI, three routers: `/api/data`, `/api/tables`, `/api/compute`
- **Core Logic**: `backend/core/` - tabulator, code_parser, statistics, mdd_parser, data_loader

## Development Commands

### Docker (recommended)
```bash
docker-compose up    # Backend :8001, Frontend :5173
```

### Local Development
**Frontend (port 5173)**:
```bash
cd frontend && npm install && npm run dev
```

**Backend (port 8001)**:
```bash
cd backend && pip install -r requirements.txt && uvicorn main:app --reload --port 8001
```

### Frontend Build/Lint
```bash
npm run build    # tsc -b && vite build
npm run lint     # ESLint
```

## Key Patterns

### Frontend Structure
- Main component: `frontend/src/App.tsx` (~900 lines) contains inline components: `BuildPage`, `BuildPageLayout`, `WelcomeScreen`, `EditVariablesPage`, `ResultTab`, `TableList`, `VariableList`
- Only `FilterTab` is imported from `frontend/src/components/`
- Zustand store (`frontend/src/store/useStore.ts`) is single source of truth
- Key slices: `variables`, `tables` (with `row_items`, `col_items`, `filter_items`, `filter_def`, `result`), `activeTableId`, `displayOptions`
- Session save/load exports `.opentab` files

### Code Definition Syntax (`backend/core/code_parser.py`)
- `Q1/1,2,3` - discrete codes
- `Q1/1..5` - range
- `Q1/1+Q2/2` - OR (union)
- `Q1/1.Q2/2` - AND (intersection)
- `!Q1/1` - negation
- `Q1/*` - has any value

### API Communication
- Primary: `computeApi.crosstab()` -> `POST /api/compute/crosstab`
- Backend state in `backend/api/data.py` uses module-level `data_store` dict - **not multi-user safe**
- `/api/tables` router exists but is **not actively used by frontend**

### Data Flow
1. Upload CSV/MDD -> backend stores DataFrame in `data_store` -> frontend fetches variables
2. Drag variables to Header (columns) / Sidebreak (rows) / Filter zones
3. Click Run -> `computeApi.crosstab()` sends `row_items`, `col_items`, `filter_def`, `weight_col`, `mean_score_mappings`
4. Result stored in `tables[activeTableId].result` -> rendered by `ResultTab`

### Data Formats
- **Data**: CSV/TXT only (auto-detects encoding via chardet)
- **Metadata**: MDD text/XML (IBM Dimensions)
- Binary DDF/DZF, compiled MDD, ZIP: **NOT supported**

## Important Notes
- **Port mismatch**: `start.sh` uses port 8000, but `api.ts` defaults to 8001. Always use `--port 8001` when running uvicorn manually.
- Sample data in `sample_data/` directory
- Log files: `backend.log`, `frontend.log`

## Environment Variables
- `VITE_API_URL` - backend URL (default: `http://localhost:8001`)
- Docker Compose sets `VITE_API_URL=http://backend:8001` internally
