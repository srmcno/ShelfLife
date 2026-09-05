import importlib.util
import json
from pathlib import Path
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

spec = importlib.util.spec_from_file_location("desktop", Path(__file__).parents[1] / "scripts/desktop.py")
desktop = importlib.util.module_from_spec(spec)
spec.loader.exec_module(desktop)


class VoiceEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = desktop.ThreadingHTTPServer((desktop.HOST, 0), desktop.GameHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.origin = f"http://{desktop.HOST}:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, payload, origin=None, host=None):
        headers = {"Content-Type": "application/json", "Origin": origin or self.origin}
        if host:
            headers["Host"] = host
        return urlopen(Request(self.origin + "/api/voice/speak", data=json.dumps(payload).encode(), headers=headers))

    def test_same_origin_speech_returns_wave(self):
        with patch.object(desktop, "enhanced_available", return_value=True), patch.object(desktop, "speech_wave", return_value=b"RIFFvoice") as render:
            with self.request({"text": "  A very small funeral.  "}) as response:
                self.assertEqual(response.read(), b"RIFFvoice")
                self.assertEqual(response.headers["Content-Type"], "audio/wav")
                self.assertEqual(response.headers["Cache-Control"], "no-store")
            render.assert_called_once_with("A very small funeral.")

    def test_other_sites_cannot_trigger_speech(self):
        with patch.object(desktop, "speech_wave") as render:
            for kwargs in ({"origin": "https://example.com"}, {"host": "example.com"}):
                with self.assertRaises(HTTPError) as error:
                    self.request({"text": "No."}, **kwargs)
                self.assertEqual(error.exception.code, 403)
                error.exception.close()
            render.assert_not_called()

    def test_invalid_and_oversized_text_is_rejected(self):
        with patch.object(desktop, "speech_wave") as render:
            for data in ({}, [], {"text": 7}, {"text": " "}, {"text": "a" * 321}, {"text": "a" * 5000}):
                with self.assertRaises(HTTPError) as error:
                    self.request(data)
                self.assertEqual(error.exception.code, 400)
                error.exception.close()
            render.assert_not_called()

    def test_missing_voice_returns_recoverable_failure(self):
        with patch.object(desktop, "enhanced_available", return_value=False):
            with self.assertRaises(HTTPError) as error:
                self.request({"text": "Hello."})
            self.assertEqual(error.exception.code, 503)
            error.exception.close()


if __name__ == "__main__":
    unittest.main()
