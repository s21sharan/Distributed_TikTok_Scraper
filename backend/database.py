import os
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from databases import Database
from models import Base
import aioredis
from typing import AsyncGenerator

# Database URLs
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./tiktok_scraper.db")
ASYNC_DATABASE_URL = os.getenv("ASYNC_DATABASE_URL", "sqlite+aiosqlite:///./tiktok_scraper.db")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Create engines
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
async_engine = create_async_engine(ASYNC_DATABASE_URL)

# Create session makers
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
AsyncSessionLocal = sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Database instance for async operations
database = Database(ASYNC_DATABASE_URL)

# Redis connection
redis_client = None

async def get_redis():
    """Get Redis client instance"""
    global redis_client
    if redis_client is None:
        redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
    return redis_client

async def close_redis():
    """Close Redis connection"""
    global redis_client
    if redis_client:
        await redis_client.close()
        redis_client = None

# Database dependency
def get_db():
    """Get database session (sync)"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
    """Get async database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def init_db():
    """Initialize database tables"""
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def connect_db():
    """Connect to database"""
    await database.connect()

async def disconnect_db():
    """Disconnect from database"""
    await database.disconnect()

# Redis keys for coordination
REDIS_KEYS = {
    "workers": "tiktok_scraper:workers",
    "jobs_queue": "tiktok_scraper:jobs:queue",
    "jobs_processing": "tiktok_scraper:jobs:processing",
    "jobs_completed": "tiktok_scraper:jobs:completed",
    "worker_heartbeat": "tiktok_scraper:worker:heartbeat:",
    "job_progress": "tiktok_scraper:job:progress:",
    "system_stats": "tiktok_scraper:system:stats",
    "websocket_clients": "tiktok_scraper:websocket:clients"
}

class RedisManager:
    """Redis operations manager"""
    
    def __init__(self):
        self.redis = None
    
    async def init(self):
        """Initialize Redis connection"""
        self.redis = await get_redis()
    
    async def close(self):
        """Close Redis connection"""
        await close_redis()
    
    # Worker management
    async def register_worker(self, worker_id: str, worker_data: dict):
        """Register a new worker"""
        await self.redis.hset(REDIS_KEYS["workers"], worker_id, str(worker_data))
    
    async def unregister_worker(self, worker_id: str):
        """Unregister a worker"""
        await self.redis.hdel(REDIS_KEYS["workers"], worker_id)
    
    async def get_workers(self) -> dict:
        """Get all registered workers"""
        return await self.redis.hgetall(REDIS_KEYS["workers"])
    
    async def update_worker_heartbeat(self, worker_id: str, heartbeat_data: dict):
        """Update worker heartbeat"""
        key = f"{REDIS_KEYS['worker_heartbeat']}{worker_id}"
        await self.redis.setex(key, 30, str(heartbeat_data))  # 30 second TTL
    
    # Job queue management
    async def enqueue_job(self, job_data: dict):
        """Add job to queue"""
        await self.redis.lpush(REDIS_KEYS["jobs_queue"], str(job_data))
    
    async def dequeue_job(self) -> str:
        """Get next job from queue"""
        return await self.redis.rpop(REDIS_KEYS["jobs_queue"])
    
    async def get_queue_length(self) -> int:
        """Get number of jobs in queue"""
        return await self.redis.llen(REDIS_KEYS["jobs_queue"])
    
    async def mark_job_processing(self, job_id: int, worker_id: str):
        """Mark job as being processed"""
        await self.redis.hset(REDIS_KEYS["jobs_processing"], str(job_id), worker_id)
    
    async def mark_job_completed(self, job_id: int):
        """Mark job as completed"""
        await self.redis.hdel(REDIS_KEYS["jobs_processing"], str(job_id))
        await self.redis.sadd(REDIS_KEYS["jobs_completed"], str(job_id))
    
    # Progress tracking
    async def update_job_progress(self, job_id: int, progress_data: dict):
        """Update job progress"""
        key = f"{REDIS_KEYS['job_progress']}{job_id}"
        await self.redis.setex(key, 3600, str(progress_data))  # 1 hour TTL
    
    async def get_job_progress(self, job_id: int) -> str:
        """Get job progress"""
        key = f"{REDIS_KEYS['job_progress']}{job_id}"
        return await self.redis.get(key)
    
    # System statistics
    async def update_system_stats(self, stats: dict):
        """Update system statistics"""
        await self.redis.setex(REDIS_KEYS["system_stats"], 60, str(stats))  # 1 minute TTL
    
    async def get_system_stats(self) -> str:
        """Get system statistics"""
        return await self.redis.get(REDIS_KEYS["system_stats"])
    
    # WebSocket client management
    async def register_websocket_client(self, client_id: str):
        """Register WebSocket client"""
        await self.redis.sadd(REDIS_KEYS["websocket_clients"], client_id)
    
    async def unregister_websocket_client(self, client_id: str):
        """Unregister WebSocket client"""
        await self.redis.srem(REDIS_KEYS["websocket_clients"], client_id)
    
    async def get_websocket_clients(self) -> list:
        """Get all WebSocket clients"""
        return await self.redis.smembers(REDIS_KEYS["websocket_clients"])
    
    # Pub/Sub for real-time updates
    async def publish_update(self, channel: str, message: dict):
        """Publish real-time update"""
        await self.redis.publish(f"tiktok_scraper:{channel}", str(message))
    
    async def subscribe_to_updates(self, channels: list):
        """Subscribe to real-time updates"""
        pubsub = self.redis.pubsub()
        for channel in channels:
            await pubsub.subscribe(f"tiktok_scraper:{channel}")
        return pubsub

# Global Redis manager instance
redis_manager = RedisManager() 