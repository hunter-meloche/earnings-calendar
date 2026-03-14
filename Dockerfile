# Stage 1: Build React frontend
FROM node:20-slim AS frontend-build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# No VITE_API_URL — uses relative /api/ URLs, served from same origin
RUN npm run build

# Stage 2: Python backend serving API + static frontend
FROM python:3.11-slim
WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
# Copy built frontend into backend/static/ so FastAPI serves it
COPY --from=frontend-build /app/dist ./static

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
