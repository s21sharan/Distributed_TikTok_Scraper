#!/usr/bin/env python3
"""
Local Development Startup Script
Starts the TikTok Scraper application in local development mode
"""

import os
import sys
import time
import signal
import subprocess
import threading
from pathlib import Path

# ANSI color codes
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    MAGENTA = '\033[0;35m'
    CYAN = '\033[0;36m'
    WHITE = '\033[1;37m'
    NC = '\033[0m'  # No Color

def print_colored(text, color=Colors.WHITE):
    print(f"{color}{text}{Colors.NC}")

def print_status(text):
    print_colored(f"[INFO] {text}", Colors.BLUE)

def print_success(text):
    print_colored(f"[SUCCESS] {text}", Colors.GREEN)

def print_error(text):
    print_colored(f"[ERROR] {text}", Colors.RED)

def print_warning(text):
    print_colored(f"[WARNING] {text}", Colors.YELLOW)

def check_requirements():
    """Check if required dependencies are installed"""
    print_status("Checking requirements...")
    
    # Check Python version
    if sys.version_info < (3, 8):
        print_error("Python 3.8+ is required")
        return False
    
    # Check for required packages
    required_packages = ['redis', 'fastapi', 'uvicorn', 'selenium']
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        print_error(f"Missing packages: {', '.join(missing_packages)}")
        print_status("Install with: pip install -r backend/requirements.txt")
        return False
    
    # Check for Node.js
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        if result.returncode != 0:
            print_error("Node.js is not installed")
            return False
    except FileNotFoundError:
        print_error("Node.js is not installed")
        return False
    
    # Check for Redis
    try:
        result = subprocess.run(['redis-cli', 'ping'], capture_output=True, text=True)
        if result.returncode != 0:
            print_warning("Redis server may not be running")
            print_status("Start Redis with: redis-server")
    except FileNotFoundError:
        print_warning("Redis CLI not found - make sure Redis is installed and running")
    
    print_success("Requirements check completed!")
    return True

def setup_environment():
    """Setup environment files if they don't exist"""
    print_status("Setting up environment files...")
    
    # Backend .env
    backend_env = Path('backend/.env')
    if not backend_env.exists():
        with open(backend_env, 'w') as f:
            f.write("""DATABASE_URL=sqlite:///./scraper.db
REDIS_HOST=localhost
REDIS_PORT=6379
CORS_ORIGINS=http://localhost:3000
DEBUG=True
""")
        print_success("Created backend/.env")
    
    # Frontend .env
    frontend_env = Path('frontend/.env')
    if not frontend_env.exists():
        with open(frontend_env, 'w') as f:
            f.write("""REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000
""")
        print_success("Created frontend/.env")

def install_dependencies():
    """Install Python and Node.js dependencies"""
    print_status("Installing dependencies...")
    
    # Install Python dependencies
    print_status("Installing Python dependencies...")
    result = subprocess.run([
        sys.executable, '-m', 'pip', 'install', '-r', 'backend/requirements.txt'
    ], cwd=Path.cwd())
    
    if result.returncode != 0:
        print_error("Failed to install Python dependencies")
        return False
    
    # Install Node.js dependencies
    print_status("Installing Node.js dependencies...")
    result = subprocess.run(['npm', 'install'], cwd=Path('frontend'))
    
    if result.returncode != 0:
        print_error("Failed to install Node.js dependencies")
        return False
    
    print_success("Dependencies installed successfully!")
    return True

def create_directories():
    """Create necessary directories"""
    print_status("Creating directories...")
    
    directories = ['data', 'backend/logs']
    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)
    
    print_success("Directories created!")

class ProcessManager:
    def __init__(self):
        self.processes = {}
        self.running = True
    
    def start_process(self, name, cmd, cwd=None, env=None):
        """Start a subprocess"""
        print_status(f"Starting {name}...")
        
        process_env = os.environ.copy()
        if env:
            process_env.update(env)
        
        try:
            process = subprocess.Popen(
                cmd,
                cwd=cwd,
                env=process_env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True
            )
            
            self.processes[name] = process
            
            # Start output reader thread
            thread = threading.Thread(
                target=self._read_output,
                args=(name, process),
                daemon=True
            )
            thread.start()
            
            print_success(f"{name} started (PID: {process.pid})")
            return True
            
        except Exception as e:
            print_error(f"Failed to start {name}: {e}")
            return False
    
    def _read_output(self, name, process):
        """Read process output and print with prefix"""
        while self.running and process.poll() is None:
            try:
                line = process.stdout.readline()
                if line:
                    print_colored(f"[{name}] {line.strip()}", Colors.CYAN)
            except:
                break
    
    def stop_all(self):
        """Stop all processes"""
        print_status("Stopping all processes...")
        self.running = False
        
        for name, process in self.processes.items():
            if process.poll() is None:
                print_status(f"Stopping {name}...")
                process.terminate()
                
                # Wait for graceful shutdown
                try:
                    process.wait(timeout=5)
                    print_success(f"{name} stopped")
                except subprocess.TimeoutExpired:
                    print_warning(f"Force killing {name}...")
                    process.kill()
                    process.wait()
    
    def wait_for_processes(self):
        """Wait for all processes to complete"""
        try:
            while self.running:
                time.sleep(1)
                
                # Check if any process died
                for name, process in list(self.processes.items()):
                    if process.poll() is not None:
                        print_error(f"{name} stopped unexpectedly (exit code: {process.returncode})")
                        return False
        except KeyboardInterrupt:
            print_status("Received interrupt signal")
            return True

def main():
    """Main function"""
    print_colored("=" * 60, Colors.MAGENTA)
    print_colored("🎵 TikTok Scraper - Local Development Setup", Colors.MAGENTA)
    print_colored("=" * 60, Colors.MAGENTA)
    
    # Change to script directory
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    # Setup
    if not check_requirements():
        sys.exit(1)
    
    setup_environment()
    create_directories()
    
    if '--install' in sys.argv:
        if not install_dependencies():
            sys.exit(1)
    
    # Process manager
    pm = ProcessManager()
    
    def signal_handler(signum, frame):
        print_status("Shutting down...")
        pm.stop_all()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Start services
    print_status("Starting services...")
    
    # Backend coordinator
    if not pm.start_process(
        'coordinator',
        [sys.executable, 'coordinator.py'],
        cwd=Path('backend')
    ):
        sys.exit(1)
    
    # Wait a bit for backend to start
    time.sleep(3)
    
    # Frontend
    if not pm.start_process(
        'frontend',
        ['npm', 'start'],
        cwd=Path('frontend'),
        env={'BROWSER': 'none'}  # Don't auto-open browser
    ):
        pm.stop_all()
        sys.exit(1)
    
    # Worker (optional)
    if '--with-worker' in sys.argv:
        time.sleep(2)
        pm.start_process(
            'worker',
            [sys.executable, 'worker.py', '--coordinator-host', 'localhost'],
            cwd=Path('backend')
        )
    
    # Print URLs
    print_colored("\n" + "=" * 60, Colors.GREEN)
    print_colored("🎉 Application started successfully!", Colors.GREEN)
    print_colored("=" * 60, Colors.GREEN)
    print_colored("📱 Frontend Dashboard: http://localhost:3000", Colors.WHITE)
    print_colored("🔧 Backend API: http://localhost:8000", Colors.WHITE)
    print_colored("📊 API Docs: http://localhost:8000/docs", Colors.WHITE)
    print_colored("❤️  Health Check: http://localhost:8000/health", Colors.WHITE)
    print_colored("=" * 60, Colors.GREEN)
    print_colored("Press Ctrl+C to stop all services", Colors.YELLOW)
    print_colored("=" * 60, Colors.GREEN)
    
    # Wait for processes
    pm.wait_for_processes()
    pm.stop_all()

def show_help():
    """Show help message"""
    print("""
TikTok Scraper Local Development Script

Usage: python start_local.py [OPTIONS]

Options:
    --install       Install dependencies before starting
    --with-worker   Start a local worker node
    --help          Show this help message

Examples:
    python start_local.py                    # Start coordinator and frontend
    python start_local.py --install          # Install deps and start
    python start_local.py --with-worker      # Start with a worker node

Requirements:
    - Python 3.8+
    - Node.js 16+
    - Redis server running
    """)

if __name__ == "__main__":
    if '--help' in sys.argv:
        show_help()
    else:
        main() 