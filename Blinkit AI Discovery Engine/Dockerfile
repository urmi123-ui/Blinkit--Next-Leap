# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/web
COPY apps/web/package*.json ./
RUN npm ci
COPY apps/web/ ./
RUN npm run build

# Stage 2: Build Python Backend & Run
FROM python:3.12-slim
WORKDIR /app/api

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY apps/api/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files
COPY apps/api/ ./

# Copy compiled frontend from Stage 1
COPY --from=frontend-builder /app/web/dist /app/web/dist

# Expose port 7860 (Hugging Face default)
EXPOSE 7860

# Command to run uvicorn on port 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
