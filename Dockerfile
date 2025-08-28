FROM python:3.9-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=100

# Create app directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && \
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

# Copy requirements files
COPY requirements-base.txt .
COPY requirements-extra.txt .
COPY requirements.txt .

# Install base Python dependencies first
RUN pip install --no-cache-dir -r requirements-base.txt

# Try to install extra dependencies (allow failure)
RUN pip install --no-cache-dir -r requirements-extra.txt || true

# Copy the rest of the application
COPY . .

# Expose port
EXPOSE 8502

# Run the application
CMD ["streamlit", "run", "app.py", "--server.port=8502", "--server.address=0.0.0.0"]