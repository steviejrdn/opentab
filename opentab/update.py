import subprocess
import sys
import os
import time
import threading


def run_update():
    cmd = [
        sys.executable, "-m", "pip", "install", "--upgrade",
        "git+https://github.com/steviejrdn/opentab.git",
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode == 0:
            threading.Thread(target=_delayed_exit, daemon=True).start()
            return True, result.stdout.strip() or "Updated successfully"
        return False, result.stderr.strip() or "Unknown error"
    except subprocess.TimeoutExpired:
        return False, "Update timed out — check your internet connection"
    except Exception as e:
        return False, str(e)


def _delayed_exit():
    time.sleep(1)
    os._exit(0)
