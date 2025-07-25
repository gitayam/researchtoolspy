#!/bin/bash
set -e

echo "Starting Django application..."

# Create database directory if using SQLite
db_url="${DATABASE_URL:-sqlite:///app/db.sqlite3}"
if [[ $db_url == sqlite://* ]]; then
    db_path=$(echo $db_url | sed 's|sqlite://||')
    db_dir=$(dirname $db_path)
    echo "Creating database directory: $db_dir"
    mkdir -p $db_dir
    chown -R appuser:appuser $db_dir 2>/dev/null || true
fi

# Wait for database to be ready
echo "Waiting for database to be ready..."
python << END
import os
import time
import psycopg2
from psycopg2 import OperationalError

# Parse DATABASE_URL
db_url = os.environ.get('DATABASE_URL', 'sqlite:///db.sqlite3')
if db_url.startswith('postgresql://'):
    import urllib.parse as urlparse
    url = urlparse.urlparse(db_url)
    
    max_retries = 30
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            conn = psycopg2.connect(
                database=url.path[1:],
                user=url.username,
                password=url.password,
                host=url.hostname,
                port=url.port,
            )
            conn.close()
            print("Database is ready!")
            break
        except OperationalError as e:
            retry_count += 1
            print(f"Database not ready, retrying... ({retry_count}/{max_retries})")
            time.sleep(2)
    else:
        print("Database connection failed after all retries")
        exit(1)
else:
    print("Using SQLite database")
END

# Run migrations
echo "Running database migrations..."
python manage.py migrate --noinput

# Create superuser if it doesn't exist
echo "Creating superuser if needed..."
python manage.py shell << END
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print("Superuser created: admin/admin123")
else:
    print("Superuser already exists")
END

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Start the application
echo "Starting Django development server..."
exec gunicorn --bind 0.0.0.0:8000 --workers 3 --timeout 120 research_tools_project.wsgi:application