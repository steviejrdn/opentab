# AGENTS.md

## Project Overview
Tabulator is a survey data cross-tabulation tool with React frontend and FastAPI backend.

## Architecture
- **Frontend**: React 19 + TypeScript + Vite + Zustand (state) + dnd-kit (drag-drop) + Tailwind CSS
- **Backend**: FastAPI with CORS enabled, three routers: `/api/data`, `/api/tables`, `/api/compute`
- **Core Logic**: `backend/core/` (current) vs `core/` (legacy Streamlit)
- **Legacy**: `app.py` is Streamlit-based, may be deprecated

## Development Commands

### Frontend (port 5173)
```bash
cd frontend
npm run dev        # Start dev server
npm run build      # Build (runs tsc -b && vite build)
npm run lint       # ESLint
npm run preview    # Preview production build
```

### Backend (port 8000)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload    # Start dev server
```

### Both Services
- `start.sh` - Starts backend (background) + frontend
- `node start-frontend.js` - Starts frontend only

### Testing
```bash
python test_phase1.py    # Core module tests (runs from root)
```

## Key Patterns

### State Management
- Zustand store in `frontend/src/store/useStore.ts` is single source of truth
- All mutations through action functions - no direct state mutation

### Code Definition Format
- Format: `variable_name/code1,code2,code3`
- Examples: `Q1/1`, `Q1/1..3` (range), `Q1/1+Q2/2` (combined)
- Parsed by `parse_code_def()` into pandas boolean masks

### API Communication
- Frontend: `frontend/src/lib/api.ts` (axios-based)
- Crosstab endpoint: `POST /api/compute/crosstab`
- CORS allows all origins (dev setup)

### Data Flow
1. Load CSV (or CSV+MDD) → parse metadata → extract variables
2. Drag variables to row/column zones
3. Generate table → compute crosstab → display results

### Data Format Support
- **CSV/TXT** — only supported data format (auto-detects encoding and delimiter)
- **MDD** — metadata only (text/XML format, paired with CSV via edit variables page)
- Binary DDF/DZF, compiled MDD, and ZIP uploads are NOT supported

### Variable Editing
- Variables can be edited in `/edit-variables` page: edit labels, codes, and mean scores
- Mean scores per code enable mean/std_error/std_dev/variance computation in crosstab output
- Stats toggles (`showMean`, `showStdError`, `showStdDev`, `showVariance`) control display per variable
- Mean score mappings are sent to backend via `mean_score_mappings` in crosstab request

## File Structure
```
Tabulator/
├── frontend/          # React app
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/    # BuildPage, EditVariablesPage
│   │   ├── components/
│   │   ├── store/    # Zustand
│   │   └── lib/      # API client
│   └── package.json
├── backend/           # FastAPI
│   ├── main.py
│   ├── api/          # data.py, tables.py, compute.py
│   ├── core/         # tabulator.py, code_parser.py, etc.
│   └── requirements.txt
├── core/             # Legacy shared modules
├── app.py            # Legacy Streamlit
└── test_phase1.py    # Core tests
```

## Important Notes
- Backend CORS allows `*` origins (development only)
- Code definitions must maintain backward compatibility
- Drag-drop logic in `App.tsx` BuildPage component
- Display options: `counts`, `colPct`, `showPctSign`, `decimalPlaces`
- Sample data in `sample_data/` directory
- Log files: `backend.log`, `frontend.log`
