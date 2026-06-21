#!/bin/bash
set -e

# Wait for database container
if [ -n "$POSTGRES_DB" ] && [ -n "$POSTGRES_HOST" ]; then
    echo "Waiting for postgres DB to be ready at ${POSTGRES_HOST}:5432..."
    while ! nc -z "$POSTGRES_HOST" 5432; do
      sleep 0.5
    done
    echo "PostgreSQL started."
fi

# Apply database migrations
echo "Applying database migrations..."
python manage.py migrate --noinput

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Start ASGI server using Daphne for both HTTP and WebSocket support
echo "Starting Daphne server..."
exec daphne -b 0.0.0.0 -p 8000 table_tennis_app.asgi:application
