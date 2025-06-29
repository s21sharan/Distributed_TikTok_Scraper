#!/usr/bin/env python3
"""
TikTok Scraper Worker Node
Distributed worker that connects to coordinator and processes scraping jobs
"""

import asyncio
import json
import socket
import aiohttp
import argparse
import os
import csv
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any

from models import (
    WorkerRegister, WorkerHeartbeat, WorkerStatus, JobProgress, JobStatus,
    VideoData, JobAssignment
)
from async_scraper import AsyncTikTokScraper

class TikTokWorker:
    """Distributed TikTok scraper worker"""
    
    def __init__(self, coordinator_host: str, coordinator_port: int = 8000):
        self.coordinator_host = coordinator_host
        self.coordinator_port = coordinator_port
        self.coordinator_url = f"http://{coordinator_host}:{coordinator_port}"
        
        self.worker_id = None
        self.hostname = socket.gethostname()
        self.ip_address = self.get_local_ip()
        self.port = 0  # Will be assigned
        self.status = WorkerStatus.CONNECTING
        self.is_running = False
        
        self.scraper = None
        self.current_job = None
        self.session = None
        
        print(f"🔧 Worker initialized")
        print(f"   📍 Hostname: {self.hostname}")
        print(f"   🌐 IP Address: {self.ip_address}")
        print(f"   🎯 Coordinator: {self.coordinator_url}")
    
    def get_local_ip(self) -> str:
        """Get local IP address"""
        try:
            # Connect to a remote address to determine local IP
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
                s.connect(("8.8.8.8", 80))
                return s.getsockname()[0]
        except:
            return "127.0.0.1"
    
    async def start(self):
        """Start the worker"""
        if self.is_running:
            return
        
        print("🚀 Starting TikTok Scraper Worker...")
        self.is_running = True
        
        # Create HTTP session
        self.session = aiohttp.ClientSession()
        
        # Initialize scraper
        self.scraper = AsyncTikTokScraper(
            worker_id="temp",  # Will be updated after registration
            progress_callback=self.handle_progress_update
        )
        
        try:
            # Register with coordinator
            await self.register_with_coordinator()
            
            # Start main worker loop
            await self.worker_loop()
            
        except Exception as e:
            print(f"❌ Worker error: {e}")
        finally:
            await self.stop()
    
    async def stop(self):
        """Stop the worker"""
        if not self.is_running:
            return
        
        print("🛑 Stopping worker...")
        self.is_running = False
        
        # Unregister from coordinator
        if self.worker_id:
            try:
                await self.unregister_from_coordinator()
            except:
                pass
        
        # Close scraper
        if self.scraper:
            await self.scraper.close_driver()
        
        # Close HTTP session
        if self.session:
            await self.session.close()
        
        print("✅ Worker stopped")
    
    async def register_with_coordinator(self):
        """Register this worker with the coordinator"""
        # Get capabilities
        capabilities = {
            "browser": "Chrome",
            "headless": True,
            "max_concurrent_jobs": 1,
            "supported_platforms": ["tiktok.com"],
            "features": ["auto_scroll", "aggressive_loading", "real_time_progress"],
            "hostname": self.hostname,
            "selenium_version": "4.15.2"
        }
        
        registration_data = WorkerRegister(
            hostname=self.hostname,
            ip_address=self.ip_address,
            port=self.port,
            capabilities=capabilities
        )
        
        try:
            async with self.session.post(
                f"{self.coordinator_url}/api/workers/register",
                json=registration_data.dict()
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    self.worker_id = result["worker_id"]
                    self.scraper.worker_id = self.worker_id
                    self.status = WorkerStatus.IDLE
                    
                    print(f"✅ Registered with coordinator!")
                    print(f"   🆔 Worker ID: {self.worker_id}")
                    print(f"   📡 Status: {self.status}")
                    return True
                else:
                    print(f"❌ Registration failed: {response.status}")
                    return False
                    
        except Exception as e:
            print(f"❌ Registration error: {e}")
            return False
    
    async def unregister_from_coordinator(self):
        """Unregister from coordinator"""
        if not self.worker_id:
            return
        
        try:
            async with self.session.post(
                f"{self.coordinator_url}/api/workers/{self.worker_id}/unregister"
            ) as response:
                if response.status == 200:
                    print("✅ Unregistered from coordinator")
                else:
                    print(f"⚠️  Unregister response: {response.status}")
        except Exception as e:
            print(f"⚠️  Unregister error: {e}")
    
    async def send_heartbeat(self):
        """Send heartbeat to coordinator"""
        if not self.worker_id:
            return
        
        heartbeat = WorkerHeartbeat(
            worker_id=self.worker_id,
            status=self.status,
            current_job_id=self.current_job.get('job_id') if self.current_job else None,
            last_activity=datetime.utcnow().isoformat()
        )
        
        try:
            async with self.session.post(
                f"{self.coordinator_url}/api/workers/{self.worker_id}/heartbeat",
                json=heartbeat.dict()
            ) as response:
                if response.status != 200:
                    print(f"⚠️  Heartbeat failed: {response.status}")
        except Exception as e:
            print(f"⚠️  Heartbeat error: {e}")
    
    async def handle_progress_update(self, progress: JobProgress):
        """Handle progress updates from scraper"""
        if not self.worker_id or not self.current_job:
            return
        
        try:
            async with self.session.post(
                f"{self.coordinator_url}/api/jobs/{progress.job_id}/progress",
                json=progress.dict()
            ) as response:
                if response.status != 200:
                    print(f"⚠️  Progress update failed: {response.status}")
        except Exception as e:
            print(f"⚠️  Progress update error: {e}")
    
    async def check_for_job_assignment(self) -> Optional[Dict[str, Any]]:
        """Check if there's a job assigned to this worker"""
        # This would typically be done via a job queue or direct assignment
        # For now, we'll implement a simple polling mechanism
        # In a production system, you'd use Redis queues or WebSocket communication
        return None
    
    async def worker_loop(self):
        """Main worker loop"""
        heartbeat_interval = 15  # seconds
        last_heartbeat = 0
        
        print(f"🔄 Worker loop started (ID: {self.worker_id})")
        
        while self.is_running:
            try:
                current_time = asyncio.get_event_loop().time()
                
                # Send heartbeat periodically
                if current_time - last_heartbeat >= heartbeat_interval:
                    await self.send_heartbeat()
                    last_heartbeat = current_time
                
                # Check for job assignments (simplified polling)
                # In a real implementation, this would be event-driven
                job_assignment = await self.check_for_job_assignment()
                
                if job_assignment and self.status == WorkerStatus.IDLE:
                    await self.process_job(job_assignment)
                
                # Wait a bit before next iteration
                await asyncio.sleep(5)
                
            except Exception as e:
                print(f"❌ Worker loop error: {e}")
                await asyncio.sleep(10)
    
    async def process_job(self, job_assignment: Dict[str, Any]):
        """Process a scraping job"""
        job_id = job_assignment["job_id"]
        url = job_assignment["url"]
        profile_username = job_assignment.get("profile_username")
        
        print(f"📋 Processing job {job_id}: {url}")
        
        self.current_job = job_assignment
        self.status = WorkerStatus.BUSY
        
        try:
            # Scrape the profile
            video_data = await self.scraper.scrape_profile(job_id, url)
            
            # Save results to CSV
            csv_path = await self.save_results_to_csv(job_id, profile_username, video_data)
            
            # Update job status
            final_progress = JobProgress(
                job_id=job_id,
                worker_id=self.worker_id,
                total_videos=len(video_data),
                processed_videos=len(video_data),
                failed_videos=0,
                status=JobStatus.COMPLETED,
                message=f"Completed successfully! Results saved to {csv_path}"
            )
            
            await self.handle_progress_update(final_progress)
            
            print(f"✅ Job {job_id} completed successfully!")
            print(f"   📊 Videos scraped: {len(video_data)}")
            print(f"   💾 Results saved: {csv_path}")
            
        except Exception as e:
            print(f"❌ Job {job_id} failed: {e}")
            
            # Update job status as failed
            failed_progress = JobProgress(
                job_id=job_id,
                worker_id=self.worker_id,
                total_videos=0,
                processed_videos=0,
                failed_videos=0,
                status=JobStatus.FAILED,
                message=f"Job failed: {str(e)}"
            )
            
            await self.handle_progress_update(failed_progress)
        
        finally:
            # Reset worker state
            self.current_job = None
            self.status = WorkerStatus.IDLE
    
    async def save_results_to_csv(self, job_id: int, profile_username: str, video_data: list) -> str:
        """Save scraping results to CSV file"""
        if not video_data:
            raise Exception("No video data to save")
        
        # Create results directory
        results_dir = Path("results")
        results_dir.mkdir(exist_ok=True)
        
        # Generate filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"job_{job_id}_{profile_username}_{timestamp}.csv"
        filepath = results_dir / filename
        
        # Write CSV
        with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['job_id', 'profile_username', 'video_url', 'views', 'likes', 
                         'bookmarks', 'comments', 'views_raw', 'likes_raw', 
                         'bookmarks_raw', 'comments_raw', 'scraped_at']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            
            writer.writeheader()
            for video in video_data:
                row = {
                    'job_id': job_id,
                    'profile_username': profile_username,
                    'video_url': video.video_url,
                    'views': video.views,
                    'likes': video.likes,
                    'bookmarks': video.bookmarks,
                    'comments': video.comments,
                    'scraped_at': datetime.utcnow().isoformat()
                }
                
                # Add raw data if available
                if video.raw_data:
                    row.update({
                        'views_raw': video.raw_data.get('views_raw', ''),
                        'likes_raw': video.raw_data.get('likes_raw', ''),
                        'bookmarks_raw': video.raw_data.get('bookmarks_raw', ''),
                        'comments_raw': video.raw_data.get('comments_raw', '')
                    })
                
                writer.writerow(row)
        
        return str(filepath)

# Enhanced Worker with Job Queue Support
class EnhancedTikTokWorker(TikTokWorker):
    """Enhanced worker with Redis job queue support"""
    
    def __init__(self, coordinator_host: str, coordinator_port: int = 8000, 
                 redis_host: str = "localhost", redis_port: int = 6379):
        super().__init__(coordinator_host, coordinator_port)
        self.redis_host = redis_host
        self.redis_port = redis_port
        self.redis_client = None
    
    async def start(self):
        """Start enhanced worker with Redis support"""
        try:
            import aioredis
            self.redis_client = aioredis.from_url(
                f"redis://{self.redis_host}:{self.redis_port}", 
                decode_responses=True
            )
            print(f"✅ Connected to Redis: {self.redis_host}:{self.redis_port}")
        except ImportError:
            print("⚠️  Redis not available, falling back to basic polling")
        except Exception as e:
            print(f"⚠️  Redis connection failed: {e}, falling back to basic polling")
        
        await super().start()
    
    async def check_for_job_assignment(self) -> Optional[Dict[str, Any]]:
        """Check for job assignments via Redis queue"""
        if not self.redis_client:
            return await super().check_for_job_assignment()
        
        try:
            # Check if there's a job in the queue for this worker
            job_key = f"tiktok_scraper:worker:{self.worker_id}:job"
            job_data = await self.redis_client.get(job_key)
            
            if job_data:
                # Remove the job from Redis
                await self.redis_client.delete(job_key)
                return json.loads(job_data)
                
        except Exception as e:
            print(f"⚠️  Redis job check error: {e}")
        
        return None

async def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="TikTok Scraper Worker")
    parser.add_argument("--coordinator", "-c", required=True, 
                       help="Coordinator server IP address")
    parser.add_argument("--port", "-p", type=int, default=8000,
                       help="Coordinator server port (default: 8000)")
    parser.add_argument("--redis-host", default="localhost",
                       help="Redis server host (default: localhost)")
    parser.add_argument("--redis-port", type=int, default=6379,
                       help="Redis server port (default: 6379)")
    parser.add_argument("--enhanced", action="store_true",
                       help="Use enhanced worker with Redis support")
    parser.add_argument("--headless", action="store_true", default=True,
                       help="Run browser in headless mode (default: True)")
    
    args = parser.parse_args()
    
    print("🎵 TikTok Scraper Worker")
    print("=" * 50)
    
    # Create worker
    if args.enhanced:
        worker = EnhancedTikTokWorker(
            coordinator_host=args.coordinator,
            coordinator_port=args.port,
            redis_host=args.redis_host,
            redis_port=args.redis_port
        )
    else:
        worker = TikTokWorker(
            coordinator_host=args.coordinator,
            coordinator_port=args.port
        )
    
    # Handle shutdown gracefully
    try:
        await worker.start()
    except KeyboardInterrupt:
        print("\n⚠️  Shutdown requested by user")
    except Exception as e:
        print(f"❌ Worker error: {e}")
    finally:
        await worker.stop()

if __name__ == "__main__":
    asyncio.run(main()) 