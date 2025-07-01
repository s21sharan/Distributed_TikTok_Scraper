#!/bin/bash

# Check if VERCEL_URL is provided
if [ -z "$1" ]; then
    echo "Please provide your Vercel deployment URL as an argument"
    echo "Usage: ./run-vercel-worker.sh <vercel-url>"
    echo "Example: ./run-vercel-worker.sh https://your-app.vercel.app"
    exit 1
fi

# Set environment variables
export API_BASE_URL="$1"
export API_SECRET_KEY="supersecretkey123" # Make sure to change this to match your deployment's secret key

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Run the worker
node worker.js 