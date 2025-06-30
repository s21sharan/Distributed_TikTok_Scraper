# TikTok Scraper Dashboard - Docker Deployment

This guide explains how to deploy the TikTok Scraper Dashboard using Docker for multi-computer synchronization.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Computer 1    │    │   Computer 2    │    │   Computer N    │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │Dashboard UI │ │    │ │Dashboard UI │ │    │ │Dashboard UI │ │
│ │   :3000     │ │    │ │   :3000     │ │    │ │   :3000     │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │     Shared Database       │
                    │    PostgreSQL + Redis     │
                    │       (One Location)      │
                    └───────────────────────────┘
```

## 🚀 Quick Start

### Option 1: Single Machine Setup
```bash
# Clone the repository
git clone <your-repo>
cd tiktok-scraper-ui

# Run the deployment script
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

### Option 2: Multi-Machine Setup

#### Step 1: Setup Database Server (One Machine)
```bash
# On your database server machine
git clone <your-repo>
cd tiktok-scraper-ui

# Edit .env file for database server
cp .env.example .env
# Edit DATABASE_URL and REDIS_URL to use 0.0.0.0

# Start only database services
docker-compose up -d postgres redis

# Run migrations
docker-compose run --rm scraper-ui npx prisma migrate deploy
docker-compose run --rm scraper-ui npx prisma db seed
```

#### Step 2: Setup Dashboard Instances (Multiple Machines)
```bash
# On each dashboard machine
git clone <your-repo>
cd tiktok-scraper-ui

# Edit .env file to point to your database server
cp .env.example .env
# Set DATABASE_URL=postgresql://scraper_user:scraper_password@<DB_SERVER_IP>:5432/tiktok_scraper
# Set REDIS_URL=redis://<DB_SERVER_IP>:6379

# Start only the dashboard
docker-compose up -d scraper-ui
```

## 📋 Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- 4GB+ RAM recommended
- Network connectivity between machines

## 🔧 Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Database Configuration
DATABASE_URL="postgresql://scraper_user:scraper_password@localhost:5432/tiktok_scraper"

# Redis Configuration
REDIS_URL="redis://localhost:6379"

# Application Configuration
NODE_ENV="production"
NEXT_PUBLIC_API_URL="http://localhost:3000"
```

### Multi-Machine Configuration

For multi-machine setup, replace `localhost` with your database server IP:

```bash
DATABASE_URL="postgresql://scraper_user:scraper_password@192.168.1.100:5432/tiktok_scraper"
REDIS_URL="redis://192.168.1.100:6379"
```

## 🗄️ Database

The system uses PostgreSQL for persistent storage and Redis for real-time synchronization.

### Database Schema
- **queue_items**: Scraping queue management
- **workers**: Worker process tracking
- **scraping_results**: Completed scrape results
- **video_data**: Individual video metadata
- **system_stats**: System statistics

### Real-time Sync
Redis channels provide real-time updates across all dashboard instances:
- `queue:updates`: Queue changes
- `worker:updates`: Worker status changes
- `result:updates`: New results
- `stats:updates`: Statistics updates

## 🐳 Docker Services

### Core Services
- **postgres**: PostgreSQL database
- **redis**: Redis cache and pub/sub
- **scraper-ui**: Next.js dashboard application
- **nginx**: Load balancer (optional)

### Service Dependencies
```
scraper-ui depends on:
  ├── postgres (database)
  └── redis (cache/sync)

nginx depends on:
  ├── scraper-ui
  └── scraper-ui-2
```

## 📊 Monitoring

### Check Service Status
```bash
# View all running services
docker-compose ps

# View service logs
docker-compose logs -f scraper-ui
docker-compose logs -f postgres
docker-compose logs -f redis

# View real-time logs from all services
docker-compose logs -f
```

### Health Checks
All services include health checks:
- PostgreSQL: `pg_isready` check
- Redis: `redis-cli ping` check
- Application: HTTP health endpoint

### Database Management
```bash
# Access PostgreSQL directly
docker-compose exec postgres psql -U scraper_user -d tiktok_scraper

# Access Redis CLI
docker-compose exec redis redis-cli

# View database with Prisma Studio
docker-compose run --rm scraper-ui npx prisma studio
```

## 🔄 Data Synchronization

### How It Works
1. **Database Writes**: All data changes go to PostgreSQL
2. **Real-time Sync**: Redis pub/sub notifies all instances
3. **UI Updates**: Dashboard instances update in real-time
4. **Conflict Resolution**: Database handles concurrent access

### Sync Events
- Queue item added/updated/removed
- Worker status changes
- New scraping results
- Statistics updates

## 🚀 Deployment Strategies

### Single Machine (Development)
```bash
docker-compose up -d
```

### Multi-Machine (Production)
1. **Centralized Database**: One machine runs postgres + redis
2. **Distributed Dashboards**: Multiple machines run scraper-ui
3. **Load Balancing**: Optional nginx for load distribution

### Scaling Options
```bash
# Scale dashboard instances
docker-compose up -d --scale scraper-ui=3

# Add more worker processes per instance
# Edit docker-compose.yml to add scraper-ui-3, scraper-ui-4, etc.
```

## 🔧 Maintenance

### Backup Database
```bash
# Create backup
docker-compose exec postgres pg_dump -U scraper_user tiktok_scraper > backup.sql

# Restore backup
docker-compose exec -T postgres psql -U scraper_user -d tiktok_scraper < backup.sql
```

### Update Application
```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d
```

### Clean Up
```bash
# Stop all services
docker-compose down

# Remove all data (⚠️ DESTRUCTIVE)
docker-compose down -v

# Remove unused Docker resources
docker system prune
```

## 🐛 Troubleshooting

### Common Issues

**Database Connection Failed**
```bash
# Check if database is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres pg_isready -U scraper_user
```

**Redis Connection Failed**
```bash
# Check if Redis is running
docker-compose ps redis

# Test Redis
docker-compose exec redis redis-cli ping
```

**Dashboard Not Loading**
```bash
# Check application logs
docker-compose logs scraper-ui

# Restart application
docker-compose restart scraper-ui
```

### Performance Issues
- Monitor resource usage: `docker stats`
- Check database performance: Enable slow query logging
- Redis memory usage: `docker-compose exec redis redis-cli info memory`

### Network Issues
- Ensure ports 3000, 5432, 6379 are open
- Check firewall settings between machines
- Verify Docker network configuration

## 📈 Scaling Guide

### Horizontal Scaling
1. Add more dashboard instances
2. Use load balancer (nginx)
3. Scale worker processes independently

### Vertical Scaling
1. Increase container resources
2. Optimize database configuration
3. Add Redis memory

### Performance Optimization
- Use connection pooling
- Enable Redis persistence
- Optimize database queries
- Add database indexes

## 🔐 Security

### Production Security
- Change default passwords
- Use environment-specific secrets
- Enable SSL/TLS
- Restrict network access
- Regular security updates

### Network Security
```bash
# Restrict database access
# In docker-compose.yml, remove ports exposure for postgres/redis
# Use internal Docker networks only
```

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [Next.js Deployment](https://nextjs.org/docs/deployment) 