from pathlib import Path
from importlib.metadata import version as pkg_version, PackageNotFoundError
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .api.data import router as data_router
from .api.tables import router as tables_router
from .api.compute import router as compute_router
from .update import run_update

app = FastAPI(title="opentab_ API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(data_router, prefix="/api/data")
app.include_router(tables_router, prefix="/api/tables")
app.include_router(compute_router, prefix="/api/compute")

@app.get("/api/version")
def get_version():
    try:
        return {"version": pkg_version("opentab")}
    except PackageNotFoundError:
        return {"version": "dev"}


@app.post("/api/update")
def perform_update():
    ok, msg = run_update()
    return {"status": "ok" if ok else "error", "message": msg}

static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = static_dir / full_path
        if file_path.exists() and file_path.is_file() and full_path != "index.html":
            return FileResponse(file_path)
        return FileResponse(static_dir / "index.html", headers={"Cache-Control": "no-cache"})
