import json
import os
import sys
from pathlib import Path

from fastapi import APIRouter, Body

router = APIRouter()


def _data_dir() -> Path:
    override = os.environ.get("OPENTAB_DATA_DIR")
    if override:
        return Path(override)

    if sys.platform == "win32":
        base = os.environ.get("APPDATA") or str(Path.home())
        return Path(base) / "opentab"
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "opentab"

    base = os.environ.get("XDG_DATA_HOME") or str(Path.home() / ".local" / "share")
    return Path(base) / "opentab"


def _session_file() -> Path:
    return _data_dir() / "session.json"


@router.post("/save")
async def save_session(session: dict = Body(...)):
    path = _session_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(".json.tmp")
    tmp_path.write_text(json.dumps(session), encoding="utf-8")
    os.replace(tmp_path, path)
    return {"status": "ok"}


@router.get("/load")
async def load_session():
    path = _session_file()
    if not path.exists():
        return {"exists": False, "session": None}
    try:
        session = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"exists": False, "session": None}
    return {"exists": True, "session": session}


@router.delete("")
async def clear_session():
    path = _session_file()
    try:
        path.unlink()
    except FileNotFoundError:
        pass
    return {"status": "ok"}
