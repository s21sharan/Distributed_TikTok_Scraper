import asyncio
import re
import random
import time
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException
from webdriver_manager.chrome import ChromeDriverManager
from typing import Callable, Optional, List, Dict, Any
import os
import socket
from models import VideoData, JobProgress, JobStatus

class AsyncTikTokScraper:
    """Asynchronous TikTok scraper for distributed workers"""
    
    def __init__(self, worker_id: str, progress_callback: Optional[Callable] = None):
        self.worker_id = worker_id
        self.progress_callback = progress_callback
        self.driver = None
        self.is_running = False
        self.current_job_id = None
        
    async def init_driver(self, headless: bool = True):
        """Initialize Chrome WebDriver"""
        try:
            chrome_options = Options()
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--disable-blink-features=AutomationControlled")
            chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
            chrome_options.add_experimental_option('useAutomationExtension', False)
            chrome_options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            
            if headless:
                chrome_options.add_argument("--headless")
            
            # Run in background thread to avoid blocking
            loop = asyncio.get_event_loop()
            service = Service(ChromeDriverManager().install())
            self.driver = await loop.run_in_executor(
                None, 
                lambda: webdriver.Chrome(service=service, options=chrome_options)
            )
            
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            return True
            
        except Exception as e:
            await self._log_error(f"Failed to initialize driver: {e}")
            return False
    
    async def close_driver(self):
        """Close WebDriver"""
        if self.driver:
            try:
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, self.driver.quit)
            except:
                pass
            finally:
                self.driver = None
    
    def validate_tiktok_url(self, url: str) -> bool:
        """Validate TikTok URL"""
        patterns = [
            r'https?://(?:www\.)?tiktok\.com/@[\w.-]+/video/\d+',
            r'https?://(?:www\.)?tiktok\.com/t/\w+',
            r'https?://vm\.tiktok\.com/\w+',
            r'https?://(?:www\.)?tiktok\.com/@[\w.-]+',
        ]
        return any(re.match(pattern, url.strip()) for pattern in patterns)
    
    def get_profile_username(self, url: str) -> str:
        """Extract username from TikTok URL"""
        try:
            if '/@' in url:
                return url.split('/@')[1].split('/')[0].split('?')[0]
            else:
                return f"profile_{datetime.now().strftime('%H%M%S')}"
        except:
            return f"profile_{datetime.now().strftime('%H%M%S')}"
    
    def parse_count(self, count_str: str) -> int:
        """Parse TikTok count strings like '142.5K' to integers"""
        if not count_str:
            return 0
        
        count_str = count_str.strip().upper()
        clean_str = re.sub(r'[^0-9KMB.]', '', count_str)
        
        try:
            if 'K' in clean_str:
                return int(float(clean_str.replace('K', '')) * 1000)
            elif 'M' in clean_str:
                return int(float(clean_str.replace('M', '')) * 1000000)
            elif 'B' in clean_str:
                return int(float(clean_str.replace('B', '')) * 1000000000)
            else:
                return int(float(clean_str))
        except:
            return 0
    
    async def random_delay(self, min_seconds: float = 1, max_seconds: float = 3):
        """Async random delay"""
        delay = random.uniform(min_seconds, max_seconds)
        await asyncio.sleep(delay)
        return delay
    
    async def _log_error(self, message: str):
        """Log error message"""
        print(f"[Worker {self.worker_id}] ERROR: {message}")
    
    async def _log_info(self, message: str):
        """Log info message"""
        print(f"[Worker {self.worker_id}] INFO: {message}")
    
    async def _update_progress(self, job_id: int, total_videos: int, processed_videos: int, 
                             current_video_url: Optional[str] = None, status: JobStatus = JobStatus.RUNNING,
                             message: Optional[str] = None):
        """Update job progress"""
        if self.progress_callback:
            progress = JobProgress(
                job_id=job_id,
                worker_id=self.worker_id,
                total_videos=total_videos,
                processed_videos=processed_videos,
                failed_videos=0,  # Could track this separately
                current_video_url=current_video_url,
                status=status,
                message=message
            )
            await self.progress_callback(progress)
    
    async def auto_scroll_and_load_videos(self) -> List:
        """Aggressive auto-scroll to load all videos"""
        await self._log_info("Starting aggressive auto-scroll...")
        
        videos_found = 0
        scroll_attempts = 0
        no_new_videos_count = 0
        no_height_change_count = 0
        max_no_change_attempts = 8
        max_no_videos_attempts = 6
        
        loop = asyncio.get_event_loop()
        
        # Get initial page height
        last_height = await loop.run_in_executor(
            None, 
            lambda: self.driver.execute_script("return document.body.scrollHeight")
        )
        
        while True:
            scroll_attempts += 1
            
            # Multiple scrolling techniques
            await loop.run_in_executor(
                None,
                lambda: self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            )
            await asyncio.sleep(0.4)
            
            await loop.run_in_executor(
                None,
                lambda: self.driver.execute_script("window.scrollBy(0, window.innerHeight);")
            )
            await asyncio.sleep(0.2)
            
            await loop.run_in_executor(
                None,
                lambda: self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight + 800);")
            )
            
            # Wait for content to load
            if scroll_attempts % 4 == 0:
                await self.random_delay(2, 4)
            else:
                await self.random_delay(1, 2.5)
            
            # Check for videos using multiple selectors
            video_selectors = [
                'a[href*="/video/"]',
                'a.css-1mdo0pl-AVideoContainer', 
                '[data-e2e="user-post-item"]',
                'div[data-e2e="user-post-item-wrapper"]',
                '.video-feed-item-wrapper'
            ]
            
            current_videos = []
            for selector in video_selectors:
                try:
                    found_videos = await loop.run_in_executor(
                        None,
                        lambda s=selector: self.driver.find_elements(By.CSS_SELECTOR, s)
                    )
                    if len(found_videos) > len(current_videos):
                        current_videos = found_videos
                except:
                    continue
            
            current_count = len(current_videos)
            
            if current_count > videos_found:
                new_videos = current_count - videos_found
                await self._log_info(f"Found {new_videos} NEW videos! Total: {current_count}")
                videos_found = current_count
                no_new_videos_count = 0
            else:
                no_new_videos_count += 1
            
            # Check page height change
            new_height = await loop.run_in_executor(
                None,
                lambda: self.driver.execute_script("return document.body.scrollHeight")
            )
            
            if new_height == last_height:
                no_height_change_count += 1
            else:
                last_height = new_height
                no_height_change_count = 0
            
            # Stop conditions
            if no_new_videos_count >= max_no_videos_attempts and no_height_change_count >= max_no_change_attempts:
                await self._log_info(f"Auto-scroll complete! Found {videos_found} videos in {scroll_attempts} scrolls")
                break
            
            # Emergency brake
            if scroll_attempts > 200:
                await self._log_info(f"Emergency brake at {scroll_attempts} scrolls")
                break
            
            # Scroll up/down technique occasionally
            if scroll_attempts % 8 == 0:
                await loop.run_in_executor(
                    None,
                    lambda: self.driver.execute_script("window.scrollBy(0, -400);")
                )
                await asyncio.sleep(0.3)
                await loop.run_in_executor(
                    None,
                    lambda: self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                )
                await asyncio.sleep(0.8)
        
        # Final comprehensive check
        final_videos = []
        all_selectors = [
            'a[href*="/video/"]',
            'a.css-1mdo0pl-AVideoContainer',
            '[data-e2e="user-post-item"]',
            'div[data-e2e="user-post-item-wrapper"]',
            '.video-feed-item-wrapper',
            'div[data-e2e="user-post-item-list"] > div',
            '.tiktok-video-item'
        ]
        
        for selector in all_selectors:
            try:
                found_videos = await loop.run_in_executor(
                    None,
                    lambda s=selector: self.driver.find_elements(By.CSS_SELECTOR, s)
                )
                if len(found_videos) > len(final_videos):
                    final_videos = found_videos
            except:
                continue
        
        return final_videos
    
    async def scrape_video_metrics(self, video_container) -> Optional[VideoData]:
        """Scrape metrics from a single video"""
        loop = asyncio.get_event_loop()
        
        try:
            # Extract view count from profile page
            view_count = "0"
            try:
                view_element = await loop.run_in_executor(
                    None,
                    lambda: video_container.find_element(By.CSS_SELECTOR, 'strong[data-e2e="video-views"]')
                )
                view_count = view_element.text
            except:
                pass
            
            # Click video to open detailed view
            await self.random_delay(0.5, 1.5)
            await loop.run_in_executor(
                None,
                lambda: self.driver.execute_script("arguments[0].click();", video_container)
            )
            
            # Wait for video page to load
            await self.random_delay(2.5, 4.5)
            
            # Extract metrics using TikTok's selectors
            likes = "0"
            bookmarks = "0"
            comments = "0"
            
            # Get likes
            try:
                like_element = await loop.run_in_executor(
                    None,
                    lambda: self.driver.find_element(By.CSS_SELECTOR, 'strong[data-e2e="browse-like-count"]')
                )
                likes = like_element.text.strip()
            except:
                pass
            
            # Get bookmarks
            try:
                bookmark_element = await loop.run_in_executor(
                    None,
                    lambda: self.driver.find_element(By.CSS_SELECTOR, 'strong[data-e2e="undefined-count"]')
                )
                bookmarks = bookmark_element.text.strip()
            except:
                pass
            
            # Get comments
            try:
                comment_element = await loop.run_in_executor(
                    None,
                    lambda: self.driver.find_element(By.CSS_SELECTOR, 'strong[data-e2e="browse-comment-count"]')
                )
                comments = comment_element.text.strip()
            except:
                pass
            
            # Get video URL
            current_url = await loop.run_in_executor(
                None,
                lambda: self.driver.current_url
            )
            
            # Go back to profile
            await loop.run_in_executor(None, lambda: self.driver.back())
            await self.random_delay(1.5, 3)
            
            return VideoData(
                video_url=current_url,
                views=self.parse_count(view_count),
                likes=self.parse_count(likes),
                bookmarks=self.parse_count(bookmarks),
                comments=self.parse_count(comments),
                raw_data={
                    "views_raw": view_count,
                    "likes_raw": likes,
                    "bookmarks_raw": bookmarks,
                    "comments_raw": comments
                }
            )
            
        except Exception as e:
            await self._log_error(f"Error scraping video: {e}")
            try:
                await loop.run_in_executor(None, lambda: self.driver.back())
                await self.random_delay(1, 2)
            except:
                pass
            return None
    
    async def scrape_profile(self, job_id: int, url: str) -> List[VideoData]:
        """Scrape TikTok profile videos"""
        self.current_job_id = job_id
        self.is_running = True
        
        await self._log_info(f"Starting profile scrape: {url}")
        await self._update_progress(job_id, 0, 0, None, JobStatus.RUNNING, "Initializing...")
        
        video_data = []
        loop = asyncio.get_event_loop()
        
        try:
            if not self.driver:
                if not await self.init_driver():
                    raise Exception("Failed to initialize driver")
            
            # Navigate to profile
            await self._update_progress(job_id, 0, 0, None, JobStatus.RUNNING, "Loading profile...")
            await loop.run_in_executor(None, lambda: self.driver.get(url))
            await self.random_delay(2, 4)
            
            # Auto-scroll to load all videos
            await self._update_progress(job_id, 0, 0, None, JobStatus.RUNNING, "Loading all videos...")
            video_containers = await self.auto_scroll_and_load_videos()
            
            total_videos = len(video_containers)
            if total_videos == 0:
                await self._log_info("No videos found on profile")
                return video_data
            
            await self._log_info(f"Found {total_videos} videos to scrape")
            await self._update_progress(job_id, total_videos, 0, None, JobStatus.RUNNING, f"Starting to scrape {total_videos} videos...")
            
            # Scrape each video
            for i, video_container in enumerate(video_containers):
                if not self.is_running:  # Check if job was cancelled
                    break
                
                await self._update_progress(
                    job_id, total_videos, i, None, JobStatus.RUNNING, 
                    f"Processing video {i+1}/{total_videos}..."
                )
                
                video_info = await self.scrape_video_metrics(video_container)
                if video_info:
                    video_data.append(video_info)
                    await self._update_progress(
                        job_id, total_videos, i+1, video_info.video_url, JobStatus.RUNNING,
                        f"Scraped video {i+1}/{total_videos}"
                    )
                
                # Add delay between videos
                if i < total_videos - 1:
                    await self.random_delay(1, 3)
            
            await self._update_progress(
                job_id, total_videos, len(video_data), None, JobStatus.COMPLETED,
                f"Completed! Scraped {len(video_data)}/{total_videos} videos"
            )
            
            await self._log_info(f"Scraping completed! {len(video_data)}/{total_videos} videos scraped")
            
        except Exception as e:
            await self._log_error(f"Error during profile scrape: {e}")
            await self._update_progress(
                job_id, 0, 0, None, JobStatus.FAILED, f"Error: {str(e)}"
            )
        
        finally:
            self.is_running = False
            self.current_job_id = None
        
        return video_data
    
    async def cancel_job(self):
        """Cancel current scraping job"""
        self.is_running = False
        await self._log_info("Job cancellation requested")
    
    def get_capabilities(self) -> Dict[str, Any]:
        """Get worker capabilities"""
        hostname = socket.gethostname()
        return {
            "browser": "Chrome",
            "headless": True,
            "max_concurrent_jobs": 1,
            "supported_platforms": ["tiktok.com"],
            "features": ["auto_scroll", "aggressive_loading", "real_time_progress"],
            "hostname": hostname,
            "selenium_version": "4.15.2"
        } 