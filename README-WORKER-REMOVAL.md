# Worker Removal Functionality

This document explains how the worker removal functionality works and how to use it.

## Overview

The TikTok scraper system now supports safely removing workers from the frontend, which will cause the actual worker scripts running on computers to shut down gracefully.

## How It Works

### 1. Frontend Removal
- Navigate to the **Workers** page in the dashboard
- Click the **"Remove"** button on any worker card
- Confirm the removal in the popup dialog

### 2. Backend Process
When a worker is removed from the frontend:

1. **Shutdown Signal**: A shutdown command is sent to the worker via Redis pub/sub
2. **Database Cleanup**: The worker is removed from the PostgreSQL database
3. **Real-time Updates**: All connected dashboards are notified of the removal
4. **Script Termination**: The worker script receives the signal and exits gracefully

### 3. Worker Script Behavior
The worker script (`worker/worker.js`) handles removal in two ways:

- **Direct Command**: Listens for `shutdown` commands on `worker:{name}:control` channel
- **Deletion Event**: Monitors `worker:updates` channel for deletion events

When either signal is received, the worker:
1. Stops processing new tasks
2. Finishes current tasks (if any)
3. Updates its status in the database
4. Disconnects from Redis
5. Exits the process gracefully

## Usage Instructions

### Starting a Worker

**Option 1: Using the start script (recommended)**
```bash
cd worker
./run-worker.sh
```

**Option 2: Manual start**
```bash
cd worker
export API_BASE_URL="http://localhost:3000"
export API_SECRET_KEY="supersecretkey123"
node worker.js
```

### Removing a Worker
1. Open the dashboard at `http://localhost:3000/workers`
2. Find the worker you want to remove
3. Click the **"Remove"** button
4. Confirm the removal
5. The worker script will automatically shut down

### Testing the Functionality
Run the test script to verify everything works:

```bash
cd tiktok-music-trends
node test-worker-removal.js
```

## Architecture

```
Frontend (Remove Button) 
    ↓
API Endpoint (/api/workers DELETE)
    ↓
Database Storage (removeWorker)
    ↓
Redis Pub/Sub (shutdown signal)
    ↓
Worker Script (graceful shutdown)
```

## Redis Channels

The system uses these Redis channels for worker communication:

- **`worker:{name}:control`**: Direct commands (start, stop, pause, shutdown)
- **`worker:updates`**: Real-time worker state changes (create, update, delete)

## Environment Variables

For worker scripts:

```bash
WORKER_NAME=MyWorker-1          # Unique worker identifier
WORKER_HOST=computer-1          # Host computer name
API_BASE_URL=http://localhost:3000  # Dashboard API URL
REDIS_URL=redis://localhost:6379    # Redis connection string
API_SECRET_KEY=your-secret-key      # Optional API authentication
```

## Troubleshooting

### "405 Method Not Allowed" Errors
If you see HTTP 405 errors when running workers:
1. **Wrong API URL**: Worker is connecting to Vercel instead of local server
   - Solution: Use `./run-worker.sh` script or set `API_BASE_URL=http://localhost:3000`
2. **Missing PUT handler**: Queue API was missing PUT method support
   - Solution: This has been fixed in the latest version

### "ECONNREFUSED" Redis Errors
If you see Redis connection errors:
1. **Redis not installed**: `brew install redis`
2. **Redis not running**: `brew services start redis`
3. **Wrong Redis URL**: Check `REDIS_HOST` and `REDIS_PORT` environment variables

### Python Module Errors
If you see "ModuleNotFoundError: No module named 'webdriver_manager'":
1. **Missing dependencies**: The start script now installs all required Python packages
2. **Wrong Python environment**: Worker now uses virtual environment by default
3. **Test dependencies**: Run `python test-python-deps.py` in worker folder to verify

### Worker Doesn't Shut Down
1. Check Redis connection in worker logs
2. Verify worker name matches between script and database
3. Ensure Redis is running and accessible

### Database Errors
1. Check PostgreSQL connection
2. Verify worker exists in database before removal
3. Check API authentication if using secret key

### Connection Issues
1. **Wrong API URL**: Check `API_BASE_URL` environment variable
2. **Redis Connection**: Ensure Redis is running on localhost:6379
3. **Database Connection**: Verify PostgreSQL is running and accessible
4. **Authentication**: Check `API_SECRET_KEY` matches between worker and dashboard

## Security Notes

- Workers authenticate using the `API_SECRET_KEY` if configured
- Only authenticated requests can remove workers
- Worker scripts validate shutdown signals before terminating

## Monitoring

Watch the logs to see removal in action:

**Dashboard logs:**
```
Shutdown signal sent to worker: Worker-123
Worker removal successful
```

**Worker logs:**
```
Received control message: { action: 'shutdown', timestamp: 1234567890 }
Worker Worker-123 (ID: abc123) was removed from the system. Shutting down...
Shutting down worker...
Worker shutdown complete
``` 