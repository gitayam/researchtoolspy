# /researchtools_streamlit/Dockerfile
FROM python:3.9-slim

# Install system dependencies if needed (e.g., for hashing images)
RUN apt-get update && apt-get install -y libmagic1 curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app/

EXPOSE 8501
CMD ["streamlit", "run", "app.py", "--server.port=8501", "--server.address=0.0.0.0"]

