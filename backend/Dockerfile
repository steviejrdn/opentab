FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

# Expose port
EXPOSE 8001

# Default command (can be overridden by docker-compose)
CMD ["uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", "8001"]
