FROM python:3.11-slim

WORKDIR /app
COPY pyproject.toml .
RUN pip install --no-cache-dir .

COPY server.py .
COPY __init__.py .

EXPOSE 8000
CMD ["python", "server.py"]
