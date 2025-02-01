# /researchtools_streamlit/Dockerfile
FROM python:3.9-slim

# Install system dependencies if needed (e.g., for hashing images)
RUN apt-get update && \
apt-get install -y wkhtmltopdf xfonts-75dpi xfonts-base fonts-dejavu && \
rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . /app/
COPY requirements.txt /app/
RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt

COPY . /app/

EXPOSE 8502
CMD ["streamlit", "run", "app.py", "--server.port=8502", "--server.address=0.0.0.0"]

