# opentab_ - Full Rebuild Plan (React + FastAPI)

## Tech Stack
- **Backend**: FastAPI (Python) + pandas
- **Frontend**: React + TypeScript + Vite
- **Drag & Drop**: @dnd-kit/core + @dnd-kit/sortable
- **Styling**: Tailwind CSS
- **State Management**: Zustand

## Project Structure
```
C:\Users\stvjr\Documents\tabulator\
├── backend/
│   ├── main.py                    # FastAPI app
│   ├── requirements.txt
│   ├── core/                      # Reuse existing modules
│   └── api/                       # API endpoints
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── store/useStore.ts      # Zustand store
│       ├── components/
│       │   ├── Layout.tsx
│       │   ├── TableList.tsx      # Left-top
│       │   ├── VariableList.tsx   # Left-bottom (draggable)
│       │   ├── BuildTab.tsx       # Grid layout
│       │   ├── FilterTab.tsx
│       │   ├── ResultTab.tsx
│       │   ├── DropZone.tsx
│       │   ├── CodeSelector.tsx
│       │   └── CrosstabTable.tsx
│       └── lib/api.ts
└── sample_data/                   # Reuse existing
```

## UI Layout
```
┌─────────────────────────────────────────────────────────┐
│  opentab_                             [Load Data] [⚙️]  │
├──────────────────────┬──────────────────────────────────┤
│  📋 Tables           │  [Build]  [Filter]  [Result]    │
│  Table 1  [●]        │                                   │
│  Table 2  [○]        │  Column Drop Zone (horizontal)   │
│  [+ New Table]       │  ┌──────┐ ┌──────┐ ┌───┐        │
│                      │  │ Q1/1 │ │ Q2/2 │ │ + │        │
│  📊 Variables        │  └──────┘ └──────┘ └───┘        │
│  Gender     [drag]   │                                   │
│  Age        [drag]   │  ┌──────┬───────────────────────┐│
│  Q1         [drag]   │  │ Row  │  Grid Preview Area    ││
│  Q2         [drag]   │  │ Drop │  (crosstab structure) ││
│  Q3         [drag]   │  │ Zone │                       ││
│                      │  └──────┴───────────────────────┘│
└──────────────────────┴──────────────────────────────────┘
```

## API Endpoints
- `POST /api/data/upload` - Upload CSV
- `GET /api/data/variables` - Get variables + code frames
- `POST /api/data/load-sample` - Load sample data
- `GET/POST/PUT/DELETE /api/tables` - Table CRUD
- `POST /api/compute/crosstab` - Generate crosstab

## D&D Flow
1. Drag variable from VariableList
2. Drop on Row/Column zone
3. CodeSelector modal opens → select codes
4. Auto-generate code def (Q1/1..3 or Q1/1,3)
5. Added as reorderable chip

## Implementation Phases
1. **Backend Setup** - FastAPI + API endpoints
2. **Frontend Setup** - Vite + React + TS + Tailwind
3. **Core UI** - 3-panel layout + components
4. **D&D Integration** - @dnd-kit + code selector
5. **Filter & Result Tabs** - Full functionality
6. **API Integration** - Connect frontend ↔ backend
7. **Polish** - Styling, accessibility, sample data

## Dependencies
**Backend**: fastapi, uvicorn, python-multipart, pandas, numpy, chardet, pydantic

**Frontend**: react, @dnd-kit/core, @dnd-kit/sortable, zustand, axios, tailwindcss
