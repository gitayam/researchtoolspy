FROM python:3.9-slim

# Set environment variables
ENV XDG_RUNTIME_DIR=/tmp/runtime-root \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=100

# Combine RUN commands to reduce layers and install only necessary packages
RUN mkdir -p /tmp/runtime-root && chmod 777 /tmp/runtime-root && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
    wkhtmltopdf \
    xfonts-75dpi \
    xfonts-base \
    fonts-dejavu \
    graphviz \
    wget \
    gnupg2 \
    build-essential \
    python3-dev && \
    rm -rf /var/lib/apt/lists/* && \
    pip install --no-cache-dir --upgrade pip setuptools wheel

WORKDIR /app

# Copy only requirements first to leverage cache
COPY requirements.txt /app/

# Install requirements in stages to better handle failures
RUN pip install --no-cache-dir -r requirements.txt --timeout 100 || \
    (pip install --no-cache-dir -r requirements.txt --timeout 100 --retries 3 || \
    (pip install --no-cache-dir -r requirements.txt --timeout 100 --retries 3 --no-deps && \
     pip install --no-cache-dir -r requirements.txt --timeout 100 --retries 3))

# Copy the rest of the application code
COPY . /app/

# Clean up build dependencies
RUN apt-get purge -y build-essential python3-dev && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

EXPOSE 8502
CMD ["streamlit", "run", "app.py", "--server.port=8502", "--server.address=0.0.0.0"]