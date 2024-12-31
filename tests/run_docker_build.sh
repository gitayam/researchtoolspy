set -e

echo "Starting containers..."
docker compose up -d --build # run detached

# Wait for Streamlit to start. You might do a simple loop or a more advanced healthcheck.
echo "Waiting for Streamlit to be ready..."
sleep 5

# Attempt a basic HTTP GET
curl -f http://localhost:8501 || (echo "Streamlit not responding" && exit 1)

echo "Streamlit responded successfully!"
docker-compose down  # clean up