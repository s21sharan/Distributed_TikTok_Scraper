# 🎵 Distributed TikTok Scraper

A powerful, scalable, full-stack application for scraping TikTok profile data across multiple devices with real-time monitoring and management.

![TikTok Scraper Dashboard](https://img.shields.io/badge/Dashboard-React-61DAFB?style=for-the-badge&logo=react)
![Backend](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi)
![Database](https://img.shields.io/badge/Database-Redis-DC382D?style=for-the-badge&logo=redis)
![Deployment](https://img.shields.io/badge/Deploy-Docker-2496ED?style=for-the-badge&logo=docker)

## 🚀 Quick Start

Get up and running in minutes with our automated setup script:

```bash
# Clone the repository
git clone <your-repo-url>
cd tiktok-music-trends

# Run the automated setup
./setup.sh

# Access the dashboard
open http://localhost:3000
```

That's it! The script will handle Docker setup, environment configuration, and service startup.

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Deployment](#-deployment)
- [Configuration](#-configuration)
- [Development](#-development)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

## ✨ Features

### 🎯 Core Functionality
- **Distributed Scraping**: Deploy workers across multiple devices for parallel processing
- **Aggressive Auto-Scroll**: Advanced infinite scroll detection that finds ALL videos
- **Real-time Monitoring**: Live dashboard with WebSocket updates
- **Job Queue Management**: Redis-based job distribution and coordination
- **CSV Export**: Automatic data export with downloadable results
- **Progress Tracking**: Real-time progress updates for each scraping job

### 🖥️ Dashboard Features
- **Worker Management**: Monitor connected devices and their status
- **Job Control**: Create, monitor, and manage scraping jobs
- **Live Statistics**: Real-time metrics and performance data
- **Activity Logs**: Terminal-style logging with real-time updates
- **Download Center**: Easy access to completed CSV files

### 🔧 Technical Features
- **Containerized Deployment**: Docker-based architecture for easy scaling
- **Health Monitoring**: Built-in health checks and auto-recovery
- **Browser Automation**: Selenium-based scraping with Chrome/ChromeDriver
- **API-First Design**: RESTful API with OpenAPI/Swagger documentation
- **Responsive UI**: Modern React interface with Tailwind CSS

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend │    │  FastAPI Backend │    │  Redis Database  │
│   (Dashboard)    │◄──►│  (Coordinator)   │◄──►│  (Job Queue)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │    Worker Nodes         │
                    │  ┌─────────┐ ┌─────────┐│
                    │  │Worker 1 │ │Worker 2 ││
                    │  └─────────┘ └─────────┘│
                    │  ┌─────────┐ ┌─────────┐│
                    │  │Worker 3 │ │Worker N ││
                    │  └─────────┘ └─────────┘│
                    └─────────────────────────┘
```

### Component Breakdown

#### Frontend (React Dashboard)
- **Dashboard.js**: Main dashboard with real-time updates
- **WorkerCard.js**: Individual worker status display
- **JobCard.js**: Job progress and management
- **JobForm.js**: Create new scraping jobs
- **StatsCard.js**: System statistics display

#### Backend (FastAPI)
- **coordinator.py**: Central job coordination server
- **worker.py**: Distributed worker nodes
- **async_scraper.py**: Aggressive TikTok scraping logic
- **database.py**: Redis and SQLite integration
- **models.py**: Data models and validation

## 🛠️ Installation

### Prerequisites

- **Docker** (v20.10+)
- **Docker Compose** (v2.0+)
- **Git**

### Option 1: Automated Setup (Recommended)

```bash
# Clone and setup in one go
git clone <your-repo-url>
cd tiktok-music-trends
./setup.sh
```

### Option 2: Manual Setup

```bash
# 1. Clone repository
git clone <your-repo-url>
cd tiktok-music-trends

# 2. Create environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Build and start services
docker-compose up -d redis coordinator frontend

# 4. Optional: Start worker nodes
docker-compose --profile workers up -d worker
```

### Option 3: Development Setup

```bash
# Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Frontend setup
cd ../frontend
npm install

# Start services individually
# Terminal 1: Redis
redis-server

# Terminal 2: Backend
cd backend && python coordinator.py

# Terminal 3: Frontend
cd frontend && npm start

# Terminal 4: Worker (optional)
cd backend && python worker.py
```

## 📖 Usage

### Basic Usage

1. **Access Dashboard**: Open http://localhost:3000
2. **Create Job**: Click "New Job" and enter a TikTok profile URL
3. **Monitor Progress**: Watch real-time updates in the dashboard
4. **Download Results**: Click download when job completes

### Advanced Usage

#### Scaling Workers

```bash
# Start additional workers
./setup.sh start-workers

# Or manually scale
docker-compose up -d --scale worker=5
```

#### Remote Workers

Workers can connect from different machines:

```bash
# On remote machine
python worker.py --coordinator-host YOUR_COORDINATOR_IP --redis-host YOUR_REDIS_IP
```

#### API Access

```bash
# Create job via API
curl -X POST "http://localhost:8000/jobs" \
  -H "Content-Type: application/json" \
  -d '{"profile_url": "https://www.tiktok.com/@username"}'

# Check job status
curl "http://localhost:8000/jobs/{job_id}"

# Download results
curl "http://localhost:8000/jobs/{job_id}/download" -o results.csv
```

## 📚 API Documentation

Interactive API documentation is available at:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/jobs` | Create scraping job |
| GET | `/jobs` | List all jobs |
| GET | `/jobs/{job_id}` | Get job details |
| DELETE | `/jobs/{job_id}` | Cancel job |
| GET | `/jobs/{job_id}/download` | Download CSV |
| GET | `/workers` | List workers |
| GET | `/stats` | System statistics |
| WebSocket | `/ws` | Real-time updates |

## 🚢 Deployment

### Production Deployment

```bash
# Use production profile with nginx
docker-compose --profile production up -d

# With SSL (requires SSL certificates in ./ssl/)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Cloud Deployment

#### AWS ECS
```bash
# Build and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker build -t tiktok-scraper-coordinator ./backend
docker tag tiktok-scraper-coordinator:latest <account>.dkr.ecr.us-east-1.amazonaws.com/tiktok-scraper-coordinator:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/tiktok-scraper-coordinator:latest
```

#### Google Cloud Run
```bash
# Build and deploy
gcloud builds submit --tag gcr.io/PROJECT_ID/tiktok-scraper-coordinator ./backend
gcloud run deploy --image gcr.io/PROJECT_ID/tiktok-scraper-coordinator --platform managed
```

#### DigitalOcean App Platform
```yaml
# app.yaml
name: tiktok-scraper
services:
- name: coordinator
  source_dir: backend
  dockerfile_path: backend/Dockerfile
  http_port: 8000
  instance_count: 1
  instance_size_slug: basic-xxs
```

### Environment Variables

#### Backend (.env)
```bash
DATABASE_URL=sqlite:///./scraper.db
REDIS_HOST=redis
REDIS_PORT=6379
CORS_ORIGINS=http://localhost:3000
DEBUG=False
SECRET_KEY=your-secret-key
MAX_WORKERS=10
SCRAPING_TIMEOUT=3600
```

#### Frontend (.env)
```bash
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000
REACT_APP_TITLE=TikTok Scraper Dashboard
REACT_APP_VERSION=1.0.0
```

## ⚙️ Configuration

### Scraper Configuration

The scraper uses aggressive auto-scroll with the following settings:

```python
# In async_scraper.py
MAX_SCROLL_ATTEMPTS = 500  # Maximum scroll attempts
NO_NEW_VIDEOS_THRESHOLD = 8  # Stop after N attempts with no new videos
NO_HEIGHT_CHANGE_THRESHOLD = 10  # Stop after N attempts with no height change
SCROLL_DELAY_RANGE = (1.5, 3.5)  # Random delay between scrolls (seconds)
```

### TikTok Selectors

The scraper uses TikTok's official selectors for maximum reliability:

```python
VIDEO_SELECTORS = [
    'a[href*="/video/"]',  # Primary video links
    'strong[data-e2e="video-views"]',  # View counts
    'strong[data-e2e="browse-like-count"]',  # Like counts
    'strong[data-e2e="browse-comment-count"]',  # Comment counts
    'strong[data-e2e="undefined-count"]',  # Bookmark counts
]
```

## 🔧 Development

### Project Structure

```
tiktok-music-trends/
├── backend/                 # FastAPI backend
│   ├── coordinator.py      # Main coordinator server
│   ├── worker.py           # Worker node implementation
│   ├── async_scraper.py    # TikTok scraping logic
│   ├── database.py         # Database connections
│   ├── models.py           # Data models
│   └── requirements.txt    # Python dependencies
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── App.js         # Main App component
│   │   └── index.js       # Entry point
│   ├── public/            # Static files
│   └── package.json       # Node dependencies
├── data/                  # CSV output directory
├── docker-compose.yml     # Docker services
├── setup.sh              # Automated setup script
└── README.md             # This file
```

### Adding New Features

1. **Backend Features**: Add endpoints in `coordinator.py`
2. **Frontend Features**: Create components in `frontend/src/components/`
3. **Scraping Logic**: Modify `async_scraper.py`
4. **Data Models**: Update `models.py`

### Testing

```bash
# Backend tests
cd backend
python -m pytest tests/

# Frontend tests
cd frontend
npm test

# Integration tests
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

### Code Style

```bash
# Backend formatting
black backend/
isort backend/

# Frontend formatting
cd frontend && npm run format
```

## 🔍 Troubleshooting

### Common Issues

#### "Connection refused" errors
```bash
# Check if services are running
docker-compose ps

# Restart services
./setup.sh restart
```

#### Workers not connecting
```bash
# Check coordinator logs
./setup.sh logs coordinator

# Check worker logs
./setup.sh logs worker

# Verify Redis connection
docker-compose exec redis redis-cli ping
```

#### Scraping failures
```bash
# Enable debug mode
export DEBUG=True

# Check Chrome/ChromeDriver version
docker-compose exec worker google-chrome --version
docker-compose exec worker chromedriver --version
```

#### Frontend not loading
```bash
# Check if API is accessible
curl http://localhost:8000/health

# Rebuild frontend
docker-compose build frontend
```

### Performance Tuning

#### High Memory Usage
```bash
# Reduce worker count
docker-compose up -d --scale worker=2

# Limit Chrome processes
# Add to chrome options: --max_old_space_size=2048
```

#### Slow Scraping
```bash
# Increase worker count
docker-compose up -d --scale worker=5

# Optimize scroll settings in async_scraper.py
```

### Monitoring

```bash
# Monitor resource usage
docker stats

# Monitor logs in real-time
./setup.sh logs

# Check Redis memory usage
docker-compose exec redis redis-cli INFO memory
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines

- Follow PEP 8 for Python code
- Use ESLint/Prettier for JavaScript
- Add tests for new features
- Update documentation
- Use semantic commit messages

### Coding Standards

- **Python**: Black formatting, type hints, docstrings
- **JavaScript**: ES6+, functional components, hooks
- **Docker**: Multi-stage builds, security best practices
- **Git**: Conventional commits, feature branches

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **TikTok** for providing the platform (use responsibly!)
- **Selenium** for browser automation
- **FastAPI** for the amazing async framework
- **React** for the powerful frontend framework
- **Redis** for reliable job queuing
- **Docker** for containerization

## 📞 Support

- **Issues**: Create an issue on GitHub
- **Discussions**: Use GitHub Discussions
- **Email**: [your-email@example.com]

## 🔗 Links

- [Live Demo](https://your-demo-url.com)
- [Documentation](https://your-docs-url.com)
- [Docker Hub](https://hub.docker.com/r/your-username/tiktok-scraper)
- [API Reference](http://localhost:8000/docs)

---

**⚠️ Disclaimer**: This tool is for educational and research purposes only. Please respect TikTok's Terms of Service and robots.txt. Use responsibly and at your own risk.

**🔒 Privacy**: This tool only scrapes publicly available data. No private or personal information is accessed or stored.
