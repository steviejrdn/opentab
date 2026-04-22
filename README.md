# ⧆pentab_

A modern, interactive survey data cross-tabulation tool. Upload CSV data, define variables, and build custom crosstabs with drag-and-drop interface and statistical summaries.

## Features

- 📊 **Drag-and-drop UI** — Build crosstabs without code
- 📁 **Variable Management** — Define codes, labels, statistics (mean, std dev, variance)
- 🎯 **Filtering** — Apply complex filters to crosstabs
- 📈 **Weighted Counts** — Support for survey weights
- 🎨 **Dark Mode** — Built-in light/dark theme toggle
- 📦 **Resizable Sidebar** — Customize your workspace
- 💾 **Session Save/Load** — Export/import `.opentab` files

## End User Install

```bash
pip install git+https://github.com/steviejrdn/opentab.git
opentab
```

Browser opens automatically at http://localhost:8001.

## Developer Quick Start (Docker)

**Prerequisites:** [Docker](https://www.docker.com/products/docker-desktop) and Docker Compose

```bash
git clone https://github.com/steviejrdn/opentab.git
cd opentab
docker-compose up
```

- Backend (FastAPI + hot reload): http://localhost:8001
- Frontend (Vite + React + hot reload): http://localhost:5173

Stop with `Ctrl+C`.

## Local Development (without Docker)

### Requirements

- **Backend**: Python 3.11+, pip
- **Frontend**: Node.js 20+, npm

### Setup Backend

```bash
pip install -e .
uvicorn opentab.main:app --reload --port 8001
```

Backend API docs: http://localhost:8001/api/docs

### Setup Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173

## Architecture

### Backend (FastAPI)
- **Entry**: `opentab/main.py`
- **Core modules**: `opentab/core/` — cross-tabulation, statistics, data parsing
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
opentab/
├── opentab/
│   ├── main.py              # FastAPI entry
│   ├── cli.py               # `opentab` CLI entry point
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
├── pyproject.toml           # Package config (pip install)
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

Build the frontend into the package static dir, then serve everything from one process:

```bash
cd frontend && npm install && npm run build && cd ..
pip install -e .
opentab
```

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
- 🐛 [Issues](https://github.com/steviejrdn/opentab/issues) — Report bugs or request features
- 💬 Discussions — Ask questions

---

**Made with ❤️ from market researcher to another**
