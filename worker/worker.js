const axios = require('axios');
const Redis = require('ioredis');
const cron = require('node-cron');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

require('dotenv').config();

class TikTokWorker {
  constructor() {
    this.workerId = process.env.WORKER_NAME || `Worker-${Date.now()}`;
    this.hostname = process.env.WORKER_HOST || os.hostname();
    this.apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    this.apiKey = process.env.API_SECRET_KEY;
    this.maxConcurrentTasks = parseInt(process.env.MAX_CONCURRENT_TASKS) || 3;
    
    this.isRunning = false;
    this.currentTasks = new Set();
    this.tasksCompleted = 0;
    this.status = 'stopped';
    
    this.redis = new Redis(process.env.REDIS_URL || {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD
    });

    this.setupRedisListeners();
    this.registerWorker();
  }

  async setupRedisListeners() {
    // Listen for worker control commands
    this.redis.subscribe(`worker:${this.workerId}:control`, (err, count) => {
      if (err) {
        console.error('Failed to subscribe to worker control channel:', err);
      } else {
        console.log(`Subscribed to worker control channel`);
      }
    });

    this.redis.on('message', (channel, message) => {
      if (channel === `worker:${this.workerId}:control`) {
        this.handleControlMessage(JSON.parse(message));
      }
    });
  }

  async handleControlMessage(message) {
    console.log(`Received control message:`, message);
    
    switch (message.action) {
      case 'start':
        await this.start();
        break;
      case 'pause':
        await this.pause();
        break;
      case 'stop':
        await this.stop();
        break;
      case 'status':
        await this.reportStatus();
        break;
    }
  }

  async registerWorker() {
    try {
      const response = await axios.post(`${this.apiBaseUrl}/api/workers`, {
        name: this.workerId,
        host: this.hostname,
        status: this.status
      }, {
        headers: this.getAuthHeaders()
      });
      
      console.log(`Worker registered successfully:`, response.data);
    } catch (error) {
      console.error('Failed to register worker:', error.message);
    }
  }

  async start() {
    if (this.isRunning) {
      console.log('Worker is already running');
      return;
    }

    this.isRunning = true;
    this.status = 'running';
    console.log(`Worker ${this.workerId} started`);
    
    await this.updateWorkerStatus();
    this.processQueue();
  }

  async pause() {
    this.isRunning = false;
    this.status = 'paused';
    console.log(`Worker ${this.workerId} paused`);
    await this.updateWorkerStatus();
  }

  async stop() {
    this.isRunning = false;
    this.status = 'stopped';
    console.log(`Worker ${this.workerId} stopped`);
    await this.updateWorkerStatus();
  }

  async updateWorkerStatus() {
    try {
      await axios.put(`${this.apiBaseUrl}/api/workers`, {
        workerId: this.workerId,
        status: this.status,
        tasksCompleted: this.tasksCompleted,
        currentTasks: Array.from(this.currentTasks),
        lastActivity: new Date().toISOString()
      }, {
        headers: this.getAuthHeaders()
      });
    } catch (error) {
      console.error('Failed to update worker status:', error.message);
    }
  }

  async processQueue() {
    if (!this.isRunning) return;

    try {
      // Check if we can take more tasks
      if (this.currentTasks.size >= this.maxConcurrentTasks) {
        setTimeout(() => this.processQueue(), 5000);
        return;
      }

      // Get next task from queue
      const response = await axios.get(`${this.apiBaseUrl}/api/queue?status=pending&limit=1`, {
        headers: this.getAuthHeaders()
      });

      if (response.data && response.data.length > 0) {
        const task = response.data[0];
        await this.processTask(task);
      }
    } catch (error) {
      console.error('Error processing queue:', error.message);
    }

    // Continue processing
    setTimeout(() => this.processQueue(), 2000);
  }

  async processTask(task) {
    if (!this.isRunning) return;

    const taskId = task.id;
    this.currentTasks.add(taskId);
    
    console.log(`Processing task: ${task.url}`);

    try {
      // Mark task as processing
      await axios.put(`${this.apiBaseUrl}/api/queue`, {
        id: taskId,
        action: 'start',
        workerId: this.workerId
      }, {
        headers: this.getAuthHeaders()
      });

      // Run the TikTok scraper
      const result = await this.runScraper(task.url);
      
      if (result.success) {
        // Save results
        await axios.post(`${this.apiBaseUrl}/api/results`, {
          queueItemId: taskId,
          ...result.data
        }, {
          headers: this.getAuthHeaders()
        });

        // Mark task as completed
        await axios.put(`${this.apiBaseUrl}/api/queue`, {
          id: taskId,
          action: 'complete'
        }, {
          headers: this.getAuthHeaders()
        });

        this.tasksCompleted++;
        console.log(`Task completed successfully: ${task.url}`);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error(`Task failed: ${task.url}`, error.message);
      
      // Mark task as failed
      await axios.put(`${this.apiBaseUrl}/api/queue`, {
        id: taskId,
        action: 'fail',
        error: error.message
      }, {
        headers: this.getAuthHeaders()
      }).catch(console.error);
    } finally {
      this.currentTasks.delete(taskId);
      await this.updateWorkerStatus();
    }
  }

  async runScraper(url) {
    return new Promise((resolve) => {
      const scriptPath = path.join(__dirname, '..', 'tiktok_scraper.py');
      const command = `python3 "${scriptPath}" "${url}"`;
      
      exec(command, { timeout: 60000 }, (error, stdout, stderr) => {
        if (error) {
          resolve({
            success: false,
            error: error.message
          });
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve({
            success: true,
            data: result
          });
        } catch (parseError) {
          resolve({
            success: false,
            error: 'Failed to parse scraper output'
          });
        }
      });
    });
  }

  async reportStatus() {
    const status = {
      workerId: this.workerId,
      hostname: this.hostname,
      status: this.status,
      isRunning: this.isRunning,
      currentTasks: Array.from(this.currentTasks),
      tasksCompleted: this.tasksCompleted,
      maxConcurrentTasks: this.maxConcurrentTasks,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };

    console.log('Worker Status:', status);
    
    // Publish status to Redis
    await this.redis.publish('worker:status', JSON.stringify(status));
    
    return status;
  }

  getAuthHeaders() {
    return this.apiKey ? {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    } : {
      'Content-Type': 'application/json'
    };
  }

  async shutdown() {
    console.log('Shutting down worker...');
    this.isRunning = false;
    this.status = 'stopped';
    
    await this.updateWorkerStatus();
    await this.redis.disconnect();
    
    console.log('Worker shutdown complete');
    process.exit(0);
  }
}

// Initialize worker
const worker = new TikTokWorker();

// Handle graceful shutdown
process.on('SIGINT', () => worker.shutdown());
process.on('SIGTERM', () => worker.shutdown());

// Auto-start worker
worker.start().catch(console.error);

// Status reporting every 30 seconds
cron.schedule('*/30 * * * * *', () => {
  worker.reportStatus().catch(console.error);
});

console.log(`TikTok Worker ${worker.workerId} initialized and ready`); 