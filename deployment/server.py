"""
Attaché static server — FastAPI + uvicorn.

The app is 100% client-side; this server only ships the built bundle with the
headers on-device inference needs:

  - Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy make the page
    cross-origin isolated so LiteRT.js can use multi-threaded WASM
    (SharedArrayBuffer). `credentialless` still allows model downloads from
    CORS hosts (huggingface.co, storage.googleapis.com).
  - Long-lived immutable caching for hashed assets, no-cache for index.html.

Deliberately the same shape as a FastAPI service that serves an SPA bundle
on Cloud Run (see vitark backend_service), so it drops into that workflow.
"""
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.staticfiles import StaticFiles

DIST = Path(__file__).resolve().parent.parent / "dist"

ISOLATION_HEADERS = {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "credentialless",
    "X-Content-Type-Options": "nosniff",
}


class HeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        for key, value in ISOLATION_HEADERS.items():
            response.headers[key] = value

        path = request.url.path
        if path.startswith("/assets/") or path.startswith("/wasm/"):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        else:
            response.headers["Cache-Control"] = "no-cache"
        return response


app = FastAPI(title="attache-static", docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(HeadersMiddleware)


@app.get("/healthz", include_in_schema=False)
async def healthz() -> dict:
    return {"status": "ok"}


class SPAStaticFiles(StaticFiles):
    """Serve files; fall back to index.html for client-side routes."""

    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if response.status_code == 404:
            return FileResponse(DIST / "index.html")
        return response


app.mount("/", SPAStaticFiles(directory=DIST, html=True), name="app")
