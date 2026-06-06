FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server/ server/
COPY pyproject.toml .

EXPOSE 8788

CMD ["python", "-m", "server.main"]
