from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, Float, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum

Base = declarative_base()

class JobStatus(str, Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class WorkerStatus(str, Enum):
    CONNECTING = "connecting"
    IDLE = "idle"
    BUSY = "busy"
    OFFLINE = "offline"
    ERROR = "error"

# Database Models
class ScrapeJob(Base):
    __tablename__ = "scrape_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, nullable=False)
    profile_username = Column(String, nullable=True)
    status = Column(String, default=JobStatus.PENDING)
    assigned_worker_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    total_videos = Column(Integer, default=0)
    processed_videos = Column(Integer, default=0)
    failed_videos = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    result_file_path = Column(String, nullable=True)
    
    # Relationship
    videos = relationship("ScrapedVideo", back_populates="job")

class ScrapedVideo(Base):
    __tablename__ = "scraped_videos"
    
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("scrape_jobs.id"))
    video_url = Column(String, nullable=False)
    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    bookmarks = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    scraped_at = Column(DateTime, default=datetime.utcnow)
    raw_data = Column(JSON, nullable=True)
    
    # Relationship
    job = relationship("ScrapeJob", back_populates="videos")

class Worker(Base):
    __tablename__ = "workers"
    
    id = Column(String, primary_key=True)  # UUID
    hostname = Column(String, nullable=False)
    ip_address = Column(String, nullable=False)
    port = Column(Integer, nullable=False)
    status = Column(String, default=WorkerStatus.CONNECTING)
    last_heartbeat = Column(DateTime, default=datetime.utcnow)
    connected_at = Column(DateTime, default=datetime.utcnow)
    current_job_id = Column(Integer, nullable=True)
    total_jobs_completed = Column(Integer, default=0)
    total_videos_scraped = Column(Integer, default=0)
    capabilities = Column(JSON, nullable=True)  # Browser support, etc.

# Pydantic Models for API
class JobCreate(BaseModel):
    url: str
    profile_username: Optional[str] = None

class JobResponse(BaseModel):
    id: int
    url: str
    profile_username: Optional[str]
    status: JobStatus
    assigned_worker_id: Optional[str]
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    total_videos: int
    processed_videos: int
    failed_videos: int
    error_message: Optional[str]
    result_file_path: Optional[str]
    
    class Config:
        from_attributes = True

class VideoResponse(BaseModel):
    id: int
    job_id: int
    video_url: str
    views: int
    likes: int
    bookmarks: int
    comments: int
    scraped_at: datetime
    
    class Config:
        from_attributes = True

class WorkerResponse(BaseModel):
    id: str
    hostname: str
    ip_address: str
    port: int
    status: WorkerStatus
    last_heartbeat: datetime
    connected_at: datetime
    current_job_id: Optional[int]
    total_jobs_completed: int
    total_videos_scraped: int
    capabilities: Optional[Dict[str, Any]]
    
    class Config:
        from_attributes = True

class WorkerRegister(BaseModel):
    hostname: str
    ip_address: str
    port: int
    capabilities: Optional[Dict[str, Any]] = None

class WorkerHeartbeat(BaseModel):
    worker_id: str
    status: WorkerStatus
    current_job_id: Optional[int] = None
    last_activity: Optional[str] = None

class JobProgress(BaseModel):
    job_id: int
    worker_id: str
    total_videos: int
    processed_videos: int
    failed_videos: int
    current_video_url: Optional[str] = None
    status: JobStatus
    message: Optional[str] = None

class VideoData(BaseModel):
    video_url: str
    views: int
    likes: int
    bookmarks: int
    comments: int
    raw_data: Optional[Dict[str, Any]] = None

class JobAssignment(BaseModel):
    job_id: int
    url: str
    profile_username: Optional[str]
    assigned_at: datetime

class SystemStats(BaseModel):
    total_workers: int
    active_workers: int
    idle_workers: int
    busy_workers: int
    offline_workers: int
    total_jobs: int
    pending_jobs: int
    running_jobs: int
    completed_jobs: int
    failed_jobs: int
    total_videos_scraped: int

# WebSocket Message Types
class WSMessageType(str, Enum):
    WORKER_CONNECTED = "worker_connected"
    WORKER_DISCONNECTED = "worker_disconnected"
    WORKER_STATUS_UPDATE = "worker_status_update"
    JOB_CREATED = "job_created"
    JOB_ASSIGNED = "job_assigned"
    JOB_PROGRESS = "job_progress"
    JOB_COMPLETED = "job_completed"
    JOB_FAILED = "job_failed"
    VIDEO_SCRAPED = "video_scraped"
    SYSTEM_STATS = "system_stats"
    ERROR = "error"

class WSMessage(BaseModel):
    type: WSMessageType
    data: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)

# Real-time Dashboard Data
class DashboardData(BaseModel):
    system_stats: SystemStats
    workers: List[WorkerResponse]
    active_jobs: List[JobResponse]
    recent_videos: List[VideoResponse]
    logs: List[str] 