#!/bin/bash
cd "$(dirname "$0")"

# Check if script is already running
if pgrep -f "Docker-App-Startup" > /dev/null; then
    echo "Script is already running in another window."
    exit 1
fi

# Set window title (works in most terminals)
echo -en "\033]0;Docker-App-Startup\a"

# Check if containers exist and are running
if docker compose ps -q >/dev/null 2>&1; then
    echo "Containers are already running"
else
    # Check if containers exist but are stopped
    if docker compose ps -a -q >/dev/null 2>&1; then
        echo "Starting existing containers..."
        docker compose start
    else
        # If no containers exist, build and start new ones
        echo "No existing containers found. Building and starting new containers..."
        docker compose up --build -d
    fi
fi

# Show logs
echo "Showing container logs..."
docker compose logs -f 