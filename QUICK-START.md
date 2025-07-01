# 🚀 Quick Start Guide - Worker System

## Prerequisites Fixed ✅

1. **✅ Redis**: Installed and running
2. **✅ API Routes**: PUT handler added to queue API
3. **✅ Python Dependencies**: Auto-installation configured
4. **✅ Worker Removal**: Graceful shutdown implemented

## Start the System

### 1. Start the Dashboard
```bash
cd tiktok-music-trends
npm run dev
```
Dashboard will be available at: http://localhost:3000

### 2. Start a Worker
```bash
cd tiktok-music-trends/worker
./run-worker.sh
```

This script will:
- ✅ Set correct environment variables (API_BASE_URL=http://localhost:3000)
- ✅ Install Node.js dependencies if needed
- ✅ Create Python virtual environment
- ✅ Install all Python dependencies (including webdriver-manager)
- ✅ Test dependencies are working
- ✅ Start the worker process

### 3. Test the System

1. **Add a TikTok URL** in the dashboard at http://localhost:3000/queue
2. **Monitor Workers** at http://localhost:3000/workers
3. **View Results** at http://localhost:3000/results
4. **Test Removal** by clicking "Remove" on any worker

## Expected Behavior

### ✅ Successful Worker Startup:
```
🚀 Starting TikTok Worker...
Configuration:
  API_BASE_URL: http://localhost:3000
  WORKER_NAME: Worker-hostname-12345
  REDIS_HOST: localhost

🧪 Testing Python dependencies...
  ✅ requests
  ✅ selenium
  ✅ webdriver_manager
  ✅ beautifulsoup4
  ✅ python-dotenv

🎉 All dependencies are installed correctly!
✅ Starting worker process...
Worker initializing with API: http://localhost:3000
Subscribed to worker control channel
Subscribed to worker updates channel
Worker registered successfully
```

### ✅ Worker Processing:
- Worker appears in dashboard
- Tasks are picked up from queue
- Results are saved and viewable
- Real-time updates work across all instances

### ✅ Worker Removal:
- Click "Remove" in dashboard
- Worker receives shutdown signal
- Worker stops gracefully
- Process exits automatically

## Troubleshooting

### If Redis isn't running:
```bash
brew services start redis
```

### If Python dependencies fail:
```bash
cd worker
rm -rf venv
./run-worker.sh
```

### If API connection fails:
Check that dashboard is running on http://localhost:3000

## Multi-Computer Setup

To run workers on different computers:

1. **Central computer**: Run dashboard + database
2. **Worker computers**: 
   ```bash
   export API_BASE_URL="http://central-computer-ip:3000"
   export REDIS_HOST="central-computer-ip"
   ./run-worker.sh
   ```

The worker removal functionality works across all computers - removing a worker from any dashboard will shut down the script on its physical computer! 🎉 