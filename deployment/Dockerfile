# ---------------------------------------------------------------
# Stage 1 — build the Vite bundle (Node)
# ---------------------------------------------------------------
FROM node:24-slim AS build
WORKDIR /app

COPY package.json package-lock.json* ./
COPY scripts ./scripts
# postinstall (copy-wasm) needs node_modules present first
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
# re-run in case npm ci skipped scripts, then build
RUN node scripts/copy-wasm.mjs && npm run build

# ---------------------------------------------------------------
# Stage 2 — serve with FastAPI/uvicorn (Python)
# ---------------------------------------------------------------
FROM python:3.12-slim AS runtime
WORKDIR /srv

RUN adduser --disabled-password --gecos "" appuser

COPY deployment/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY deployment/server.py ./deployment/server.py
COPY --from=build /app/dist ./dist

USER appuser
ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "uvicorn deployment.server:app --host 0.0.0.0 --port ${PORT}"]
