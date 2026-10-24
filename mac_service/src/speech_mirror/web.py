"""Local-only web UI and JSON endpoint. No runtime network requests."""
from __future__ import annotations

import json
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from .pipeline import analyze
from .reference import sentence_reference
from .targets import EXERCISES
from .schema import VisualFeatures

STATIC = Path(__file__).parents[2] / "web"


class Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, body: bytes, content_type: str, head: bool = False, cacheable: bool = False) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "public, max-age=604800" if cacheable else "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        if not head:
            self.wfile.write(body)

    def _serve_static(self, head: bool = False) -> None:
        path = urlparse(self.path).path
        name = "index.html" if path == "/" else path.lstrip("/")
        asset = (STATIC / name).resolve()
        if not asset.is_relative_to(STATIC.resolve()) or not asset.is_file():
            self._send(404, b"Not found", "text/plain", head=head)
            return
        mime = mimetypes.guess_type(asset.name)[0] or "application/octet-stream"
        if asset.suffix == ".mjs":
            mime = "text/javascript"
        elif asset.suffix == ".wasm":
            mime = "application/wasm"
        if mime.startswith("text/") or mime == "text/javascript":
            mime += "; charset=utf-8"
        self._send(200, asset.read_bytes(), mime, head=head, cacheable=name.startswith("vendor/"))

    def do_HEAD(self) -> None:
        self._serve_static(head=True)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/api/exercises":
            self._send(200, json.dumps(EXERCISES, ensure_ascii=False).encode(), "application/json; charset=utf-8")
            return
        if path == "/api/reference":
            try:
                phrase = parse_qs(parsed.query).get("text", [""])[0]
                result = sentence_reference(phrase)
                self._send(200, json.dumps(result, ensure_ascii=False).encode(), "application/json; charset=utf-8")
            except (ValueError, ImportError, RuntimeError, OSError) as exc:
                self._send(400, json.dumps({"error": str(exc)}, ensure_ascii=False).encode(), "application/json; charset=utf-8")
            return
        self._serve_static()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path != "/api/analyze":
            self._send(404, b"Not found", "text/plain")
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size < 44 or size > 12_000_000:
                raise ValueError("WAV 文件需小于 12 MB 且包含音频。")
            query = parse_qs(parsed.query)
            goal = query.get("target_duration_s", [""])[0]
            visual_raw = self.headers.get("X-Speech-Mirror-Visual", "")
            if len(visual_raw) > 1500:
                raise ValueError("视频摘要过长。")
            visual = VisualFeatures.model_validate_json(visual_raw).model_dump() if visual_raw else None
            result = analyze(
                self.rfile.read(size),
                query.get("exercise_id", ["free_speech"])[0],
                float(goal) if goal else None,
                query.get("phonemes", ["false"])[0] == "true",
                use_gemma=query.get("gemma", ["true"])[0] != "false",
                visual_features=visual,
                intended_text=query.get("intended_text", [None])[0],
                language=query.get("language", ["zh"])[0],
                skip_phonemes=query.get("skip_phonemes", ["false"])[0] == "true",
            )
            self._send(200, json.dumps(result, ensure_ascii=False, allow_nan=False).encode(), "application/json; charset=utf-8")
        except (ValueError, OverflowError) as exc:
            self._send(400, json.dumps({"error": str(exc)}, ensure_ascii=False).encode(), "application/json; charset=utf-8")


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--host", default="127.0.0.1", help="Bind address; use a LAN address to connect an iPhone")
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Speech Mirror: http://{args.host}:{args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
