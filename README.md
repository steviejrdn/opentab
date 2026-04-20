# ⧆pentab

A modern, interactive survey data cross-tabulation tool. Upload CSV data, define variables, and build custom crosstabs with drag-and-drop interface and statistical summaries.

## Features

- 📊 **Drag-and-drop UI** — Build crosstabs without code
- 📁 **Variable Management** — Define codes, labels, statistics (mean, std dev, variance)
- 🎯 **Filtering** — Apply complex filters to crosstabs
- 📈 **Weighted Counts** — Support for survey weights
- 🎨 **Dark Mode** — Built-in light/dark theme toggle
- 📦 **Resizable Sidebar** — Customize your workspace
- 💾 **Session Save/Load** — Export/import `.opentab` files

## Quick Start (Docker)

**Prerequisites:** [Docker](https://www.docker.com/products/docker-desktop) and Docker Compose

### Run with Docker Compose

```bash
git clone https://github.com/yourusername/tabulator.git
cd tabulator
docker-compose up
```

Then open http://localhost:5173 in your browser.

**What it does:**
- `backend` service runs on `http://localhost:8001` (FastAPI)
- `frontend` service runs on `http://localhost:5173` (Vite + React)

Stop with `Ctrl+C` (or `docker-compose down` to remove containers).

## Local Development (without Docker)

### Requirements

- **Backend**: Python 3.11+, pip
- **Frontend**: Node.js 20+, npm

### Setup Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

Backend runs on http://localhost:8001/api/docs (Swagger UI)

### Setup Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173

## Architecture

### Backend (FastAPI)
- **Entry**: `backend/main.py`
- **Core modules**: `backend/core/` — cross-tabulation, statistics, data parsing
- **API routes**: `/api/data`, `/api/tables`, `/api/compute`

### Frontend (React + TypeScript + Vite)
- **Entry**: `frontend/src/App.tsx` (single-page app)
- **State management**: Zustand (`frontend/src/store/useStore.ts`)
- **Drag-and-drop**: dnd-kit
- **Styling**: Tailwind CSS

## Usage

1. **Upload data** — CSV/TXT file (auto-detects encoding/delimiter)
2. **Define variables** — Add labels, codes, statistics toggles
3. **Build table** — Drag variables to Header/Sidebreak zones
4. **Run** — Click "Run" to compute crosstab
5. **Save** — Export session as `.opentab` file

## File Structure

```
tabulator/
├── backend/
│   ├── main.py              # FastAPI entry
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── api/                 # Route handlers
│   └── core/                # Core logic
│       ├── tabulator.py     # Crosstab builder
│       ├── code_parser.py   # Code expression parser
│       ├── statistics.py    # Frequency/stats calc
│       ├── mdd_parser.py    # IBM Dimensions metadata
│       └── data_loader.py   # CSV/MDD loader
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Main component
│   │   ├── store/           # Zustand store
│   │   ├── lib/             # API clients
│   │   └── ...
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
├── docker-compose.yml       # Docker Compose config
└── README.md                # This file
```

## Environment Variables

### Backend
- `PYTHONUNBUFFERED=1` — Stream logs in Docker

### Frontend
- `VITE_API_URL` — Backend API URL (default: `http://localhost:8001`)

## API Endpoints

### Data Management
- `POST /api/data/upload` — Upload CSV
- `GET /api/data/sample` — Load sample data
- `GET /api/data/variables` — Get variable metadata

### Crosstabs
- `POST /api/compute/crosstab` — Compute crosstab with filters, weights, stats

## Building for Production

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

### Frontend
```bash
cd frontend
npm install
npm run build  # Creates dist/ folder
npm run preview  # Test production build
```

Serve frontend with any static host (Nginx, Vercel, etc.).

## Contributing

Contributions welcome! Please:
1. Fork the repo
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Commit changes
4. Push to branch
5. Open a Pull Request

## License

MIT License — see LICENSE file

## Support

- 📖 [Project Docs](./CLAUDE.md) — Architecture & development guide
- 🐛 [Issues](https://github.com/yourusername/tabulator/issues) — Report bugs or request features
- 💬 Discussions — Ask questions

---

**Made with ❤️ for survey researchers and data analysts**
