# TikTok Scraper - Hybrid Deployment Guide

This guide shows how to deploy the **frontend dashboard on Vercel** and **workers on individual computers** for a distributed scraping setup.

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌────────────────┐
│   Vercel App    │    │  Cloud Database  │    │  Cloud Redis   │
│   (Frontend)    │◄──►│   PostgreSQL     │◄──►│   (Real-time)  │
└─────────────────┘    └──────────────────┘    └────────────────┘
         ▲                        ▲                       ▲
         │                        │                       │
         ▼                        ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Workers (Distributed)                      │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Computer 1    │   Computer 2    │        Computer N           │
│   Worker-A      │   Worker-B      │       Worker-X              │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

## Prerequisites

### For Frontend (Vercel)
- Vercel account
- Cloud PostgreSQL database (Railway, Supabase, or PlanetScale)
- Cloud Redis instance (Upstash, Railway, or Redis Cloud)

### For Workers (Individual Computers)
- Node.js 16+
- Python 3.8+
- Git

## Part 1: Database Setup

### Option A: Railway (Recommended)
1. Go to [railway.app](https://railway.app) and create account
2. Create new project → Add PostgreSQL
3. Create new project → Add Redis
4. Copy connection strings from variables tab

### Option B: Supabase (PostgreSQL) + Upstash (Redis)
1. Go to [supabase.com](https://supabase.com) → New project
2. Get connection string from Settings → Database
3. Go to [upstash.com](https://upstash.com) → New Redis database
4. Copy Redis URL

### Option C: PlanetScale + Redis Cloud
1. Go to [planetscale.com](https://planetscale.com) → New database
2. Go to [redislabs.com](https://redislabs.com) → New database
3. Copy connection strings

## Part 2: Frontend Deployment on Vercel

### 1. Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# From the tiktok-music-trends folder
vercel

# Follow prompts to deploy
```

### 2. Set Environment Variables
In Vercel dashboard → Settings → Environment Variables:

```env
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require
REDIS_URL=redis://username:password@host:port
API_SECRET_KEY=your-secret-key-here
NODE_ENV=production
```

### 3. Deploy Database Schema
```bash
# Run this once to set up database tables
npx prisma migrate deploy
npx prisma generate
npx prisma db seed
```

### 4. Test Deployment
- Visit your Vercel URL
- Dashboard should load with 0 workers/queue items
- All pages should be accessible

## Part 3: Worker Deployment on Individual Computers

### Computer 1 Setup

1. **Download Worker Files**
```bash
# Option A: Clone the repo
git clone <your-repo-url>
cd tiktok-music-trends/worker

# Option B: Download just worker folder
# (Download worker/ folder from your repo)
```

2. **Install Dependencies**
```bash
# Run the installation script
./install.sh

# Or manually:
npm install
pip3 install -r requirements.txt
```

3. **Configure Environment**
```bash
# Edit .env file
nano .env
```

```env
# Worker Configuration
WORKER_NAME="Home-Computer-1"
WORKER_HOST="192.168.1.100"
MAX_CONCURRENT_TASKS="3"

# API Configuration (Your Vercel URL)
API_BASE_URL="https://your-app.vercel.app"
API_SECRET_KEY="your-secret-key-here"

# Redis Configuration
REDIS_URL="redis://username:password@host:port"
```

4. **Start Worker**
```bash
npm start
```

The worker will:
- Auto-register with your Vercel dashboard
- Start processing queue items
- Report status every 30 seconds

### Computer 2, 3, N... Setup

Repeat the same process on each computer:
1. Use unique `WORKER_NAME` for each computer
2. Use unique `WORKER_HOST` (IP or hostname)
3. Same `API_BASE_URL` and credentials
4. Each worker will appear in your dashboard

## Part 4: Usage

### Adding URLs to Queue
1. Open your Vercel dashboard in browser
2. Go to Queue page
3. Add TikTok URLs
4. Workers will automatically start processing

### Managing Workers
1. View all workers in Workers page
2. Start/pause/stop workers remotely
3. Monitor progress in real-time
4. Workers sync across all browsers

### Viewing Results
1. Results page shows all scraped data
2. Search and filter capabilities
3. Export to CSV
4. Real-time updates as workers complete tasks

## Part 5: Advanced Configuration

### Auto-Start Workers (Linux/Mac)

Create systemd service:
```bash
# Create service file
sudo nano /etc/systemd/system/tiktok-worker.service
```

```ini
[Unit]
Description=TikTok Scraper Worker
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/worker
ExecStart=/usr/bin/node worker.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl enable tiktok-worker
sudo systemctl start tiktok-worker
```

### Auto-Start Workers (Windows)

Use PM2:
```bash
# Install PM2
npm install -g pm2

# Start worker with PM2
pm2 start worker.js --name tiktok-worker

# Save PM2 config
pm2 save
pm2 startup
```

### Scaling Workers

Add more workers by:
1. **Same Computer**: Run multiple worker instances with different names
2. **More Computers**: Install worker on additional machines
3. **Cloud Workers**: Deploy workers on cloud VMs (AWS, GCP, etc.)

### Monitoring

**Worker Logs**:
```bash
# View real-time logs
tail -f worker.log

# With PM2
pm2 logs tiktok-worker
```

**Dashboard Monitoring**:
- Workers page shows all active workers
- Real-time status updates
- Task completion metrics
- Error tracking

## Part 6: Troubleshooting

### Common Issues

**Worker Not Connecting**:
```bash
# Check connectivity
curl https://your-app.vercel.app/api/stats

# Check Redis connection
redis-cli -u $REDIS_URL ping
```

**Database Connection Issues**:
```bash
# Test database connection
npx prisma db pull
```

**Python Dependencies**:
```bash
# Update pip and install dependencies
pip3 install --upgrade pip
pip3 install -r requirements.txt
```

### Performance Tuning

**For High Volume**:
- Increase `MAX_CONCURRENT_TASKS` per worker
- Deploy more workers
- Use faster cloud database
- Optimize Redis memory settings

**For Reliability**:
- Use Redis persistence
- Set up database backups
- Monitor worker health
- Implement error notifications

## Part 7: Security

### API Security
- Use strong `API_SECRET_KEY`
- Rotate keys regularly
- Restrict database access
- Use SSL/TLS connections

### Network Security
- Use VPN for workers if needed
- Firewall worker machines
- Monitor unusual activity
- Secure Redis instance

## Support

If you encounter issues:
1. Check worker logs
2. Verify environment variables
3. Test database/Redis connectivity
4. Check Vercel function logs
5. Monitor dashboard for errors

The system is designed to be fault-tolerant - workers can be restarted, and the dashboard will continue working even if some workers are offline. 