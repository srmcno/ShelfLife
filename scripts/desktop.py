#!/usr/bin/env python3
"""Local desktop launcher: a loopback-only static server and the default browser."""
import argparse
import functools
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import URLError
from urllib.parse import unquote, urlsplit
from urllib.request import urlopen

APP_ID = "com.shelflife.local"
HOST = "127.0.0.1"
PORT = 8766
URL = f"http://{HOST}:{PORT}/"
GAME = Path(__file__).resolve().parent / "game"
VOICE = "Daniel (Enhanced)"
SPEECH_LOCK = threading.BoundedSemaphore(1)


@functools.lru_cache(maxsize=1)
def enhanced_available():
    try:
        voices = subprocess.check_output(["/usr/bin/say", "-v", "?"], text=True, timeout=5)
        return any(line.startswith(VOICE + " ") for line in voices.splitlines())
    except (OSError, subprocess.SubprocessError):
        return False


@functools.lru_cache(maxsize=16)
def speech_wave(text):
    with tempfile.TemporaryDirectory(prefix="shelf-life-speech-") as scratch:
        output = Path(scratch) / "line.wav"
        subprocess.run([
            "/usr/bin/say", "-v", VOICE, "-r", "170", "--file-format=WAVE",
            "--data-format=LEI16@22050", "-o", str(output), "-f", "-",
        ], input=text, text=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
            check=True, timeout=20)
        return output.read_bytes()


class GameHandler(SimpleHTTPRequestHandler):
    def trusted_host(self):
        return self.headers.get("Host") == f"{HOST}:{self.server.server_port}"

    def send_bytes(self, body, content_type):
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass  # The player stopped the narration while it was rendering.

    def do_GET(self):
        if not self.trusted_host():
            self.send_error(403)
            return
        path = unquote(urlsplit(self.path).path)
        if path == "/api/voice":
            self.send_bytes(json.dumps({"available": enhanced_available(), "name": VOICE}).encode(), "application/json")
            return
        if path == "/.shelf-life-health":
            body = json.dumps({"app": APP_ID, "root": str(GAME)}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        # The installed folder contains only public game assets. Hide dotfiles
        # and refuse directory listings if a URL names a non-game directory.
        if any(part.startswith(".") for part in path.split("/") if part):
            self.send_error(404)
            return
        super().do_GET()

    def do_POST(self):
        expected_origin = f"http://{HOST}:{self.server.server_port}"
        if not self.trusted_host() or self.headers.get("Origin") != expected_origin:
            self.send_error(403)
            return
        if self.path != "/api/voice/speak":
            self.send_error(404)
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 4096 or self.headers.get_content_type() != "application/json":
                raise ValueError()
            data = json.loads(self.rfile.read(size))
            text = data.get("text") if isinstance(data, dict) else None
            if not isinstance(text, str) or not 0 < len(text.strip()) <= 320:
                raise ValueError()
        except (ValueError, UnicodeError):
            self.send_error(400)
            return
        if not enhanced_available() or not SPEECH_LOCK.acquire(blocking=False):
            self.send_error(503)
            return
        try:
            audio = speech_wave(text.strip())
        except (OSError, subprocess.SubprocessError):
            self.send_error(503)
            return
        finally:
            SPEECH_LOCK.release()
        self.send_bytes(audio, "audio/wav")

    def list_directory(self, path):
        self.send_error(404)
        return None

    def end_headers(self):
        self.send_header("Cache-Control", "no-store" if self.path.startswith("/api/") else "no-cache")
        super().end_headers()


def running_here():
    try:
        with urlopen(URL + ".shelf-life-health", timeout=0.5) as response:
            status = json.load(response)
            return status.get("app") == APP_ID and status.get("root") == str(GAME)
    except (OSError, URLError, ValueError):
        return False


def serve():
    handler = functools.partial(GameHandler, directory=str(GAME))
    with ThreadingHTTPServer((HOST, PORT), handler) as server:
        server.serve_forever()


def launch(open_browser=True):
    if not (GAME / "index.html").is_file():
        raise RuntimeError("The installed game is missing. Install Shelf Life again.")
    if not running_here():
        log_dir = Path.home() / "Library" / "Logs" / "Shelf Life"
        log_dir.mkdir(parents=True, exist_ok=True)
        with (log_dir / "server.log").open("ab") as log:
            child = subprocess.Popen(
                [sys.executable, str(Path(__file__).resolve()), "--serve"],
                stdin=subprocess.DEVNULL, stdout=log, stderr=log,
                start_new_session=True,
            )
        for _ in range(50):
            if running_here():
                break
            if child.poll() is not None:
                raise RuntimeError("Shelf Life could not start. Another program may be using port 8766.")
            time.sleep(0.1)
        else:
            child.terminate()
            raise RuntimeError("Shelf Life took too long to start. Please try opening it again.")
    if open_browser:
        subprocess.run(["/usr/bin/open", URL], check=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--serve", action="store_true")
    parser.add_argument("--start-only", action="store_true")
    args = parser.parse_args()
    if args.serve:
        serve()
    else:
        launch(open_browser=not args.start_only)
