# Quick Start Guide - TikTok Scraper

Get your distributed TikTok scraper running in 15 minutes!

## 🚀 Step 1: Set Up Cloud Database (5 minutes)

### Railway (Easiest)
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. New Project → Add PostgreSQL
4. New Project → Add Redis
5. Copy connection strings from Variables tab

### Your connection strings will look like:
```
PostgreSQL: postgresql://username:password@host:port/database

postgresql://postgres:wBAgCMbQKWWxHSSngriNwErlhoMxMesU@shinkansen.proxy.rlwy.net:14134/railway

Redis: redis://username:password@host:port
redis://default:omMwvgbIPfLKXHzzrHiegbJDrXigwtRF@trolley.proxy.rlwy.net:25520

```

## 🌐 Step 2: Deploy Frontend to Vercel (5 minutes)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from tiktok-music-trends folder
cd tiktok-music-trends
vercel
```

**Follow prompts:**
- Link to Git? → Yes
- Override settings? → No
- Deploy? → Yes

**Set Environment Variables** in Vercel dashboard:
```env
DATABASE_URL=postgresql://postgres:wBAgCMbQKWWxHSSngriNwErlhoMxMesU@shinkansen.proxy.rlwy.net:14134/railway
REDIS_URL=redis://default:omMwvgbIPfLKXHzzrHiegbJDrXigwtRF@trolley.proxy.rlwy.net:25520
API_SECRET_KEY=supersecretkey123
```

**Initialize Database:**
```bash
npx prisma migrate deploy
npx prisma db seed
```

## 💻 Step 3: Start First Worker (5 minutes)

**On any computer with Node.js and Python:**

```bash
# Download worker files
cd worker/
npm install
pip3 install -r requirements.txt

# Configure worker
cp .env.example .env
nano .env
```

**Edit .env:**
```env
WORKER_NAME="MyComputer-Worker"
API_BASE_URL="https://your-app.vercel.app"
API_SECRET_KEY="supersecretkey123"
REDIS_URL="your_redis_url_here"
```

**Start worker:**
```bash
npm start
```

## ✅ Step 4: Test Everything

1. **Open your Vercel dashboard** → Should show 1 worker online
2. **Add a TikTok URL** in Queue page
3. **Watch it process** in real-time
4. **Check results** in Results page

## 🔥 That's it! Your scraper is running!

### What you now have:
- ✅ Web dashboard accessible from anywhere
- ✅ Distributed workers on your computers
- ✅ Real-time synchronization
- ✅ Scalable to unlimited workers
- ✅ Queue management
- ✅ Results analysis and export

### Next steps:
- Add more workers on other computers
- Set up auto-start for workers
- Scale up for production use

### Add more workers:
Just repeat Step 3 on any computer with unique `WORKER_NAME`

---

## 🆘 Troubleshooting

**Worker not connecting?**
```bash
curl https://your-app.vercel.app/api/stats
```

**Database issues?**
```bash
npx prisma db pull
```

**Need help?** Check the full deployment guide in `README-DEPLOYMENT.md`

---

## 🏃‍♂️ Production Ready Commands

**Auto-start worker (Linux/Mac):**
```bash
npm install -g pm2
pm2 start worker.js --name tiktok-worker
pm2 save && pm2 startup
```

**Monitor worker:**
```bash
pm2 logs tiktok-worker
```

**Scale up:**
- Add `MAX_CONCURRENT_TASKS=5` to .env
- Run multiple workers per computer
- Deploy on cloud VMs 