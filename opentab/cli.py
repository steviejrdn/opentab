import argparse
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

    def open_browser():
        time.sleep(1.2)
        webbrowser.open(f"http://localhost:{args.port}")

    threading.Thread(target=open_browser, daemon=True).start()
    uvicorn.run("opentab.main:app", host="127.0.0.1", port=args.port)
