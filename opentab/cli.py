import uvicorn
import webbrowser
import threading
import time


def main():
    def open_browser():
        time.sleep(1.2)
        webbrowser.open("http://localhost:8001")

    threading.Thread(target=open_browser, daemon=True).start()
    uvicorn.run("opentab.main:app", host="127.0.0.1", port=8001)
