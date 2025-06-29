#!/bin/bash

# Vercel Deployment Script for TikTok Scraper Frontend
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

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    print_error "Vercel CLI not found. Installing..."
    npm install -g vercel@latest
fi

# Check if backend URL is provided
if [ -z "$1" ]; then
    print_error "Please provide your backend URL as the first argument"
    echo "Usage: $0 <BACKEND_URL>"
    echo "Example: $0 https://your-app.railway.app"
    exit 1
fi

BACKEND_URL=$1
WS_URL=$(echo $BACKEND_URL | sed 's/https:/wss:/' | sed 's/http:/ws:/')

print_status "Deploying frontend to Vercel..."
print_status "Backend URL: $BACKEND_URL"
print_status "WebSocket URL: $WS_URL"

# Change to frontend directory
cd frontend

# Set environment variables for Vercel
print_status "Setting up environment variables..."

vercel env add REACT_APP_API_URL production <<< "$BACKEND_URL"
vercel env add REACT_APP_WS_URL production <<< "$WS_URL"
vercel env add REACT_APP_TITLE production <<< "TikTok Scraper Dashboard"
vercel env add REACT_APP_VERSION production <<< "1.0.0"

# Deploy to Vercel
print_status "Deploying to Vercel..."
vercel --prod

print_success "Frontend deployed successfully!"
print_status "Your dashboard should be available at the Vercel URL provided above."

# Instructions for next steps
echo ""
print_status "Next steps:"
echo "1. Copy the Vercel URL provided above"
echo "2. Update your backend CORS_ORIGINS to include the Vercel URL"
echo "3. Start workers on your laptops using the backend URL"
echo "4. Test the connection by visiting your Vercel URL" 