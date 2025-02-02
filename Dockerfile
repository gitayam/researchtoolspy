# /researchtools_streamlit/Dockerfile
FROM python:3.9-slim

# Set the XDG_RUNTIME_DIR environment variable
ENV XDG_RUNTIME_DIR=/tmp/runtime-root

# Create the runtime directory with proper permissions
RUN mkdir -p /tmp/runtime-root && chmod 777 /tmp/runtime-root

# Install system dependencies if needed (e.g., for hashing images)
RUN apt-get update && \
    apt-get install -y wkhtmltopdf xfonts-75dpi xfonts-base fonts-dejavu && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . /app/
COPY requirements.txt /app/
RUN pip install --upgrade pip;pip install streamlit --upgrade && pip install --no-cache-dir -r requirements.txt

COPY . /app/

EXPOSE 8502
CMD ["streamlit", "run", "app.py", "--server.port=8502", "--server.address=0.0.0.0"]

