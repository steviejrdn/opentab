import argparse
import socket
import uvicorn
import webbrowser
import threading
import time


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
    uvicorn.run("opentab.main:app", host="127.0.0.1", port=port)
