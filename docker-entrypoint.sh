#!/bin/sh
set -e

# Wait for database to be ready
echo "Waiting for database to be ready..."
while ! nc -z $DB_HOST $DB_PORT; do
  sleep 0.1
done
echo "Database is ready!"

# Run migrations
echo "Running database migrations..."
bun run typeorm migration:run -d src/config/data-source.ts
echo "Database migrations completed"

# Start the application
echo "Starting the application..."
exec bun run start:prod 
echo "Application started"