FROM python:3.9-slim

# Set the XDG_RUNTIME_DIR environment variable
ENV XDG_RUNTIME_DIR=/tmp/runtime-root

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
    gnupg2 && \
    rm -rf /var/lib/apt/lists/* && \
    pip install --no-cache-dir --upgrade pip

WORKDIR /app

# Copy only requirements first to leverage cache
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . /app/

EXPOSE 8502
CMD ["streamlit", "run", "app.py", "--server.port=8502", "--server.address=0.0.0.0"]