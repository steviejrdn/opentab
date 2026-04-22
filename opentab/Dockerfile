FROM python:3.11-slim

WORKDIR /app

COPY opentab/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY opentab/ opentab/

EXPOSE 8001

CMD ["uvicorn", "opentab.main:app", "--reload", "--host", "0.0.0.0", "--port", "8001"]
