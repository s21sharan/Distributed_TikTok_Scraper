# TikTok Scraper Dashboard - Docker Deployment

This guide explains how to deploy the TikTok Scraper Dashboard using Docker with Railway Database and Redis.

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
                    │     Railway Services      │
                    │  PostgreSQL + Redis Cloud │
                    │     (Fully Managed)       │
                    └───────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Railway Database and Redis URLs
- Docker 20.10+
- Docker Compose 2.0+
- 4GB+ RAM recommended

### Single Machine Setup
```bash
# Clone the repository
git clone <your-repo>
cd tiktok-scraper-ui

# Create .env file with Railway credentials
cp .env.example .env
# Edit .env with your Railway DATABASE_URL and REDIS_URL

# Run the deployment script
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

### Multi-Machine Setup
```bash
# On each machine
git clone <your-repo>
cd tiktok-scraper-ui

# Create .env file with Railway credentials
cp .env.example .env
# Add your Railway DATABASE_URL and REDIS_URL

# Start the dashboard
docker-compose up -d
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file with your Railway credentials:

```bash
# Railway Database Configuration
DATABASE_URL="postgresql://postgres:your_password@your_host.railway.app:port/railway"

# Railway Redis Configuration
REDIS_URL="redis://default:your_password@your_host.railway.app:port"

# Application Configuration
NODE_ENV="production"
NEXT_PUBLIC_API_URL="http://localhost:3000"
```

**⚠️ Important**: Replace the URLs above with your actual Railway database and Redis connection strings.

## 🗄️ Database

The system uses Railway's managed PostgreSQL and Redis services.

### Database Schema
- **queue_items**: Scraping queue management
- **workers**: Worker process tracking
- **scraping_results**: Completed scrape results
- **video_data**: Individual video metadata
- **system_stats**: System statistics

### Real-time Sync
Railway Redis provides real-time updates across all dashboard instances:
- `queue:updates`: Queue changes
- `worker:updates`: Worker status changes
- `result:updates`: New results
- `stats:updates`: Statistics updates

## 🐳 Docker Services

### Application Services
- **scraper-ui**: Next.js dashboard application
- **scraper-ui-2**: Second instance for load balancing (optional)
- **nginx**: Load balancer (optional)

**Note**: Database and Redis are hosted on Railway, not in Docker containers.

## 📊 Monitoring

### Check Service Status
```bash
# View running services
docker-compose ps

# View application logs
docker-compose logs -f scraper-ui

# View real-time logs from all services
docker-compose logs -f
```

### Database Management
```bash
# Connect to Railway database directly (using Railway credentials)
psql $DATABASE_URL

# Connect to Railway Redis
redis-cli -u $REDIS_URL

# View database with Prisma Studio
docker-compose run --rm scraper-ui npx prisma studio
```

## 🔄 Data Synchronization

### How It Works
1. **Database Writes**: All data changes go to Railway PostgreSQL
2. **Real-time Sync**: Railway Redis pub/sub notifies all instances
3. **UI Updates**: Dashboard instances update in real-time
4. **Conflict Resolution**: Database handles concurrent access

### Sync Events
- Queue item added/updated/removed
- Worker status changes
- New scraping results
- Statistics updates

## 🚀 Deployment Strategies

### Single Machine
```bash
docker-compose up -d scraper-ui
```

### Multi-Machine
```bash
# On each machine
docker-compose up -d scraper-ui
```

### Load Balanced
```bash
# Start multiple instances with nginx load balancer
docker-compose up -d
```

## 🔐 Security

### Railway Connection Security
- All connections to Railway use SSL/TLS encryption
- Database credentials are managed through environment variables
- Redis authentication is handled via connection URL

### Network Security
```bash
# Restrict access to dashboard port
iptables -A INPUT -p tcp --dport 3000 -s YOUR_IP -j ACCEPT
iptables -A INPUT -p tcp --dport 3000 -j DROP
```

## 🛠️ Troubleshooting

### Common Issues

#### Connection Issues
```bash
# Test Railway database connection
docker-compose run --rm scraper-ui npx prisma db push

# Test Railway Redis connection
docker-compose run --rm scraper-ui node -e "
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);
redis.ping().then(result => {
  console.log('Redis ping:', result);
  process.exit(0);
}).catch(err => {
  console.error('Redis error:', err);
  process.exit(1);
});
"
```

#### Service Restart
```bash
# Restart specific service
docker-compose restart scraper-ui

# Restart all services
docker-compose restart

# Force recreate services
docker-compose up -d --force-recreate
```

#### Database Migration Issues
```bash
# Reset and apply migrations
docker-compose run --rm scraper-ui npx prisma migrate reset --force
docker-compose run --rm scraper-ui npx prisma migrate deploy
```

### Performance Optimization

#### Docker Resource Limits
```yaml
# In docker-compose.yml
services:
  scraper-ui:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
```

#### Application Performance
```bash
# Enable Next.js production optimizations
NODE_ENV=production docker-compose up -d
```

## 📈 Scaling

### Horizontal Scaling
```bash
# Scale to multiple instances
docker-compose up -d --scale scraper-ui=3

# Use nginx for load balancing
docker-compose up -d nginx
```

### Resource Monitoring
```bash
# Monitor container resource usage
docker stats

# Monitor container logs
docker-compose logs -f --tail=100
```

## 🔄 Updates and Maintenance

### Application Updates
```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose build --no-cache
docker-compose up -d
```

### Database Migrations
```bash
# Apply new migrations
docker-compose run --rm scraper-ui npx prisma migrate deploy
```

## 📞 Support

If you encounter issues:
1. Check the logs: `docker-compose logs -f`
2. Verify Railway credentials in `.env`
3. Test database connectivity
4. Check Docker system resources

For Railway-specific issues, refer to [Railway Documentation](https://docs.railway.app/). 