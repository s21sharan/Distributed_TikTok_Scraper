#!/bin/bash

# TikTok Worker Installation Script
echo "Installing TikTok Scraper Worker..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js 16+ first."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is not installed. Please install Python 3.8+ first."
    echo "Visit: https://python.org/"
    exit 1
fi

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install

# Install Python dependencies
echo "Installing Python dependencies..."
pip3 install -r requirements.txt

# Copy environment file
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo "Please edit .env file with your configuration:"
    echo "- API_BASE_URL: Your Vercel app URL"
    echo "- REDIS_URL: Your Redis connection string"
    echo "- WORKER_NAME: Unique name for this worker"
    echo ""
    echo "Then run: npm start"
else
    echo ".env file already exists"
fi

echo "Installation complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Run 'npm start' to start the worker"
echo "3. The worker will automatically connect to your Vercel dashboard" 