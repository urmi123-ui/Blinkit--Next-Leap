# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/web
COPY Blinkit\ AI\ Discovery\ Engine/apps/web/package*.json ./
RUN npm ci
COPY Blinkit\ AI\ Discovery\ Engine/apps/web/ ./
RUN npm run build

# Stage 2: Build Python Backend & Run
FROM python:3.11-slim
WORKDIR /app/api

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Install python dependencies
COPY Blinkit\ AI\ Discovery\ Engine/apps/api/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files
COPY Blinkit\ AI\ Discovery\ Engine/apps/api/ ./

# Copy compiled frontend from Stage 1
COPY --from=frontend-builder /app/web/dist /app/web/dist

# Expose port (default 8000, overridden by Railway $PORT)
EXPOSE 8000

# Command to run uvicorn on $PORT (defaults to 8000 if PORT is not set)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
