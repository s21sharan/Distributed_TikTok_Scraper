const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 TikTok Worker Startup Script');
console.log('================================');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found!');
    console.log('Please copy .env.example to .env and configure it.');
    console.log('Run: cp .env.example .env');
    process.exit(1);
}

// Load environment variables
require('dotenv').config();

// Validate required environment variables
const requiredVars = ['API_BASE_URL', 'REDIS_URL', 'WORKER_NAME'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => {
        console.error(`   - ${varName}`);
    });
    console.log('\nPlease edit your .env file and set these variables.');
    process.exit(1);
}

console.log('✅ Environment variables validated');
console.log(`📍 Worker Name: ${process.env.WORKER_NAME}`);
console.log(`🌐 API URL: ${process.env.API_BASE_URL}`);
console.log(`⚡ Max Tasks: ${process.env.MAX_CONCURRENT_TASKS || 3}`);

// Function to start the worker with restart capability
function startWorker() {
    console.log('\n🔄 Starting TikTok Worker...');
    
    const worker = spawn('node', ['worker.js'], {
        stdio: 'inherit',
        cwd: __dirname
    });

    worker.on('close', (code) => {
        if (code === 0) {
            console.log('✅ Worker exited cleanly');
            process.exit(0);
        } else {
            console.error(`❌ Worker exited with code ${code}`);
            console.log('🔄 Restarting in 5 seconds...');
            setTimeout(startWorker, 5000);
        }
    });

    worker.on('error', (err) => {
        console.error('❌ Failed to start worker:', err.message);
        console.log('🔄 Retrying in 10 seconds...');
        setTimeout(startWorker, 10000);
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Received SIGINT, shutting down gracefully...');
        worker.kill('SIGINT');
    });

    process.on('SIGTERM', () => {
        console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
        worker.kill('SIGTERM');
    });
}

// Start the worker
startWorker(); 