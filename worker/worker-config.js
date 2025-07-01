// Worker Configuration
module.exports = {
  // API Configuration
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  API_SECRET_KEY: process.env.API_SECRET_KEY || 'supersecretkey123',
  
  // Worker Identity
  WORKER_NAME: process.env.WORKER_NAME || `Worker-${Date.now()}`,
  WORKER_HOST: process.env.WORKER_HOST || require('os').hostname(),
  
  // Redis Configuration
  REDIS_URL: process.env.REDIS_URL,
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: process.env.REDIS_PORT || 6379,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  
  // Worker Settings
  MAX_CONCURRENT_TASKS: parseInt(process.env.MAX_CONCURRENT_TASKS) || 3,
  
  // Get Redis configuration object
  getRedisConfig() {
    if (this.REDIS_URL) {
      return this.REDIS_URL;
    }
    
    const config = {
      host: this.REDIS_HOST,
      port: this.REDIS_PORT
    };
    
    if (this.REDIS_PASSWORD) {
      config.password = this.REDIS_PASSWORD;
    }
    
    return config;
  }
}; 