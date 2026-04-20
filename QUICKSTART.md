# Quick Start Guide

## Run with Docker (Recommended)

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop)

```bash
docker-compose up
```

Open http://localhost:5173 in browser. That's it! ✨

**Stop:** Press `Ctrl+C`

**Rebuild after code changes:** `docker-compose up --build`

---

## Run Locally (Development)

**Prerequisites:** Python 3.11+, Node 20+

### Terminal 1 — Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

### Terminal 2 — Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in browser.

---

## Usage

### 1. Upload Data
- Drag & drop CSV/TXT file
- Or click "upload" button
- Auto-detects encoding/delimiter

### 2. Define Variables
- Click "variables" tab
- Edit labels, codes, statistics
- Toggle mean, std dev, variance, etc.

### 3. Build Crosstab
- Go to "build" tab
- Drag variables to Header/Sidebreak
- (Optional) Add filter
- Click "Run"

### 4. Export Results
- "save" button → exports `.opentab` file
- "open" button → load previous session

---

## Troubleshooting

### Docker won't start
```bash
docker-compose down
docker system prune
docker-compose up --build
```

### Port already in use
Change in `docker-compose.yml`:
```yaml
ports:
  - "5173:5173"  # Frontend port
  - "8001:8001"  # Backend port
```

### Frontend shows "Cannot POST /api/data/upload"
- Make sure backend is running
- Check `VITE_API_URL` in `.env`
- Restart frontend: `npm run dev`

### CSV upload fails
- Check file is `.csv` or `.txt`
- Make sure file has headers
- Check encoding (UTF-8 recommended)

---

## Environment Setup

### .env file (optional)
Create `.env.local` in `frontend/` for dev overrides:
```
VITE_API_URL=http://localhost:8001
```

### Docker Environment
Backend & Frontend communicate via service name: `http://backend:8001`

---

## Next Steps

- 📖 Read [README.md](README.md) for full docs
- 🏗️ See [CLAUDE.md](CLAUDE.md) for architecture
- 🤝 Check [CONTRIBUTING.md](CONTRIBUTING.md) for contributing
- 🚀 See [SETUP_GITHUB.md](SETUP_GITHUB.md) to push to GitHub

---

**Questions?** Open an issue on GitHub!
