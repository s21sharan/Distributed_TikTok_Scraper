#!/bin/bash

# TikTok Scraper - Setup Script
# This script sets up the entire distributed TikTok scraper application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check system requirements
check_requirements() {
    print_status "Checking system requirements..."
    
    # Check Docker
    if ! command_exists docker; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command_exists docker-compose; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi
    
    print_success "All requirements met!"
}

# Function to create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    
    mkdir -p data
    mkdir -p ssl
    
    print_success "Directories created!"
}

# Function to set up environment files
setup_environment() {
    print_status "Setting up environment files..."
    
    # Backend environment
    if [ ! -f backend/.env ]; then
        cat > backend/.env << EOF
DATABASE_URL=sqlite:///./scraper.db
REDIS_HOST=localhost
REDIS_PORT=6379
CORS_ORIGINS=http://localhost:3000
DEBUG=True
EOF
        print_success "Backend .env file created!"
    else
        print_warning "Backend .env file already exists, skipping..."
    fi
    
    # Frontend environment
    if [ ! -f frontend/.env ]; then
        cat > frontend/.env << EOF
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000
EOF
        print_success "Frontend .env file created!"
    else
        print_warning "Frontend .env file already exists, skipping..."
    fi
}

# Function to build Docker images
build_images() {
    print_status "Building Docker images..."
    
    docker-compose build --no-cache
    
    print_success "Docker images built successfully!"
}

# Function to start services
start_services() {
    print_status "Starting services..."
    
    # Start core services (coordinator, frontend, redis)
    docker-compose up -d redis coordinator frontend
    
    print_status "Waiting for services to be ready..."
    sleep 10
    
    # Check if services are healthy
    if docker-compose ps | grep -q "Up (healthy)"; then
        print_success "Core services started successfully!"
    else
        print_warning "Some services may not be healthy yet. Check with 'docker-compose ps'"
    fi
}

# Function to show status
show_status() {
    print_status "Current service status:"
    docker-compose ps
    
    echo ""
    print_status "Application URLs:"
    echo "  🌐 Frontend Dashboard: http://localhost:3000"
    echo "  🔧 Backend API: http://localhost:8000"
    echo "  📊 API Docs: http://localhost:8000/docs"
    echo "  ❤️  Health Check: http://localhost:8000/health"
}

# Function to start workers
start_workers() {
    print_status "Starting worker services..."
    
    docker-compose --profile workers up -d worker
    
    print_success "Worker services started!"
}

# Function to stop all services
stop_services() {
    print_status "Stopping all services..."
    
    docker-compose down
    
    print_success "All services stopped!"
}

# Function to clean up everything
cleanup() {
    print_status "Cleaning up..."
    
    docker-compose down -v --remove-orphans
    docker system prune -f
    
    print_success "Cleanup complete!"
}

# Function to show logs
show_logs() {
    local service=$1
    if [ -z "$service" ]; then
        docker-compose logs -f
    else
        docker-compose logs -f "$service"
    fi
}

# Function to show help
show_help() {
    echo "TikTok Scraper Setup Script"
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  setup          Set up the entire application (default)"
    echo "  start          Start core services"
    echo "  start-workers  Start worker services"
    echo "  stop           Stop all services"
    echo "  restart        Restart all services"
    echo "  status         Show service status"
    echo "  logs [service] Show logs (all services or specific service)"
    echo "  cleanup        Clean up all containers and volumes"
    echo "  help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 setup       # Full setup and start"
    echo "  $0 logs coordinator  # Show coordinator logs"
    echo "  $0 start-workers     # Start additional workers"
}

# Main execution
main() {
    case "${1:-setup}" in
        "setup")
            print_status "🚀 Starting TikTok Scraper setup..."
            check_requirements
            create_directories
            setup_environment
            build_images
            start_services
            show_status
            echo ""
            print_success "🎉 Setup complete!"
            print_status "You can now:"
            echo "  • Open http://localhost:3000 to access the dashboard"
            echo "  • Run '$0 start-workers' to add worker nodes"
            echo "  • Run '$0 logs' to see application logs"
            ;;
        "start")
            start_services
            show_status
            ;;
        "start-workers")
            start_workers
            show_status
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            stop_services
            start_services
            show_status
            ;;
        "status")
            show_status
            ;;
        "logs")
            show_logs "$2"
            ;;
        "cleanup")
            cleanup
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@" 