#!/usr/bin/env python3
"""
TikTok Scraper Coordinator Server
Central server that manages distributed workers and provides web interface
"""

import asyncio
import json
import uuid
from datetime import datetime, timedelta
import os
from pathlib import Path
from typing import Dict, List, Optional, Set
import socket

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
from fastapi.responses import HTMLResponse, FileResponse
import uvicorn
from sqlalchemy.orm import Session
from sqlalchemy import desc

from models import (
    ScrapeJob, ScrapedVideo, Worker, JobCreate, JobResponse, VideoResponse,
    WorkerResponse, WorkerRegister, WorkerHeartbeat, JobProgress, WSMessage,
    WSMessageType, SystemStats, DashboardData, JobStatus, WorkerStatus, JobAssignment
)
from database import get_db, get_async_db, init_db, redis_manager, AsyncSessionLocal
from async_scraper import AsyncTikTokScraper

app = FastAPI(title="TikTok Scraper Coordinator", version="1.0.0")

# Serve static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Global state
active_workers: Dict[str, dict] = {}
websocket_connections: Set[WebSocket] = set()
job_assignments: Dict[int, str] = {}  # job_id -> worker_id

class CoordinatorManager:
    """Manages the coordination of workers and jobs"""
    
    def __init__(self):
        self.is_running = False
        self.background_tasks = []
    
    async def start(self):
        """Start the coordinator"""
        if self.is_running:
            return
        
        self.is_running = True
        print("🚀 Starting TikTok Scraper Coordinator...")
        
        # Initialize database
        await init_db()
        await redis_manager.init()
        
        # Start background tasks
        asyncio.create_task(self.worker_monitor_loop())
        asyncio.create_task(self.job_assignment_loop())
        asyncio.create_task(self.stats_update_loop())
        
        print("✅ Coordinator started successfully!")
    
    async def stop(self):
        """Stop the coordinator"""
        self.is_running = False
        await redis_manager.close()
        
        # Close all WebSocket connections
        for ws in websocket_connections.copy():
            try:
                await ws.close()
            except:
                pass
        
        print("🛑 Coordinator stopped")
    
    async def worker_monitor_loop(self):
        """Monitor worker heartbeats and clean up stale workers"""
        while self.is_running:
            try:
                current_time = datetime.utcnow()
                stale_workers = []
                
                # Check worker heartbeats
                for worker_id, worker_data in active_workers.items():
                    last_heartbeat = worker_data.get('last_heartbeat')
                    if last_heartbeat:
                        last_heartbeat_time = datetime.fromisoformat(last_heartbeat)
                        if current_time - last_heartbeat_time > timedelta(seconds=60):
                            stale_workers.append(worker_id)
                
                # Remove stale workers
                for worker_id in stale_workers:
                    await self.unregister_worker(worker_id, "Heartbeat timeout")
                
                # Update worker status in database
                async with AsyncSessionLocal() as db:
                    for worker_id in active_workers:
                        worker = await db.get(Worker, worker_id)
                        if worker:
                            worker.last_heartbeat = datetime.utcnow()
                            await db.commit()
                
                await asyncio.sleep(30)  # Check every 30 seconds
                
            except Exception as e:
                print(f"Error in worker monitor loop: {e}")
                await asyncio.sleep(30)
    
    async def job_assignment_loop(self):
        """Assign pending jobs to available workers"""
        while self.is_running:
            try:
                async with AsyncSessionLocal() as db:
                    # Get pending jobs
                    pending_jobs = await db.execute(
                        db.query(ScrapeJob).filter(ScrapeJob.status == JobStatus.PENDING)
                    )
                    pending_jobs = pending_jobs.scalars().all()
                    
                    # Get idle workers
                    idle_workers = [
                        worker_id for worker_id, worker_data in active_workers.items()
                        if worker_data.get('status') == WorkerStatus.IDLE
                    ]
                    
                    # Assign jobs to workers
                    for job in pending_jobs:
                        if not idle_workers:
                            break
                        
                        worker_id = idle_workers.pop(0)
                        await self.assign_job_to_worker(job.id, worker_id)
                
                await asyncio.sleep(5)  # Check every 5 seconds
                
            except Exception as e:
                print(f"Error in job assignment loop: {e}")
                await asyncio.sleep(5)
    
    async def stats_update_loop(self):
        """Update system statistics and broadcast to clients"""
        while self.is_running:
            try:
                stats = await self.get_system_stats()
                await self.broadcast_to_clients({
                    "type": WSMessageType.SYSTEM_STATS,
                    "data": stats.dict(),
                    "timestamp": datetime.utcnow().isoformat()
                })
                
                await asyncio.sleep(10)  # Update every 10 seconds
                
            except Exception as e:
                print(f"Error in stats update loop: {e}")
                await asyncio.sleep(10)
    
    async def register_worker(self, worker_data: WorkerRegister) -> str:
        """Register a new worker"""
        worker_id = str(uuid.uuid4())
        
        # Add to active workers
        active_workers[worker_id] = {
            "id": worker_id,
            "hostname": worker_data.hostname,
            "ip_address": worker_data.ip_address,
            "port": worker_data.port,
            "status": WorkerStatus.IDLE,
            "capabilities": worker_data.capabilities,
            "last_heartbeat": datetime.utcnow().isoformat(),
            "connected_at": datetime.utcnow().isoformat(),
            "current_job_id": None,
            "total_jobs_completed": 0,
            "total_videos_scraped": 0
        }
        
        # Add to database
        async with AsyncSessionLocal() as db:
            db_worker = Worker(
                id=worker_id,
                hostname=worker_data.hostname,
                ip_address=worker_data.ip_address,
                port=worker_data.port,
                status=WorkerStatus.IDLE,
                capabilities=worker_data.capabilities,
                last_heartbeat=datetime.utcnow(),
                connected_at=datetime.utcnow()
            )
            db.add(db_worker)
            await db.commit()
        
        # Broadcast worker connected
        await self.broadcast_to_clients({
            "type": WSMessageType.WORKER_CONNECTED,
            "data": {"worker_id": worker_id, "worker_data": active_workers[worker_id]},
            "timestamp": datetime.utcnow().isoformat()
        })
        
        print(f"✅ Worker registered: {worker_id} ({worker_data.hostname})")
        return worker_id
    
    async def unregister_worker(self, worker_id: str, reason: str = "Disconnected"):
        """Unregister a worker"""
        if worker_id not in active_workers:
            return
        
        # Handle any running jobs
        current_job_id = active_workers[worker_id].get('current_job_id')
        if current_job_id:
            await self.handle_worker_job_failure(current_job_id, f"Worker disconnected: {reason}")
        
        # Remove from active workers
        worker_data = active_workers.pop(worker_id, {})
        
        # Update database
        async with AsyncSessionLocal() as db:
            worker = await db.get(Worker, worker_id)
            if worker:
                worker.status = WorkerStatus.OFFLINE
                worker.last_heartbeat = datetime.utcnow()
                await db.commit()
        
        # Broadcast worker disconnected
        await self.broadcast_to_clients({
            "type": WSMessageType.WORKER_DISCONNECTED,
            "data": {"worker_id": worker_id, "reason": reason},
            "timestamp": datetime.utcnow().isoformat()
        })
        
        print(f"❌ Worker unregistered: {worker_id} ({reason})")
    
    async def update_worker_heartbeat(self, heartbeat: WorkerHeartbeat):
        """Update worker heartbeat"""
        worker_id = heartbeat.worker_id
        if worker_id not in active_workers:
            return
        
        # Update active workers
        active_workers[worker_id].update({
            "status": heartbeat.status,
            "last_heartbeat": datetime.utcnow().isoformat(),
            "current_job_id": heartbeat.current_job_id,
            "last_activity": heartbeat.last_activity
        })
        
        # Update database
        async with AsyncSessionLocal() as db:
            worker = await db.get(Worker, worker_id)
            if worker:
                worker.status = heartbeat.status
                worker.last_heartbeat = datetime.utcnow()
                worker.current_job_id = heartbeat.current_job_id
                await db.commit()
        
        # Broadcast status update
        await self.broadcast_to_clients({
            "type": WSMessageType.WORKER_STATUS_UPDATE,
            "data": {"worker_id": worker_id, "status": heartbeat.status},
            "timestamp": datetime.utcnow().isoformat()
        })
    
    async def assign_job_to_worker(self, job_id: int, worker_id: str):
        """Assign a job to a worker"""
        if worker_id not in active_workers:
            return False
        
        async with AsyncSessionLocal() as db:
            # Get job
            job = await db.get(ScrapeJob, job_id)
            if not job or job.status != JobStatus.PENDING:
                return False
            
            # Update job
            job.status = JobStatus.ASSIGNED
            job.assigned_worker_id = worker_id
            job.started_at = datetime.utcnow()
            
            # Update worker
            active_workers[worker_id]["status"] = WorkerStatus.BUSY
            active_workers[worker_id]["current_job_id"] = job_id
            
            worker = await db.get(Worker, worker_id)
            if worker:
                worker.status = WorkerStatus.BUSY
                worker.current_job_id = job_id
            
            await db.commit()
            
            # Create job assignment
            assignment = JobAssignment(
                job_id=job_id,
                url=job.url,
                profile_username=job.profile_username,
                assigned_at=datetime.utcnow()
            )
            
            # Store in job assignments
            job_assignments[job_id] = worker_id
            
            # Broadcast job assigned
            await self.broadcast_to_clients({
                "type": WSMessageType.JOB_ASSIGNED,
                "data": {
                    "job_id": job_id,
                    "worker_id": worker_id,
                    "assignment": assignment.dict()
                },
                "timestamp": datetime.utcnow().isoformat()
            })
            
            print(f"📋 Job {job_id} assigned to worker {worker_id}")
            return True
    
    async def handle_job_progress(self, progress: JobProgress):
        """Handle job progress update"""
        job_id = progress.job_id
        worker_id = progress.worker_id
        
        # Update database
        async with AsyncSessionLocal() as db:
            job = await db.get(ScrapeJob, job_id)
            if job:
                job.total_videos = progress.total_videos
                job.processed_videos = progress.processed_videos
                job.failed_videos = progress.failed_videos
                job.status = progress.status
                
                if progress.status == JobStatus.COMPLETED:
                    job.completed_at = datetime.utcnow()
                    # Update worker stats
                    if worker_id in active_workers:
                        active_workers[worker_id]["status"] = WorkerStatus.IDLE
                        active_workers[worker_id]["current_job_id"] = None
                        active_workers[worker_id]["total_jobs_completed"] += 1
                        active_workers[worker_id]["total_videos_scraped"] += progress.processed_videos
                    
                    # Remove from job assignments
                    job_assignments.pop(job_id, None)
                
                elif progress.status == JobStatus.FAILED:
                    job.error_message = progress.message
                    job.completed_at = datetime.utcnow()
                    
                    # Reset worker status
                    if worker_id in active_workers:
                        active_workers[worker_id]["status"] = WorkerStatus.IDLE
                        active_workers[worker_id]["current_job_id"] = None
                    
                    # Remove from job assignments
                    job_assignments.pop(job_id, None)
                
                await db.commit()
        
        # Broadcast progress update
        await self.broadcast_to_clients({
            "type": WSMessageType.JOB_PROGRESS,
            "data": progress.dict(),
            "timestamp": datetime.utcnow().isoformat()
        })
    
    async def handle_worker_job_failure(self, job_id: int, error_message: str):
        """Handle job failure due to worker issues"""
        async with AsyncSessionLocal() as db:
            job = await db.get(ScrapeJob, job_id)
            if job:
                job.status = JobStatus.FAILED
                job.error_message = error_message
                job.completed_at = datetime.utcnow()
                await db.commit()
        
        # Remove from job assignments
        job_assignments.pop(job_id, None)
        
        # Broadcast job failed
        await self.broadcast_to_clients({
            "type": WSMessageType.JOB_FAILED,
            "data": {"job_id": job_id, "error": error_message},
            "timestamp": datetime.utcnow().isoformat()
        })
    
    async def get_system_stats(self) -> SystemStats:
        """Get current system statistics"""
        async with AsyncSessionLocal() as db:
            # Worker stats
            total_workers = len(active_workers)
            active_worker_count = len([w for w in active_workers.values() if w['status'] != WorkerStatus.OFFLINE])
            idle_workers = len([w for w in active_workers.values() if w['status'] == WorkerStatus.IDLE])
            busy_workers = len([w for w in active_workers.values() if w['status'] == WorkerStatus.BUSY])
            offline_workers = total_workers - active_worker_count
            
            # Job stats
            jobs = await db.execute(db.query(ScrapeJob))
            all_jobs = jobs.scalars().all()
            
            total_jobs = len(all_jobs)
            pending_jobs = len([j for j in all_jobs if j.status == JobStatus.PENDING])
            running_jobs = len([j for j in all_jobs if j.status in [JobStatus.ASSIGNED, JobStatus.RUNNING]])
            completed_jobs = len([j for j in all_jobs if j.status == JobStatus.COMPLETED])
            failed_jobs = len([j for j in all_jobs if j.status == JobStatus.FAILED])
            
            # Video stats
            total_videos_scraped = sum(j.processed_videos for j in all_jobs)
            
            return SystemStats(
                total_workers=total_workers,
                active_workers=active_worker_count,
                idle_workers=idle_workers,
                busy_workers=busy_workers,
                offline_workers=offline_workers,
                total_jobs=total_jobs,
                pending_jobs=pending_jobs,
                running_jobs=running_jobs,
                completed_jobs=completed_jobs,
                failed_jobs=failed_jobs,
                total_videos_scraped=total_videos_scraped
            )
    
    async def broadcast_to_clients(self, message: dict):
        """Broadcast message to all connected WebSocket clients"""
        if not websocket_connections:
            return
        
        message_str = json.dumps(message)
        disconnected_clients = []
        
        for websocket in websocket_connections:
            try:
                await websocket.send_text(message_str)
            except:
                disconnected_clients.append(websocket)
        
        # Remove disconnected clients
        for ws in disconnected_clients:
            websocket_connections.discard(ws)

# Initialize coordinator
coordinator = CoordinatorManager()

# API Routes
@app.on_event("startup")
async def startup():
    await coordinator.start()

@app.on_event("shutdown")
async def shutdown():
    await coordinator.stop()

@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    """Main dashboard page"""
    return templates.TemplateResponse("dashboard.html", {"request": request})

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    await websocket.accept()
    websocket_connections.add(websocket)
    
    try:
        # Send initial data
        stats = await coordinator.get_system_stats()
        dashboard_data = DashboardData(
            system_stats=stats,
            workers=[WorkerResponse(**worker) for worker in active_workers.values()],
            active_jobs=[],
            recent_videos=[],
            logs=[]
        )
        
        await websocket.send_text(json.dumps({
            "type": "dashboard_data",
            "data": dashboard_data.dict(),
            "timestamp": datetime.utcnow().isoformat()
        }))
        
        # Keep connection alive
        while True:
            try:
                data = await websocket.receive_text()
                # Handle client messages if needed
            except WebSocketDisconnect:
                break
            
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        websocket_connections.discard(websocket)

# Job Management APIs
@app.post("/api/jobs", response_model=JobResponse)
async def create_job(job: JobCreate, db: Session = Depends(get_db)):
    """Create a new scraping job"""
    # Validate URL
    scraper = AsyncTikTokScraper("temp")
    if not scraper.validate_tiktok_url(job.url):
        raise HTTPException(status_code=400, detail="Invalid TikTok URL")
    
    # Extract profile username if not provided
    if not job.profile_username:
        job.profile_username = scraper.get_profile_username(job.url)
    
    # Create job
    db_job = ScrapeJob(
        url=job.url,
        profile_username=job.profile_username,
        status=JobStatus.PENDING,
        created_at=datetime.utcnow()
    )
    
    db.add(db_job)
    db.commit()
    db.refresh(db_job)
    
    # Broadcast job created
    await coordinator.broadcast_to_clients({
        "type": WSMessageType.JOB_CREATED,
        "data": JobResponse.from_orm(db_job).dict(),
        "timestamp": datetime.utcnow().isoformat()
    })
    
    return JobResponse.from_orm(db_job)

@app.get("/api/jobs", response_model=List[JobResponse])
async def get_jobs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all jobs"""
    jobs = db.query(ScrapeJob).order_by(desc(ScrapeJob.created_at)).offset(skip).limit(limit).all()
    return [JobResponse.from_orm(job) for job in jobs]

@app.get("/api/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: int, db: Session = Depends(get_db)):
    """Get specific job"""
    job = db.query(ScrapeJob).filter(ScrapeJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResponse.from_orm(job)

@app.get("/api/jobs/{job_id}/videos", response_model=List[VideoResponse])
async def get_job_videos(job_id: int, db: Session = Depends(get_db)):
    """Get videos for a specific job"""
    videos = db.query(ScrapedVideo).filter(ScrapedVideo.job_id == job_id).all()
    return [VideoResponse.from_orm(video) for video in videos]

# Worker Management APIs
@app.post("/api/workers/register")
async def register_worker(worker: WorkerRegister):
    """Register a new worker"""
    worker_id = await coordinator.register_worker(worker)
    return {"worker_id": worker_id, "status": "registered"}

@app.post("/api/workers/{worker_id}/heartbeat")
async def worker_heartbeat(worker_id: str, heartbeat: WorkerHeartbeat):
    """Update worker heartbeat"""
    await coordinator.update_worker_heartbeat(heartbeat)
    return {"status": "updated"}

@app.post("/api/workers/{worker_id}/unregister")
async def unregister_worker(worker_id: str):
    """Unregister a worker"""
    await coordinator.unregister_worker(worker_id, "Manual unregister")
    return {"status": "unregistered"}

@app.get("/api/workers", response_model=List[WorkerResponse])
async def get_workers():
    """Get all active workers"""
    return [WorkerResponse(**worker) for worker in active_workers.values()]

# Progress Updates API
@app.post("/api/jobs/{job_id}/progress")
async def update_job_progress(job_id: int, progress: JobProgress):
    """Update job progress"""
    await coordinator.handle_job_progress(progress)
    return {"status": "updated"}

# System Stats API
@app.get("/api/stats", response_model=SystemStats)
async def get_stats():
    """Get system statistics"""
    return await coordinator.get_system_stats()

# File Download API
@app.get("/api/jobs/{job_id}/download")
async def download_job_results(job_id: int, db: Session = Depends(get_db)):
    """Download job results as CSV"""
    job = db.query(ScrapeJob).filter(ScrapeJob.id == job_id).first()
    if not job or not job.result_file_path:
        raise HTTPException(status_code=404, detail="Results not found")
    
    if not os.path.exists(job.result_file_path):
        raise HTTPException(status_code=404, detail="Result file not found")
    
    return FileResponse(
        job.result_file_path,
        media_type='text/csv',
        filename=f"tiktok_scrape_{job.profile_username}_{job.id}.csv"
    )

if __name__ == "__main__":
    # Get host IP
    hostname = socket.gethostname()
    host_ip = socket.gethostbyname(hostname)
    
    print(f"🌟 TikTok Scraper Coordinator")
    print(f"🔗 Dashboard: http://{host_ip}:8000")
    print(f"🔗 API Docs: http://{host_ip}:8000/docs")
    print(f"💡 Workers can connect to: {host_ip}:8000")
    
    uvicorn.run(
        "coordinator:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info"
    ) 