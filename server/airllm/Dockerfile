FROM python:3.10-slim

WORKDIR /app

# Dépendances système pour PyTorch / AirLLM
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 11435

CMD ["python", "airllm_server.py"]
