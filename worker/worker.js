const axios = require('axios');
const Redis = require('ioredis');
const cron = require('node-cron');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const config = require('./worker-config');

require('dotenv').config();

class TikTokWorker {
  constructor() {
    this.workerId = config.WORKER_NAME;
    this.databaseId = null; // Will be set after registration
    this.hostname = config.WORKER_HOST;
    this.apiBaseUrl = config.API_BASE_URL;
    this.apiKey = config.API_SECRET_KEY;
    this.maxConcurrentTasks = config.MAX_CONCURRENT_TASKS;
    
    this.isRunning = false;
    this.currentTasks = new Set();
    this.tasksCompleted = 0;
    this.status = 'idle';
    
    this.redis = new Redis(config.getRedisConfig());
    this.redisPublisher = new Redis(config.getRedisConfig()); // Separate connection for publishing

    console.log(`Worker initializing with API: ${this.apiBaseUrl}`);
    
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

    // Listen for worker deletion events
    this.redis.subscribe('worker:updates', (err, count) => {
      if (err) {
        console.error('Failed to subscribe to worker updates channel:', err);
      } else {
        console.log(`Subscribed to worker updates channel`);
      }
    });

    this.redis.on('message', (channel, message) => {
      if (channel === `worker:${this.workerId}:control`) {
        this.handleControlMessage(JSON.parse(message));
      } else if (channel === 'worker:updates') {
        this.handleWorkerUpdate(JSON.parse(message));
      }
    });
  }

  async handleWorkerUpdate(update) {
    // Check if this worker was deleted using the database ID
    if (update.action === 'delete' && this.databaseId && update.data.id === this.databaseId) {
      console.log(`Worker ${this.workerId} (ID: ${this.databaseId}) was removed from the system. Shutting down...`);
      await this.shutdown();
    }
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
      case 'shutdown':
        await this.shutdown();
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
      
      // Update our workerId to match the database ID
      if (response.data && response.data.id) {
        this.databaseId = response.data.id;
        console.log(`Worker registered successfully with database ID: ${this.databaseId}`);
      }
      
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
    // Don't try to update status if we haven't registered yet
    if (!this.databaseId) {
      console.log('Skipping status update - worker not registered yet');
      return;
    }

    try {
      await axios.patch(`${this.apiBaseUrl}/api/workers`, {
        id: this.databaseId,
        status: this.status,
        processedCount: this.tasksCompleted,
        lastActivity: new Date().toISOString()
      }, {
        headers: this.getAuthHeaders()
      });
      console.log('Worker status updated successfully');
    } catch (error) {
      console.error('Failed to update worker status:', error.response?.status, error.response?.data || error.message);
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
      const response = await axios.get(`${this.apiBaseUrl}/api/queue/next`, {
        headers: this.getAuthHeaders()
      });

      if (response.data && !response.data.error) {
        const task = response.data;
        if (task) {
          await this.processTask(task);
        }
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
      try {
        await axios.put(`${this.apiBaseUrl}/api/queue`, {
          id: taskId,
          action: 'start',
          workerId: this.databaseId
        }, {
          headers: this.getAuthHeaders()
        });
        console.log(`Successfully marked task ${taskId} as processing`);
      } catch (apiError) {
        console.error(`Failed to mark task ${taskId} as processing:`, apiError.response?.status, apiError.response?.data);
        // Continue anyway - the task might already be marked as processing
      }

      // Run the TikTok scraper
      const result = await this.runScraper(task.url);
      
      if (result.success) {
        // Save results
        console.log(`💾 Sending ${result.data?.length || 0} video results to database`);
        try {
          await axios.post(`${this.apiBaseUrl}/api/results`, {
            queueItemId: taskId,
            videoData: result.data
          }, {
            headers: this.getAuthHeaders()
          });
          console.log('✅ Results saved to database successfully');

          // Only mark as completed if saving results was successful
          try {
            await axios.put(`${this.apiBaseUrl}/api/queue`, {
              id: taskId,
              action: 'complete'
            }, {
              headers: this.getAuthHeaders()
            });
            console.log(`Successfully marked task ${taskId} as completed`);
            this.tasksCompleted++;
            console.log(`Task completed successfully: ${task.url}`);
          } catch (apiError) {
            console.error(`Failed to mark task ${taskId} as completed:`, apiError.response?.status, apiError.response?.data);
            // If we can't mark it as completed, mark it as failed
            await axios.put(`${this.apiBaseUrl}/api/queue`, {
              id: taskId,
              action: 'fail',
              error: 'Failed to update task status after saving results'
            }, {
              headers: this.getAuthHeaders()
            });
          }
        } catch (saveError) {
          console.error(`Failed to save results for task ${taskId}:`, saveError.response?.status, saveError.response?.data);
          // Mark task as failed if saving results fails
          await axios.put(`${this.apiBaseUrl}/api/queue`, {
            id: taskId,
            action: 'fail',
            error: 'Failed to save scraping results to database'
          }, {
            headers: this.getAuthHeaders()
          });
          throw saveError; // Re-throw to trigger the catch block
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error(`Task failed: ${task.url}`, error.message);
      
      // Mark task as failed
      try {
        await axios.put(`${this.apiBaseUrl}/api/queue`, {
          id: taskId,
          action: 'fail',
          error: error.message
        }, {
          headers: this.getAuthHeaders()
        });
        console.log(`Successfully marked task ${taskId} as failed`);
      } catch (apiError) {
        console.error(`Failed to mark task ${taskId} as failed:`, apiError.response?.status, apiError.response?.data);
      }
    } finally {
      this.currentTasks.delete(taskId);
      await this.updateWorkerStatus();
    }
  }

  async runScraper(url) {
    return new Promise((resolve) => {
      const scriptPath = path.join(__dirname, '..', 'tiktok_scraper.py');
      const pythonPath = path.join(__dirname, 'venv', 'bin', 'python');
      
      // Use virtual environment python if available, otherwise system python
      const pythonCommand = require('fs').existsSync(pythonPath) ? pythonPath : 'python3';
      
      console.log(`🚀 Starting TikTok scraper for: ${url}`);
      console.log(`🐍 Using Python: ${pythonCommand}`);
      console.log(`📄 Script: ${scriptPath}`);
      
      // Use spawn for real-time output streaming
      const { spawn } = require('child_process');
      const scraperProcess = spawn(pythonCommand, [scriptPath, url], {
        cwd: __dirname,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      let lastOutput = '';
      
      // Stream stdout with real-time logging
      scraperProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        
        // Log each line as it comes
        const lines = output.split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            console.log(`[SCRAPER] ${line.trim()}`);
          }
        });
      });
      
      // Stream stderr with real-time logging
      scraperProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        
        // Log stderr lines
        const lines = output.split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            console.error(`[SCRAPER ERROR] ${line.trim()}`);
          }
        });
      });
      
      // Handle process completion
      scraperProcess.on('close', (code) => {
        console.log(`📊 Scraper process finished with exit code: ${code}`);
        
        if (code !== 0) {
          console.error('❌ Scraper failed with non-zero exit code');
          resolve({
            success: false,
            error: `Scraper failed with exit code ${code}${stderr ? '\nStderr: ' + stderr : ''}`
          });
          return;
        }

        if (!stdout || stdout.trim() === '') {
          console.error('❌ Scraper produced no output');
          resolve({
            success: false,
            error: 'Scraper produced no output'
          });
          return;
        }

        // Extract JSON from stdout using delimiters
        try {
          const lines = stdout.trim().split('\n');
          
          // First try to find JSON between [SCRAPER_OUTPUT_START] and [SCRAPER_OUTPUT_END]
          let startIndex = -1;
          let endIndex = -1;
          
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('[SCRAPER_OUTPUT_START]')) {
              startIndex = i + 1;
            } else if (lines[i].includes('[SCRAPER_OUTPUT_END]')) {
              endIndex = i;
              break;
            }
          }
          
          let jsonStr = '';
          
          if (startIndex >= 0 && endIndex >= 0 && endIndex > startIndex) {
            // Extract JSON between delimiters
            const jsonLines = lines.slice(startIndex, endIndex);
            jsonStr = jsonLines.join('\n').trim();
            console.log(`🔍 Found JSON between delimiters (${jsonStr.length} chars)`);
          } else {
            // Fallback: try to find JSON at the end of output (without delimiters)
            console.log('🔄 No delimiters found, trying fallback parsing...');
            
            // Look for JSON starting from the end, skipping log messages
            for (let i = lines.length - 1; i >= 0; i--) {
              const line = lines[i].trim();
              
              // Skip empty lines and log messages
              if (!line || line.startsWith('✅') || line.startsWith('📊') || 
                  line.startsWith('❌') || line.startsWith('🔒') || 
                  line.startsWith('[SCRAPER')) {
                continue;
              }
              
              // If we find a line that looks like JSON end
              if (line === ']' || line === '}') {
                // Work backwards to find the start
                let jsonStart = i;
                let bracketCount = 0;
                let foundStart = false;
                
                for (let j = i; j >= 0; j--) {
                  const currentLine = lines[j].trim();
                  
                  // Count brackets to find matching start
                  for (let k = currentLine.length - 1; k >= 0; k--) {
                    const char = currentLine[k];
                    if (char === ']' || char === '}') bracketCount++;
                    else if (char === '[' || char === '{') bracketCount--;
                    
                    if (bracketCount === 0) {
                      jsonStart = j;
                      foundStart = true;
                      break;
                    }
                  }
                  
                  if (foundStart) break;
                }
                
                if (foundStart) {
                  const jsonLines = lines.slice(jsonStart, i + 1);
                  jsonStr = jsonLines.join('\n').trim();
                  console.log(`🔍 Found JSON using fallback method (${jsonStr.length} chars)`);
                  break;
                }
              }
            }
          }
          
          if (!jsonStr) {
            // Final fallback: extract JSON from the entire output
            const fullOutput = stdout.trim();
            const jsonStartIndex = Math.max(
              fullOutput.indexOf('['),
              fullOutput.indexOf('{')
            );
            
            if (jsonStartIndex !== -1) {
              // Try to extract complete JSON
              const potentialJson = fullOutput.substring(jsonStartIndex);
              let bracketCount = 0;
              let inString = false;
              let escaped = false;
              
              for (let i = 0; i < potentialJson.length; i++) {
                const char = potentialJson[i];
                
                if (escaped) {
                  escaped = false;
                  continue;
                }
                
                if (char === '\\') {
                  escaped = true;
                  continue;
                }
                
                if (char === '"') {
                  inString = !inString;
                  continue;
                }
                
                if (!inString) {
                  if (char === '[' || char === '{') {
                    bracketCount++;
                  } else if (char === ']' || char === '}') {
                    bracketCount--;
                    if (bracketCount === 0) {
                      jsonStr = potentialJson.substring(0, i + 1);
                      break;
                    }
                  }
                }
              }
              
              if (jsonStr) {
                console.log(`🔍 Found JSON using final fallback (${jsonStr.length} chars)`);
              }
            }
          }
          
          if (!jsonStr) {
            throw new Error('No valid JSON found in scraper output');
          }
          
          const result = JSON.parse(jsonStr);
          console.log('✅ Scraper completed successfully!');
          console.log(`📊 Result summary: ${Array.isArray(result) ? result.length : 'Unknown'} videos processed`);
          
          resolve({
            success: true,
            data: result
          });
        } catch (parseError) {
          console.error('❌ Failed to parse scraper JSON output');
          console.error('Parse error:', parseError.message);
          console.error('Raw stdout (last 1000 chars):', stdout.slice(-1000));
          resolve({
            success: false,
            error: `Failed to parse scraper output: ${parseError.message}`
          });
        }
      });
      
      // Handle process errors
      scraperProcess.on('error', (error) => {
        console.error('❌ Failed to start scraper process:', error.message);
        resolve({
          success: false,
          error: `Failed to start scraper: ${error.message}`
        });
      });
      
      // No timeout - allow unlimited processing time for large profiles
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
    
    // Publish status to Redis using the publisher connection
    await this.redisPublisher.publish('worker:status', JSON.stringify(status));
    
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
    this.status = 'idle'; // Use valid enum value instead of 'stopped'
    
    // Try to update status, but don't worry if worker was already removed
    try {
      await this.updateWorkerStatus();
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('Worker already removed from database - this is normal during removal');
      } else {
        console.error('Error during shutdown status update:', error.response?.status, error.response?.data || error.message);
      }
    }
    
    await this.redis.disconnect();
    await this.redisPublisher.disconnect();
    
    console.log('Worker shutdown complete');
    process.exit(0);
  }
}

// Initialize worker
const worker = new TikTokWorker();

// Handle graceful shutdown
process.on('SIGINT', () => worker.shutdown());
process.on('SIGTERM', () => worker.shutdown());

// Initialize and start worker properly
async function initializeWorker() {
  try {
    // First register the worker
    await worker.registerWorker();
    
    // Then start processing
    await worker.start();
    
    console.log(`TikTok Worker ${worker.workerId} initialized and ready`);
  } catch (error) {
    console.error('Failed to initialize worker:', error);
    process.exit(1);
  }
}

// Auto-start worker
initializeWorker();

// Status reporting every 30 seconds
cron.schedule('*/30 * * * * *', () => {
  worker.reportStatus().catch(console.error);
}); 