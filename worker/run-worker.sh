#!/bin/bash

# TikTok Worker Start Script
echo "🚀 Starting TikTok Worker..."

# Set environment variables for development
export API_BASE_URL="https://tiktok-music-trends-kard.vercel.app"
export API_SECRET_KEY="supersecretkey123"
export REDIS_URL="redis://default:omMwvgbIPfLKXHzzrHiegbJDrXigwtRF@trolley.proxy.rlwy.net:25520"
export WORKER_NAME="Worker-$(hostname)-$$"
export WORKER_HOST="$(hostname)"
export MAX_CONCURRENT_TASKS="3"

echo "Configuration:"
echo "  API_BASE_URL: $API_BASE_URL"
echo "  WORKER_NAME: $WORKER_NAME"
echo "  WORKER_HOST: $WORKER_HOST"
echo "  REDIS_URL: $REDIS_URL"
echo ""

# Check if Node.js dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing Node.js dependencies..."
  npm install
fi

# Check if Python dependencies are installed
if [ ! -d "venv" ]; then
  echo "🐍 Setting up Python virtual environment..."
  python3 -m venv venv
  source venv/bin/activate
  echo "📦 Installing Python dependencies for TikTok scraper..."
  pip install -r requirements.txt
  pip install -r ../requirements_scraper.txt
else
  source venv/bin/activate
  echo "🔄 Ensuring Python dependencies are up to date..."
  pip install -r requirements.txt -q
  pip install -r ../requirements_scraper.txt -q
fi

# Test Python dependencies
echo "🧪 Testing Python dependencies..."
python test-python-deps.py
if [ $? -ne 0 ]; then
  echo "❌ Python dependency test failed. Please check your installation."
  exit 1
fi

echo "✅ Starting worker process..."
node worker.js 