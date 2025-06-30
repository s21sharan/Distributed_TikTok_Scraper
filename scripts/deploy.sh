#!/bin/bash

# TikTok Scraper Dashboard Deployment Script

set -e

echo "🚀 Deploying TikTok Scraper Dashboard..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration before continuing."
    read -p "Press Enter after you've configured the .env file..."
fi

# Create results directory
mkdir -p results

# Build and start services
echo "🏗️  Building Docker images..."
docker-compose build

echo "🗄️  Starting database and Redis..."
docker-compose up -d postgres redis

echo "⏳ Waiting for database to be ready..."
until docker-compose exec postgres pg_isready -U scraper_user -d tiktok_scraper; do
    echo "Waiting for database..."
    sleep 2
done

echo "🌱 Running database migrations..."
docker-compose run --rm scraper-ui npx prisma migrate deploy

echo "🌱 Seeding database..."
docker-compose run --rm scraper-ui npx prisma db seed

echo "🚀 Starting all services..."
docker-compose up -d

echo "✅ Deployment complete!"
echo ""
echo "🌐 Services are running on:"
echo "  - Dashboard: http://localhost:3000"
echo "  - Dashboard (Instance 2): http://localhost:3001"
echo "  - Load Balancer: http://localhost"
echo "  - Database: localhost:5432"
echo "  - Redis: localhost:6379"
echo ""
echo "📊 View logs with: docker-compose logs -f"
echo "🛑 Stop services with: docker-compose down" 