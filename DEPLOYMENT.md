# 🌐 Vercel Frontend + Distributed Workers Deployment Guide

This guide walks you through deploying the TikTok Scraper with:
- ✅ **Frontend**: Hosted on Vercel (free tier)
- ✅ **Backend Coordinator**: Hosted on Railway/Render (free tier)
- ✅ **Workers**: Running on multiple laptops
- ✅ **Database**: Redis Cloud (free tier)

---

## 📋 Prerequisites

- **Git account** (GitHub, GitLab, etc.)
- **Vercel account** (free)
- **Railway or Render account** (free)
- **Multiple laptops** for workers
- **Basic terminal knowledge**

---

## 🚀 Step 1: Deploy Backend Coordinator

### Option A: Railway (Recommended)

1. **Create Railway Account**: Visit [railway.app](https://railway.app) and sign up

2. **Deploy from GitHub**:
   ```bash
   # Push your code to GitHub first
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

3. **Connect to Railway**:
   - Go to Railway dashboard
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Select "Deploy Now"

4. **Add Redis Service**:
   - In your Railway project, click "Add Service"
   - Select "Database" → "Redis"
   - Railway will automatically create a Redis instance

5. **Configure Environment Variables**:
   - Go to your service settings
   - Add these environment variables:
   ```
   PORT=8000
   REDIS_URL=${{Redis.REDIS_URL}}
   DATABASE_URL=sqlite:///./scraper.db
   CORS_ORIGINS=*
   DEBUG=False
   ```

6. **Get Your Backend URL**:
   - Copy the generated Railway URL (e.g., `https://your-app.railway.app`)

### Option B: Render

1. **Create Render Account**: Visit [render.com](https://render.com) and sign up

2. **Deploy Backend**:
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Use these settings:
     - **Environment**: Docker
     - **Dockerfile Path**: `./backend/Dockerfile`
     - **Start Command**: (leave empty)

3. **Add Redis**:
   - Click "New +" → "Redis"
   - Choose free tier
   - Copy the Redis URL

4. **Configure Environment Variables**:
   ```
   PORT=8000
   REDIS_URL=<your-redis-url>
   DATABASE_URL=sqlite:///./scraper.db
   CORS_ORIGINS=*
   DEBUG=False
   ```

---

## 🌐 Step 2: Deploy Frontend to Vercel

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel@latest
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy Frontend** (use our automated script):
   ```bash
   # Replace with your backend URL from Step 1
   ./deploy-vercel.sh https://your-app.railway.app
   ```

4. **Alternative Manual Deployment**:
   ```bash
   cd frontend
   
   # Set environment variables
   vercel env add REACT_APP_API_URL production
   # Enter: https://your-app.railway.app
   
   vercel env add REACT_APP_WS_URL production  
   # Enter: wss://your-app.railway.app
   
   # Deploy
   vercel --prod
   ```

5. **Get Your Frontend URL**:
   - Vercel will provide a URL (e.g., `https://your-app.vercel.app`)

---

## 🔧 Step 3: Update Backend CORS

Update your backend to allow your Vercel domain:

1. **Go to Railway/Render Dashboard**
2. **Update Environment Variables**:
   ```
   CORS_ORIGINS=https://your-app.vercel.app,*
   ```
3. **Redeploy** the backend service

---

## 💻 Step 4: Setup Workers on Laptops

### Laptop 1, 2, 3... (All Worker Laptops)

1. **Clone Repository**:
   ```bash
   git clone <your-repo-url>
   cd tiktok-music-trends
   ```

2. **Start Worker** (using our script):
   ```bash
   # Option 1: Docker mode (recommended)
   ./start-worker.sh https://your-app.railway.app --docker --headless
   
   # Option 2: Local Python mode
   ./start-worker.sh https://your-app.railway.app --local --headless
   ```

3. **Manual Worker Setup** (if script doesn't work):
   ```bash
   # Docker mode
   docker build -t tiktok-worker -f backend/Dockerfile.worker backend/
   docker run --rm -it \
     -e COORDINATOR_HOST=your-app.railway.app \
     -e REDIS_HOST=your-app.railway.app \
     -e HEADLESS=true \
     -v $(pwd)/data:/app/data \
     tiktok-worker
   
   # OR Local Python mode
   pip install -r backend/requirements.txt
   cd backend
   python worker.py \
     --coordinator-host your-app.railway.app \
     --redis-host your-app.railway.app \
     --headless
   ```

---

## ✅ Step 5: Verification

1. **Open Your Dashboard**:
   - Visit your Vercel URL: `https://your-app.vercel.app`

2. **Check Worker Connections**:
   - You should see connected workers in the dashboard
   - Each laptop should show as a separate worker

3. **Test Scraping**:
   - Click "New Job"
   - Enter a TikTok profile URL
   - Watch the job get distributed to workers

---

## 🎯 Quick Setup Commands

Here's the complete setup in just a few commands:

```bash
# 1. Deploy backend to Railway (manual via web interface)

# 2. Deploy frontend to Vercel
./deploy-vercel.sh https://your-app.railway.app

# 3. Start workers on each laptop
./start-worker.sh https://your-app.railway.app --docker --headless
```

---

## 🔍 Troubleshooting

### Frontend Not Loading
```bash
# Check if backend is accessible
curl https://your-app.railway.app/health

# Redeploy frontend with correct URLs
./deploy-vercel.sh https://your-app.railway.app
```

### Workers Not Connecting
```bash
# Check backend logs in Railway/Render dashboard
# Verify Redis is running
# Ensure CORS allows your worker connections
```

### CORS Errors
```bash
# Update backend CORS_ORIGINS to include:
# - Your Vercel URL
# - * (for workers)
CORS_ORIGINS=https://your-app.vercel.app,*
```

---

## 💰 Pricing

All services used have generous free tiers:

- **Vercel**: Free (hobby plan)
- **Railway**: $5/month after 512 hours (free tier)
- **Render**: Free tier available
- **Redis Cloud**: Free up to 30MB

---

## 🔧 Advanced Configuration

### Custom Domain
1. **Add Domain to Vercel**:
   - Go to Vercel dashboard → Settings → Domains
   - Add your custom domain

2. **Update Backend CORS**:
   ```
   CORS_ORIGINS=https://yourdomain.com,*
   ```

### Scaling Workers
```bash
# Start multiple workers on same laptop
for i in {1..3}; do
  ./start-worker.sh https://your-app.railway.app --docker --headless &
done
```

### Environment-Specific Configs
```bash
# Production
CORS_ORIGINS=https://yourdomain.com
DEBUG=False

# Development  
CORS_ORIGINS=*
DEBUG=True
```

---

## 📱 Mobile Access

Your Vercel-hosted dashboard is fully responsive and works great on mobile devices. Share the URL with team members for remote monitoring!

---

## 🚀 Production Tips

1. **Use HTTPS**: Both Railway and Vercel provide HTTPS by default
2. **Monitor Usage**: Keep an eye on Railway/Render usage to avoid hitting limits
3. **Scale Workers**: Add more laptops as needed for higher throughput
4. **Backup Data**: Download CSV files regularly
5. **Update Regularly**: Keep workers updated with latest code

---

That's it! You now have a fully distributed TikTok scraper with cloud-hosted frontend and locally-running workers. 🎉 