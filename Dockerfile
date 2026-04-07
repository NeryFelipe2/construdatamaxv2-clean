FROM python:3.12-slim

# System deps for GDAL/Fiona/GeoPandas
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ gdal-bin libgdal-dev proj-bin libproj-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN pip install --no-cache-dir -r backend/requirements.txt

EXPOSE 8787

CMD ["python", "backend/main.py"]
