import argparse
import socket
import subprocess
import sys
import threading
import time
import webbrowser


def main():
    parser = argparse.ArgumentParser(description="opentab - Survey data cross-tabulation tool")
    parser.add_argument(
        "--port",
        type=int,
        default=8001,
        help="Port to run the server on (default: 8001)",
    )
    args = parser.parse_args()

    port = args.port
    for attempt in range(port, port + 10):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', attempt))
                port = attempt
                break
        except OSError:
            continue

    if port != args.port:
        print(f"[INFO] Port {args.port} is in use. Using port {port} instead.")

    def open_browser():
        time.sleep(1.2)
        webbrowser.open(f"http://localhost:{port}")

    threading.Thread(target=open_browser, daemon=True).start()

    cmd = [
        sys.executable, "-m", "uvicorn", "opentab.main:app",
        "--host", "127.0.0.1", "--port", str(port),
    ]

    while True:
        proc = subprocess.Popen(cmd)
        try:
            proc.wait()
        except KeyboardInterrupt:
            proc.terminate()
            break

        if proc.returncode == 42:
            print("[INFO] Update applied. Restarting...")
            time.sleep(2)
            continue
        elif proc.returncode != 0:
            print(f"[INFO] opentab exited (code {proc.returncode}). Restarting in 5s...")
            time.sleep(5)
            continue
        break
