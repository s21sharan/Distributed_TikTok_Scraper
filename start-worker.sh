#!/bin/bash

# Worker Startup Script for Remote Coordinator
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if coordinator URL is provided
if [ -z "$1" ]; then
    print_error "Please provide your coordinator URL as the first argument"
    echo "Usage: $0 <COORDINATOR_URL> [OPTIONS]"
    echo "Example: $0 https://your-app.railway.app"
    echo ""
    echo "Options:"
    echo "  --docker     Use Docker to run the worker"
    echo "  --local      Run worker locally (requires Python setup)"
    echo "  --headless   Run in headless mode (no browser UI)"
    exit 1
fi

COORDINATOR_URL=$1
shift  # Remove first argument

# Extract host and port from URL
if [[ $COORDINATOR_URL =~ ^https?://([^/:]+)(:[0-9]+)?(/.*)?$ ]]; then
    COORDINATOR_HOST="${BASH_REMATCH[1]}"
    COORDINATOR_PORT="${BASH_REMATCH[2]:-:443}"
    if [[ $COORDINATOR_URL =~ ^http:// ]]; then
        COORDINATOR_PORT="${COORDINATOR_PORT:-:80}"
    fi
    COORDINATOR_PORT="${COORDINATOR_PORT#:}"  # Remove leading colon
else
    print_error "Invalid coordinator URL format"
    exit 1
fi

print_status "Starting worker for coordinator: $COORDINATOR_URL"
print_status "Host: $COORDINATOR_HOST, Port: $COORDINATOR_PORT"

# Check command line options
USE_DOCKER=false
USE_LOCAL=false
HEADLESS_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --docker)
            USE_DOCKER=true
            shift
            ;;
        --local)
            USE_LOCAL=true
            shift
            ;;
        --headless)
            HEADLESS_MODE=true
            shift
            ;;
        *)
            print_warning "Unknown option: $1"
            shift
            ;;
    esac
done

# Auto-detect if no option specified
if [ "$USE_DOCKER" = false ] && [ "$USE_LOCAL" = false ]; then
    if command -v docker &> /dev/null; then
        print_status "Docker detected, using Docker mode"
        USE_DOCKER=true
    elif command -v python3 &> /dev/null; then
        print_status "Python detected, using local mode"
        USE_LOCAL=true
    else
        print_error "Neither Docker nor Python found. Please install one of them."
        exit 1
    fi
fi

# Docker mode
if [ "$USE_DOCKER" = true ]; then
    print_status "Starting worker in Docker mode..."
    
    # Build worker image if it doesn't exist
    if [[ "$(docker images -q tiktok-worker 2> /dev/null)" == "" ]]; then
        print_status "Building worker Docker image..."
        docker build -t tiktok-worker -f backend/Dockerfile.worker backend/
    fi
    
    # Create data directory
    mkdir -p data
    
    # Run worker container
    docker_args=(
        --rm
        -it
        -v "$(pwd)/data:/app/data"
        -e "COORDINATOR_HOST=$COORDINATOR_HOST"
        -e "COORDINATOR_PORT=$COORDINATOR_PORT"
        -e "REDIS_HOST=$COORDINATOR_HOST"
    )
    
    if [ "$HEADLESS_MODE" = true ]; then
        docker_args+=(-e "HEADLESS=true")
    fi
    
    print_success "Starting Docker worker..."
    docker run "${docker_args[@]}" tiktok-worker
fi

# Local mode
if [ "$USE_LOCAL" = true ]; then
    print_status "Starting worker in local mode..."
    
    # Check if dependencies are installed
    if ! python3 -c "import redis, fastapi, selenium" 2>/dev/null; then
        print_status "Installing Python dependencies..."
        pip3 install -r backend/requirements.txt
    fi
    
    # Create data directory
    mkdir -p data
    
    # Start worker
    worker_args=(
        "--coordinator-host" "$COORDINATOR_HOST"
        "--coordinator-port" "$COORDINATOR_PORT"
        "--redis-host" "$COORDINATOR_HOST"
    )
    
    if [ "$HEADLESS_MODE" = true ]; then
        worker_args+=("--headless")
    fi
    
    print_success "Starting local worker..."
    cd backend
    python3 worker.py "${worker_args[@]}"
fi 