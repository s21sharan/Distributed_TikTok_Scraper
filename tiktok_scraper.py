#!/usr/bin/env python3
"""
TikTok Scraper - Enhanced with Selenium
A TikTok scraper that extracts video metrics and saves to CSV.
"""

import re
import sys
import csv
import time
import random
import threading
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException
from webdriver_manager.chrome import ChromeDriverManager
import os

# Configuration
MAX_VIDEOS_TO_SCRAPE = None  # Set to None for all videos, or a number like 50 to limit

def random_delay(min_seconds=1, max_seconds=3):
    """
    Generate a random delay to make scraping more human-like.
    
    Args:
        min_seconds (float): Minimum delay in seconds
        max_seconds (float): Maximum delay in seconds
    """
    delay = random.uniform(min_seconds, max_seconds)
    time.sleep(delay)
    return delay

def validate_tiktok_url(url):
    """
    Validate if the provided URL is a valid TikTok URL.
    
    Args:
        url (str): The URL to validate
        
    Returns:
        bool: True if valid TikTok URL, False otherwise
    """
    # TikTok URL patterns
    tiktok_patterns = [
        r'https?://(?:www\.)?tiktok\.com/@[\w.-]+/video/\d+',  # Standard video URL
        r'https?://(?:www\.)?tiktok\.com/t/\w+',              # Short URL
        r'https?://vm\.tiktok\.com/\w+',                      # Mobile short URL
        r'https?://(?:www\.)?tiktok\.com/@[\w.-]+',           # Profile URL
    ]
    
    return any(re.match(pattern, url.strip()) for pattern in tiktok_patterns)

def get_tiktok_urls():
    """
    Get multiple TikTok URLs from user input with validation.
    
    Returns:
        list: List of valid TikTok URLs
    """
    print("🎵 TikTok Scraper - Queue System")
    print("=" * 50)
    print("📋 Enter multiple TikTok URLs to scrape in batch:")
    print("Supported formats:")
    print("  • https://www.tiktok.com/@username")
    print("  • https://www.tiktok.com/@username/video/1234567890")
    print("  • https://tiktok.com/t/shortcode")
    print("  • https://vm.tiktok.com/shortcode")
    print()
    print("📝 Instructions:")
    print("  • Enter one URL per line")
    print("  • Type 'done' when finished adding URLs")
    print("  • Type 'clear' to clear all URLs and start over")
    print("  • Type 'exit' to quit")
    print()
    
    url_queue = []
    
    while True:
        try:
            if url_queue:
                print(f"\n📊 Current queue ({len(url_queue)} URLs):")
                for i, url in enumerate(url_queue, 1):
                    print(f"   {i}. {url}")
                print()
            
            url = input(f"Enter TikTok URL #{len(url_queue) + 1} (or 'done'/'clear'/'exit'): ").strip()
            
            # Check commands
            if url.lower() in ['exit', 'quit', 'q']:
                print("👋 Goodbye!")
                sys.exit(0)
            elif url.lower() == 'done':
                if url_queue:
                    print(f"\n✅ Queue complete! {len(url_queue)} URLs ready for processing.")
                    return url_queue
                else:
                    print("❌ No URLs in queue. Please add at least one URL.")
                    continue
            elif url.lower() == 'clear':
                url_queue.clear()
                print("🗑️  Queue cleared.")
                continue
            elif not url:
                print("❌ Please enter a URL or type 'done' to finish.")
                continue
            
            # Validate TikTok URL
            if validate_tiktok_url(url):
                # Check for duplicates
                if url in url_queue:
                    print(f"⚠️  URL already in queue: {url}")
                    continue
                
                url_queue.append(url)
                print(f"✅ Added to queue: {url}")
            else:
                print("❌ Invalid TikTok URL. Please enter a valid TikTok URL.")
                print("   Example: https://www.tiktok.com/@username")
                continue
                
        except KeyboardInterrupt:
            print("\n👋 Goodbye!")
            sys.exit(0)
        except Exception as e:
            print(f"❌ Error: {e}")
            continue

def get_profile_username(url):
    """
    Extract username from TikTok profile URL for file naming.
    
    Args:
        url (str): TikTok profile URL
        
    Returns:
        str: Username or fallback identifier
    """
    try:
        # Extract username from various URL formats
        if '/@' in url:
            username = url.split('/@')[1].split('/')[0].split('?')[0]
            return username
        else:
            # For short URLs, use a timestamp-based identifier
            from datetime import datetime
            return f"profile_{datetime.now().strftime('%H%M%S')}"
    except:
        from datetime import datetime
        return f"profile_{datetime.now().strftime('%H%M%S')}"

def parse_count(count_str):
    """
    Parse TikTok count strings like '142.5K', '1.2M' to integers.
    
    Args:
        count_str (str): Count string from TikTok
        
    Returns:
        int: Parsed count as integer
    """
    if not count_str:
        return 0
    
    count_str = count_str.strip().upper()
    
    # Remove any non-numeric characters except K, M, B and decimal points
    import re
    clean_str = re.sub(r'[^0-9KMB.]', '', count_str)
    
    if 'K' in clean_str:
        return int(float(clean_str.replace('K', '')) * 1000)
    elif 'M' in clean_str:
        return int(float(clean_str.replace('M', '')) * 1000000)
    elif 'B' in clean_str:
        return int(float(clean_str.replace('B', '')) * 1000000000)
    else:
        try:
            return int(float(clean_str))
        except:
            return 0

def auto_scroll_and_load_videos(driver):
    """
    Auto-scroll down the page to load all videos using infinite scroll.
    
    Args:
        driver: Selenium WebDriver instance
        
    Returns:
        list: List of video container elements found
    """
    print("🔄 Starting auto-scroll to load all videos...")
    
    # Get initial page height
    last_height = driver.execute_script("return document.body.scrollHeight")
    videos_found = 0
    scroll_attempts = 0
    max_scroll_attempts = 50  # Prevent infinite scrolling
    
    while scroll_attempts < max_scroll_attempts:
        # Scroll down to bottom
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        
        # Wait for new content to load
        scroll_delay = random_delay(2, 4)
        print(f"   📜 Scroll {scroll_attempts + 1}: waiting {scroll_delay:.1f}s for content...")
        
        # Check how many videos we have now
        try:
            current_videos = driver.find_elements(By.CSS_SELECTOR, 'a[href*="/video/"]')
            if not current_videos:
                current_videos = driver.find_elements(By.CSS_SELECTOR, 'a.css-1mdo0pl-AVideoContainer')
            
            current_count = len(current_videos)
            
            if current_count > videos_found:
                print(f"   ✅ Found {current_count - videos_found} new videos (total: {current_count})")
                videos_found = current_count
            else:
                print(f"   ⏸️  No new videos found (still {current_count} total)")
        except:
            current_videos = []
            current_count = 0
        
        # Calculate new scroll height and compare with last scroll height
        new_height = driver.execute_script("return document.body.scrollHeight")
        
        if new_height == last_height:
            # No new content loaded, try a few more times
            if scroll_attempts >= 3:
                print(f"   🏁 Reached end of content after {scroll_attempts + 1} scrolls")
                break
        else:
            last_height = new_height
        
        scroll_attempts += 1
        
        # Safety check - if we have a lot of videos, we might want to stop
        if videos_found > 1000:
            print(f"   🛑 Stopping auto-scroll at {videos_found} videos (safety limit)")
            break
    
    # Final count and return
    final_videos = driver.find_elements(By.CSS_SELECTOR, 'a[href*="/video/"]')
    if not final_videos:
        final_videos = driver.find_elements(By.CSS_SELECTOR, 'a.css-1mdo0pl-AVideoContainer')
    
    final_count = len(final_videos)
    print(f"🎯 Auto-scroll complete! Found {final_count} total videos after {scroll_attempts} scrolls")
    
    return final_videos

def scrape_tiktok_profile(url):
    """
    Scrape TikTok profile videos using Selenium.
    
    Args:
        url (str): TikTok profile URL
        
    Returns:
        list: List of video data dictionaries
    """
    print(f"\n🚀 Starting TikTok profile scraping...")
    print(f"📱 Profile URL: {url}")
    
    video_data = []
    driver = None
    
    try:
        # Setup Chrome options
        print("🌐 Launching browser...")
        chrome_options = Options()
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        chrome_options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
        
        # Uncomment the next line for headless mode
        # chrome_options.add_argument("--headless")
        
        # Initialize WebDriver with automatic ChromeDriver management
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        wait = WebDriverWait(driver, 10)
        
        # Navigate to the profile page
        print(f"📄 Navigating to profile...")
        driver.get(url)
        delay = random_delay(2, 4)  # Random delay for page load
        print(f"   ⏱️  Waited {delay:.1f}s for page to load")
        
        # Manual navigation phase
        print("\n" + "="*60)
        print("🛠️  MANUAL NAVIGATION PHASE")
        print("="*60)
        print("📋 Please perform the following steps manually:")
        print("   1. 📅 Click on 'Oldest' to sort videos chronologically")
        print("   2. 🔄 Wait for the page to fully load")
        print("   3. 📱 Scroll down if needed to see more videos")
        print("   4. ✅ Verify you can see the video thumbnails")
        print("\n💡 The browser window is open - you can interact with it now!")
        print("🚀 Once you're ready, press ENTER to start automated scraping...")
        
        # Wait for user input
        try:
            input()  # This will pause execution until user presses Enter
        except KeyboardInterrupt:
            print("\n👋 Scraping cancelled by user")
            return video_data
        
        print("\n🤖 Starting automated scraping phase...")
        delay = random_delay(1.5, 3)  # Random delay before starting
        print(f"   ⏱️  Waited {delay:.1f}s before starting automation")
        
        # Auto-scroll to load all videos
        print("📜 Auto-scrolling to load all videos...")
        video_containers = auto_scroll_and_load_videos(driver)
        
        if not video_containers:
            print("🔍 Auto-scroll didn't find videos, trying manual search...")
            try:
                # Try TikTok's actual video link selectors
                video_containers = driver.find_elements(By.CSS_SELECTOR, 'a[href*="/video/"]')
                print(f"   ✅ Found video links: {len(video_containers)}")
            except:
                pass
            
            if not video_containers:
                try:
                    # Try the specific video container class from TikTok
                    video_containers = driver.find_elements(By.CSS_SELECTOR, 'a.css-1mdo0pl-AVideoContainer')
                    print(f"   ✅ Found video containers by class: {len(video_containers)}")
                except:
                    pass
            
            if not video_containers:
                try:
                    # Fallback to generic video containers
                    video_containers = driver.find_elements(By.CSS_SELECTOR, '[data-e2e="user-post-item"]')
                    print(f"   ✅ Found generic containers: {len(video_containers)}")
                except:
                    pass
        
        video_count = len(video_containers)
        print(f"📹 Found {video_count} videos to scrape")
        
        if video_count == 0:
            print("❌ No videos found on this profile")
            print("💡 Try scrolling down manually or check if the profile has videos")
            return video_data
        
        # Determine how many videos to scrape
        videos_to_scrape = video_count if MAX_VIDEOS_TO_SCRAPE is None else min(video_count, MAX_VIDEOS_TO_SCRAPE)
        
        if MAX_VIDEOS_TO_SCRAPE is None:
            print(f"🎯 Will scrape all {videos_to_scrape} videos found")
        else:
            print(f"🎯 Will scrape {videos_to_scrape} videos (limited by MAX_VIDEOS_TO_SCRAPE = {MAX_VIDEOS_TO_SCRAPE})")
        
        for i in range(videos_to_scrape):
            try:
                # Add a random delay between videos (except for the first one)
                if i > 0:
                    between_videos_delay = random_delay(1, 3)
                    print(f"   ⏱️  Inter-video delay: {between_videos_delay:.1f}s")
                
                print(f"\n📹 Processing video {i + 1}/{videos_to_scrape}...")
                
                # Re-find video containers (they might change after navigation)
                try:
                    video_containers = driver.find_elements(By.CSS_SELECTOR, 'a[href*="/video/"]')
                    if not video_containers:
                        video_containers = driver.find_elements(By.CSS_SELECTOR, 'a.css-1mdo0pl-AVideoContainer')
                    if not video_containers:
                        video_containers = driver.find_elements(By.CSS_SELECTOR, '[data-e2e="user-post-item"]')
                except:
                    print(f"❌ Could not find video containers after navigation")
                    break
                
                if i >= len(video_containers):
                    print(f"❌ Video {i + 1} not found in updated container list")
                    break
                
                video_container = video_containers[i]
                
                # Extract view count from the profile page using TikTok's actual selector
                view_count = "0"
                try:
                    # Use TikTok's exact selector for video views
                    view_element = video_container.find_element(By.CSS_SELECTOR, 'strong[data-e2e="video-views"]')
                    view_count = view_element.text
                    print(f"   ✅ Found profile view count: {view_count}")
                except:
                    try:
                        # Alternative selector with class
                        view_element = video_container.find_element(By.CSS_SELECTOR, 'strong.video-count')
                        view_count = view_element.text
                        print(f"   ✅ Found profile view count (alt): {view_count}")
                    except:
                        print(f"   ⚠️  No view count found on profile page")
                        pass
                
                # Click on the video to open detailed view
                click_delay = random_delay(0.5, 1.5)  # Random delay before click
                print(f"   ⏱️  Pre-click delay: {click_delay:.1f}s")
                
                driver.execute_script("arguments[0].click();", video_container)
                
                # Random delay for video page to load
                load_delay = random_delay(2.5, 4.5)  # Longer delay for video loading
                print(f"   ⏱️  Video load delay: {load_delay:.1f}s")
                
                # Extract detailed metrics from the video page
                likes = "0"
                bookmarks = "0" 
                comments = "0"
                
                print(f"   🔍 Extracting metrics from video page...")
                
                # Use TikTok's exact selectors for individual video page metrics
                # These selectors are based on the actual TikTok HTML structure
                
                # Extract likes using TikTok's browse-like-count selector
                try:
                    like_element = driver.find_element(By.CSS_SELECTOR, 'strong[data-e2e="browse-like-count"]')
                    likes = like_element.text.strip()
                    print(f"   ✅ Found likes: {likes} (TikTok selector: browse-like-count)")
                except:
                    print(f"   ⚠️  No likes found with TikTok selector")
                
                # Extract bookmarks using TikTok's undefined-count selector 
                # Note: TikTok actually uses "undefined-count" for bookmarks/saves - this is their internal naming!
                try:
                    bookmark_element = driver.find_element(By.CSS_SELECTOR, 'strong[data-e2e="undefined-count"]')
                    bookmarks = bookmark_element.text.strip()
                    print(f"   ✅ Found bookmarks: {bookmarks} (TikTok selector: undefined-count)")
                except:
                    print(f"   ⚠️  No bookmarks found with TikTok selector")
                
                # Extract comments using TikTok's browse-comment-count selector
                try:
                    comment_element = driver.find_element(By.CSS_SELECTOR, 'strong[data-e2e="browse-comment-count"]')
                    comments = comment_element.text.strip()
                    print(f"   ✅ Found comments: {comments} (TikTok selector: browse-comment-count)")
                except:
                    print(f"   ⚠️  No comments found with TikTok selector")
                
                # Try to get view count from individual video page if we didn't get it from profile
                if view_count == "0":
                    try:
                        # Try to find view count on the individual video page
                        view_element = driver.find_element(By.CSS_SELECTOR, 'strong[data-e2e="video-views"]')
                        view_count = view_element.text.strip()
                        print(f"   ✅ Found views on video page: {view_count}")
                    except:
                        print(f"   ⚠️  No view count found on video page either")
                
                # If any metrics are still missing, try fallback selectors (but TikTok's selectors should work)
                if likes == "0" or comments == "0" or bookmarks == "0":
                    print(f"   🔄 Some metrics missing, trying fallback selectors...")
                    
                    if likes == "0":
                        try:
                            # Fallback like selectors
                            fallback_like = driver.find_element(By.CSS_SELECTOR, 'strong[data-e2e*="like"]')
                            likes = fallback_like.text.strip()
                            print(f"   ✅ Found likes (fallback): {likes}")
                        except:
                            pass
                    
                    if comments == "0":
                        try:
                            # Fallback comment selectors
                            fallback_comment = driver.find_element(By.CSS_SELECTOR, 'strong[data-e2e*="comment"]')
                            comments = fallback_comment.text.strip()
                            print(f"   ✅ Found comments (fallback): {comments}")
                        except:
                            pass
                    
                    if bookmarks == "0":
                        try:
                            # Fallback bookmark selectors
                            fallback_bookmark = driver.find_element(By.CSS_SELECTOR, 'strong[data-e2e*="bookmark"], strong[data-e2e*="collect"], strong[data-e2e*="save"]')
                            bookmarks = fallback_bookmark.text.strip()
                            print(f"   ✅ Found bookmarks (fallback): {bookmarks}")
                        except:
                            pass
                
                # Get video URL
                current_url = driver.current_url
                
                # Parse the counts
                parsed_views = parse_count(view_count)
                parsed_likes = parse_count(likes)
                parsed_bookmarks = parse_count(bookmarks)
                parsed_comments = parse_count(comments)
                
                video_info = {
                    'video_url': current_url,
                    'views': parsed_views,
                    'likes': parsed_likes,
                    'bookmarks': parsed_bookmarks,
                    'comments': parsed_comments,
                    'views_raw': view_count,
                    'likes_raw': likes,
                    'bookmarks_raw': bookmarks,
                    'comments_raw': comments,
                    'scraped_at': datetime.now().isoformat()
                }
                
                video_data.append(video_info)
                
                print(f"   👁️  Views: {view_count} ({parsed_views:,})")
                print(f"   ❤️  Likes: {likes} ({parsed_likes:,})")
                print(f"   🔖 Bookmarks: {bookmarks} ({parsed_bookmarks:,})")
                print(f"   💬 Comments: {comments} ({parsed_comments:,})")
                
                # Go back to profile
                driver.back()
                back_delay = random_delay(1.5, 3)  # Random delay after going back
                print(f"   ⏱️  Back navigation delay: {back_delay:.1f}s")
                
            except Exception as e:
                print(f"❌ Error processing video {i + 1}: {e}")
                try:
                    driver.back()
                    error_delay = random_delay(1, 2)  # Random delay after error
                    print(f"   ⏱️  Error recovery delay: {error_delay:.1f}s")
                except:
                    pass
                continue
        
    except Exception as e:
        print(f"❌ Error during scraping: {e}")
    
    finally:
        if driver:
            print("🔒 Closing browser...")
            driver.quit()
    
    return video_data

def save_to_csv(video_data, username, filename=None):
    """
    Save video data to CSV file.
    
    Args:
        video_data (list): List of video data dictionaries
        username (str): Profile username for filename
        filename (str): Optional filename, defaults to username-based name
    """
    if not video_data:
        print("❌ No data to save")
        return None
    
    if not filename:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"tiktok_{username}_{timestamp}.csv"
    
    print(f"\n💾 Saving data to {filename}...")
    
    # Ensure data directory exists
    os.makedirs('data', exist_ok=True)
    filepath = os.path.join('data', filename)
    
    with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['profile_username', 'video_url', 'views', 'likes', 'bookmarks', 'comments', 
                     'views_raw', 'likes_raw', 'bookmarks_raw', 'comments_raw', 'scraped_at']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        writer.writeheader()
        for video in video_data:
            # Add profile username to each row
            video['profile_username'] = username
            writer.writerow(video)
    
    print(f"✅ Saved {len(video_data)} videos to {filepath}")
    
    # Print summary
    total_views = sum(video['views'] for video in video_data)
    total_likes = sum(video['likes'] for video in video_data)
    total_bookmarks = sum(video['bookmarks'] for video in video_data)
    total_comments = sum(video['comments'] for video in video_data)
    
    print(f"\n📊 Profile Summary for @{username}:")
    print(f"   📹 Videos scraped: {len(video_data)}")
    print(f"   👁️  Total views: {total_views:,}")
    print(f"   ❤️  Total likes: {total_likes:,}")
    print(f"   🔖 Total bookmarks: {total_bookmarks:,}")
    print(f"   💬 Total comments: {total_comments:,}")
    
    return filepath

def process_url_queue(url_queue):
    """
    Process a queue of TikTok URLs in batches of 2 at a time.
    
    Args:
        url_queue (list): List of TikTok profile URLs to process
    """
    if not url_queue:
        print("❌ No URLs to process")
        return
    
    BATCH_SIZE = 2
    total_urls = len(url_queue)
    num_batches = (total_urls + BATCH_SIZE - 1) // BATCH_SIZE  # Ceiling division
    all_results = []
    
    print(f"\n🚀 Starting batch processing of {total_urls} profiles...")
    print(f"📦 Processing in batches of {BATCH_SIZE} profiles each ({num_batches} batches total)")
    print("=" * 70)
    
    # Split URLs into batches
    for batch_num in range(num_batches):
        start_idx = batch_num * BATCH_SIZE
        end_idx = min(start_idx + BATCH_SIZE, total_urls)
        batch_urls = url_queue[start_idx:end_idx]
        
        print(f"\n" + "🔸" * 70)
        print(f"📦 BATCH {batch_num + 1}/{num_batches} - Processing {len(batch_urls)} profiles")
        print(f"🎯 Profiles {start_idx + 1}-{end_idx} of {total_urls}")
        print("🔸" * 70)
        
        # Show batch URLs
        for i, url in enumerate(batch_urls, 1):
            username = get_profile_username(url)
            print(f"   {start_idx + i}. @{username}: {url}")
        
        # Ask for confirmation if not the first batch
        if batch_num > 0:
            print(f"\n⏸️  Ready to start batch {batch_num + 1}?")
            try:
                response = input("   Press ENTER to continue, or type 'exit' to stop: ").strip().lower()
                if response in ['exit', 'quit', 'q', 'stop']:
                    print("🛑 Processing stopped by user")
                    break
            except KeyboardInterrupt:
                print("\n🛑 Processing stopped by user")
                break
        
        # Process this batch
        batch_results = process_batch(batch_urls, batch_num + 1, num_batches)
        all_results.extend(batch_results)
        
        # Show batch completion
        batch_videos = sum(result['videos_count'] for result in batch_results)
        batch_successful = sum(1 for result in batch_results if result['videos_count'] > 0)
        
        print(f"\n✅ Batch {batch_num + 1} complete!")
        print(f"   📊 Batch stats: {batch_successful}/{len(batch_urls)} successful, {batch_videos} videos")
        
        # Add break between batches (except last one)
        if batch_num < num_batches - 1:
            break_delay = random_delay(5, 10)
            print(f"   ⏸️  Taking a {break_delay:.1f}s break before next batch...")
    
    # Print final summary
    print(f"\n" + "="*70)
    print("🎉 ALL BATCHES COMPLETE!")
    print("="*70)
    
    total_videos = sum(result['videos_count'] for result in all_results)
    successful_profiles = sum(1 for result in all_results if result['videos_count'] > 0)
    
    print(f"📊 Final Summary:")
    print(f"   📦 Batches processed: {batch_num + 1}/{num_batches}")
    print(f"   👤 Total profiles processed: {len(all_results)}")
    print(f"   ✅ Successful profiles: {successful_profiles}")
    print(f"   📹 Total videos scraped: {total_videos}")
    print()
    
    # Group results by batch for display
    for i in range(0, len(all_results), BATCH_SIZE):
        batch_results = all_results[i:i + BATCH_SIZE]
        batch_display_num = (i // BATCH_SIZE) + 1
        print(f"   📦 Batch {batch_display_num}:")
        for result in batch_results:
            status = "✅" if result['videos_count'] > 0 else "❌"
            print(f"      {status} @{result['username']}: {result['videos_count']} videos")
    
    print(f"\n📁 All CSV files saved in the 'data/' directory")

def process_batch(batch_urls, batch_num, total_batches):
    """
    Process a single batch of URLs with simultaneous browser windows.
    
    Args:
        batch_urls (list): List of URLs in this batch (max 2)
        batch_num (int): Current batch number
        total_batches (int): Total number of batches
        
    Returns:
        list: Results for this batch
    """
    batch_results = []
    drivers = []
    
    try:
        print(f"\n🌐 Opening {len(batch_urls)} browser windows for batch {batch_num}...")
        
        # Setup Chrome options
        chrome_options = Options()
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        chrome_options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
        
        # Uncomment the next line for headless mode
        # chrome_options.add_argument("--headless")
        
        # Open browser windows for each URL
        for i, url in enumerate(batch_urls):
            username = get_profile_username(url)
            print(f"   🌐 Opening window {i+1}: @{username}")
            
            # Check if it's a profile URL
            if not ('/@' in url and '/video/' not in url):
                print(f"   ❌ Skipping @{username}: Please provide a TikTok profile URL")
                drivers.append(None)
                batch_results.append({
                    'username': username,
                    'url': url,
                    'videos_count': 0,
                    'filepath': None
                })
                continue
            
            # Initialize WebDriver
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=chrome_options)
            driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            drivers.append(driver)
            
            # Navigate to profile
            print(f"   📄 Navigating @{username} to profile page...")
            driver.get(url)
            
            # Position windows side by side for better visibility
            if i == 0:
                driver.set_window_position(0, 0)
                driver.set_window_size(960, 1080)  # Left half of screen
            elif i == 1:
                driver.set_window_position(960, 0)
                driver.set_window_size(960, 1080)  # Right half of screen
        
        # Wait for initial page loads
        initial_delay = random_delay(3, 5)
        print(f"   ⏱️  Waiting {initial_delay:.1f}s for pages to load...")
        
        # Manual navigation phase for all windows
        print(f"\n" + "🔸" * 70)
        print(f"🛠️  MANUAL NAVIGATION PHASE - BATCH {batch_num}")
        print("🔸" * 70)
        print("📋 For EACH browser window, please:")
        print("   1. 📅 Click on 'Oldest' to sort videos chronologically")
        print("   2. 🔄 Wait for the page to fully load")
        print("   3. ✅ Verify you can see video thumbnails")
        print("   4. 🚫 DO NOT scroll manually - auto-scroll will handle it")
        print()
        for i, url in enumerate(batch_urls):
            if drivers[i] is not None:
                username = get_profile_username(url)
                print(f"   🌐 Window {i+1}: @{username}")
        
        # Give user time to manually set up the pages
        setup_delay = random_delay(10, 15)
        print(f"\n⏱️  Giving you {setup_delay:.1f}s to set up all windows...")
        print("🚀 Auto-scrolling will start automatically!")
        
        # Auto-scroll all windows simultaneously to load all videos
        print(f"\n📜 Auto-scrolling ALL windows simultaneously...")
        all_video_containers = [[] for _ in batch_urls]
        threads = []
        
        def scroll_window_thread(index, url, driver):
            """Thread function to scroll a single window"""
            if driver is None:
                return
                
            username = get_profile_username(url)
            print(f"   📜 Starting auto-scroll for @{username} (Window {index+1})...")
            
            # Auto-scroll this window
            video_containers = auto_scroll_and_load_videos_parallel(driver, username, index+1)
            all_video_containers[index] = video_containers
        
        # Start all scrolling threads simultaneously
        for i, (url, driver) in enumerate(zip(batch_urls, drivers)):
            if driver is not None:
                thread = threading.Thread(target=scroll_window_thread, args=(i, url, driver))
                threads.append(thread)
                thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        print(f"\n✅ Auto-scrolling complete for all windows!")
        
        # Now process each profile's videos sequentially
        for i, (url, driver, video_containers) in enumerate(zip(batch_urls, drivers, all_video_containers)):
            if driver is None:
                continue
                
            username = get_profile_username(url)
            print(f"\n" + "="*60)
            print(f"🎯 Processing videos for @{username} (Window {i+1})")
            print("="*60)
            
            # Focus on this window
            driver.switch_to.window(driver.current_window_handle)
            
            # Process videos from this profile
            video_data = scrape_videos_from_containers(driver, video_containers, WebDriverWait(driver, 10))
            
            if video_data:
                # Save data for this profile
                filepath = save_to_csv(video_data, username)
                batch_results.append({
                    'username': username,
                    'url': url,
                    'videos_count': len(video_data),
                    'filepath': filepath
                })
            else:
                print(f"❌ No data collected for @{username}")
                batch_results.append({
                    'username': username,
                    'url': url,
                    'videos_count': 0,
                    'filepath': None
                })
        
    except Exception as e:
        print(f"❌ Error during batch {batch_num} processing: {e}")
    
    finally:
        # Close all browser windows
        print(f"\n🔒 Closing all browser windows for batch {batch_num}...")
        for i, driver in enumerate(drivers):
            if driver:
                try:
                    print(f"   🔒 Closing window {i+1}...")
                    driver.quit()
                except:
                    pass
    
    return batch_results

def auto_scroll_and_load_videos_parallel(driver, username, window_num):
    """
    Auto-scroll down the page to load all videos for parallel processing.
    
    Args:
        driver: Selenium WebDriver instance
        username: Profile username for logging
        window_num: Window number for logging
        
    Returns:
        list: List of video container elements found
    """
    print(f"   🔄 Window {window_num} (@{username}): Starting auto-scroll...")
    
    # Get initial page height
    last_height = driver.execute_script("return document.body.scrollHeight")
    videos_found = 0
    scroll_attempts = 0
    max_scroll_attempts = 50  # Prevent infinite scrolling
    
    while scroll_attempts < max_scroll_attempts:
        # Scroll down to bottom
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        
        # Wait for new content to load
        scroll_delay = random_delay(1.5, 3)  # Shorter delays for parallel scrolling
        
        # Check how many videos we have now
        try:
            current_videos = driver.find_elements(By.CSS_SELECTOR, 'a[href*="/video/"]')
            if not current_videos:
                current_videos = driver.find_elements(By.CSS_SELECTOR, 'a.css-1mdo0pl-AVideoContainer')
            
            current_count = len(current_videos)
            
            if current_count > videos_found:
                print(f"   📜 Window {window_num} (@{username}): +{current_count - videos_found} videos (total: {current_count})")
                videos_found = current_count
            
        except:
            current_videos = []
            current_count = 0
        
        # Calculate new scroll height and compare with last scroll height
        new_height = driver.execute_script("return document.body.scrollHeight")
        
        if new_height == last_height:
            # No new content loaded, try a few more times
            if scroll_attempts >= 3:
                print(f"   🏁 Window {window_num} (@{username}): Reached end after {scroll_attempts + 1} scrolls")
                break
        else:
            last_height = new_height
        
        scroll_attempts += 1
        
        # Safety check - if we have a lot of videos, we might want to stop
        if videos_found > 1000:
            print(f"   🛑 Window {window_num} (@{username}): Stopping at {videos_found} videos (safety limit)")
            break
    
    # Final count and return
    final_videos = driver.find_elements(By.CSS_SELECTOR, 'a[href*="/video/"]')
    if not final_videos:
        final_videos = driver.find_elements(By.CSS_SELECTOR, 'a.css-1mdo0pl-AVideoContainer')
    
    final_count = len(final_videos)
    print(f"   🎯 Window {window_num} (@{username}): Complete! {final_count} total videos loaded")
    
    return final_videos

def scrape_tiktok_profile_with_driver(driver, url):
    """
    Scrape TikTok profile using an existing WebDriver instance.
    This is used for batch processing to reuse the same browser session.
    """
    print(f"📱 Profile URL: {url}")
    
    video_data = []
    wait = WebDriverWait(driver, 10)
    
    try:
        # Navigate to the profile page
        print(f"📄 Navigating to profile...")
        driver.get(url)
        delay = random_delay(2, 4)  # Random delay for page load
        print(f"   ⏱️  Waited {delay:.1f}s for page to load")
        
        # Manual navigation phase (for first profile only, or if needed)
        print("\n" + "="*60)
        print("🛠️  MANUAL NAVIGATION PHASE")
        print("="*60)
        print("📋 Please perform the following steps manually:")
        print("   1. 📅 Click on 'Oldest' to sort videos chronologically")
        print("   2. 🔄 Wait for the page to fully load")
        print("   3. 📱 Let auto-scroll load all videos")
        print("   4. ✅ Verify you can see video thumbnails")
        print("\n💡 The browser window is open - you can interact with it now!")
        print("🚀 Once you're ready, press ENTER to start automated scraping...")
        
        # Wait for user input
        try:
            input()  # This will pause execution until user presses Enter
        except KeyboardInterrupt:
            print("\n👋 Scraping cancelled by user")
            return video_data
        
        print("\n🤖 Starting automated scraping phase...")
        delay = random_delay(1.5, 3)  # Random delay before starting
        print(f"   ⏱️  Waited {delay:.1f}s before starting automation")
        
        # Auto-scroll to load all videos
        print("📜 Auto-scrolling to load all videos...")
        video_containers = auto_scroll_and_load_videos(driver)
        
        # Continue with existing scraping logic...
        # (The rest of the scraping logic would be similar to the original function)
        # I'll implement this part next
        
        return scrape_videos_from_containers(driver, video_containers, wait)
        
    except Exception as e:
        print(f"❌ Error during profile scraping: {e}")
        return video_data

def scrape_videos_from_containers(driver, video_containers, wait):
    """
    Scrape individual videos from a list of video containers.
    
    Args:
        driver: Selenium WebDriver instance
        video_containers: List of video container elements
        wait: WebDriverWait instance
        
    Returns:
        list: List of video data dictionaries
    """
    video_data = []
    video_count = len(video_containers)
    
    if video_count == 0:
        print("❌ No videos found on this profile")
        return video_data
    
    # Determine how many videos to scrape
    videos_to_scrape = video_count if MAX_VIDEOS_TO_SCRAPE is None else min(video_count, MAX_VIDEOS_TO_SCRAPE)
    
    if MAX_VIDEOS_TO_SCRAPE is None:
        print(f"🎯 Will scrape all {videos_to_scrape} videos found")
    else:
        print(f"🎯 Will scrape {videos_to_scrape} videos (limited by MAX_VIDEOS_TO_SCRAPE = {MAX_VIDEOS_TO_SCRAPE})")
    
    for i in range(videos_to_scrape):
        try:
            # Add a random delay between videos (except for the first one)
            if i > 0:
                between_videos_delay = random_delay(1, 3)
                print(f"   ⏱️  Inter-video delay: {between_videos_delay:.1f}s")
            
            print(f"\n📹 Processing video {i + 1}/{videos_to_scrape}...")
            
            # Re-find video containers (they might change after navigation)
            try:
                current_containers = driver.find_elements(By.CSS_SELECTOR, 'a[href*="/video/"]')
                if not current_containers:
                    current_containers = driver.find_elements(By.CSS_SELECTOR, 'a.css-1mdo0pl-AVideoContainer')
                if not current_containers:
                    current_containers = driver.find_elements(By.CSS_SELECTOR, '[data-e2e="user-post-item"]')
            except:
                print(f"❌ Could not find video containers after navigation")
                break
            
            if i >= len(current_containers):
                print(f"❌ Video {i + 1} not found in updated container list")
                break
            
            video_container = current_containers[i]
            
            # Extract view count from the profile page using TikTok's actual selector
            view_count = "0"
            try:
                # Use TikTok's exact selector for video views
                view_element = video_container.find_element(By.CSS_SELECTOR, 'strong[data-e2e="video-views"]')
                view_count = view_element.text
                print(f"   ✅ Found profile view count: {view_count}")
            except:
                try:
                    # Alternative selector with class
                    view_element = video_container.find_element(By.CSS_SELECTOR, 'strong.video-count')
                    view_count = view_element.text
                    print(f"   ✅ Found profile view count (alt): {view_count}")
                except:
                    print(f"   ⚠️  No view count found on profile page")
                    pass
            
            # Click on the video to open detailed view
            click_delay = random_delay(0.5, 1.5)  # Random delay before click
            print(f"   ⏱️  Pre-click delay: {click_delay:.1f}s")
            
            driver.execute_script("arguments[0].click();", video_container)
            
            # Random delay for video page to load
            load_delay = random_delay(2.5, 4.5)  # Longer delay for video loading
            print(f"   ⏱️  Video load delay: {load_delay:.1f}s")
            
            # Extract detailed metrics from the video page
            likes = "0"
            bookmarks = "0" 
            comments = "0"
            
            print(f"   🔍 Extracting metrics from video page...")
            
            # Use TikTok's exact selectors for individual video page metrics
            # These selectors are based on the actual TikTok HTML structure
            
            # Extract likes using TikTok's browse-like-count selector
            try:
                like_element = driver.find_element(By.CSS_SELECTOR, 'strong[data-e2e="browse-like-count"]')
                likes = like_element.text.strip()
                print(f"   ✅ Found likes: {likes} (TikTok selector: browse-like-count)")
            except:
                print(f"   ⚠️  No likes found with TikTok selector")
            
            # Extract bookmarks using TikTok's undefined-count selector 
            # Note: TikTok actually uses "undefined-count" for bookmarks/saves - this is their internal naming!
            try:
                bookmark_element = driver.find_element(By.CSS_SELECTOR, 'strong[data-e2e="undefined-count"]')
                bookmarks = bookmark_element.text.strip()
                print(f"   ✅ Found bookmarks: {bookmarks} (TikTok selector: undefined-count)")
            except:
                print(f"   ⚠️  No bookmarks found with TikTok selector")
            
            # Extract comments using TikTok's browse-comment-count selector
            try:
                comment_element = driver.find_element(By.CSS_SELECTOR, 'strong[data-e2e="browse-comment-count"]')
                comments = comment_element.text.strip()
                print(f"   ✅ Found comments: {comments} (TikTok selector: browse-comment-count)")
            except:
                print(f"   ⚠️  No comments found with TikTok selector")
            
            # Try to get view count from individual video page if we didn't get it from profile
            if view_count == "0":
                try:
                    # Try to find view count on the individual video page
                    view_element = driver.find_element(By.CSS_SELECTOR, 'strong[data-e2e="video-views"]')
                    view_count = view_element.text.strip()
                    print(f"   ✅ Found views on video page: {view_count}")
                except:
                    print(f"   ⚠️  No view count found on video page either")
            
            # If any metrics are still missing, try fallback selectors (but TikTok's selectors should work)
            if likes == "0" or comments == "0" or bookmarks == "0":
                print(f"   🔄 Some metrics missing, trying fallback selectors...")
                
                if likes == "0":
                    try:
                        # Fallback like selectors
                        fallback_like = driver.find_element(By.CSS_SELECTOR, 'strong[data-e2e*="like"]')
                        likes = fallback_like.text.strip()
                        print(f"   ✅ Found likes (fallback): {likes}")
                    except:
                        pass
                
                if comments == "0":
                    try:
                        # Fallback comment selectors
                        fallback_comment = driver.find_element(By.CSS_SELECTOR, 'strong[data-e2e*="comment"]')
                        comments = fallback_comment.text.strip()
                        print(f"   ✅ Found comments (fallback): {comments}")
                    except:
                        pass
                
                if bookmarks == "0":
                    try:
                        # Fallback bookmark selectors
                        fallback_bookmark = driver.find_element(By.CSS_SELECTOR, 'strong[data-e2e*="bookmark"], strong[data-e2e*="collect"], strong[data-e2e*="save"]')
                        bookmarks = fallback_bookmark.text.strip()
                        print(f"   ✅ Found bookmarks (fallback): {bookmarks}")
                    except:
                        pass
            
            # Get video URL
            current_url = driver.current_url
            
            # Parse the counts
            parsed_views = parse_count(view_count)
            parsed_likes = parse_count(likes)
            parsed_bookmarks = parse_count(bookmarks)
            parsed_comments = parse_count(comments)
            
            video_info = {
                'video_url': current_url,
                'views': parsed_views,
                'likes': parsed_likes,
                'bookmarks': parsed_bookmarks,
                'comments': parsed_comments,
                'views_raw': view_count,
                'likes_raw': likes,
                'bookmarks_raw': bookmarks,
                'comments_raw': comments,
                'scraped_at': datetime.now().isoformat()
            }
            
            video_data.append(video_info)
            
            print(f"   👁️  Views: {view_count} ({parsed_views:,})")
            print(f"   ❤️  Likes: {likes} ({parsed_likes:,})")
            print(f"   🔖 Bookmarks: {bookmarks} ({parsed_bookmarks:,})")
            print(f"   💬 Comments: {comments} ({parsed_comments:,})")
            
            # Go back to profile
            driver.back()
            back_delay = random_delay(1.5, 3)  # Random delay after going back
            print(f"   ⏱️  Back navigation delay: {back_delay:.1f}s")
            
        except Exception as e:
            print(f"❌ Error processing video {i + 1}: {e}")
            try:
                driver.back()
                error_delay = random_delay(1, 2)  # Random delay after error
                print(f"   ⏱️  Error recovery delay: {error_delay:.1f}s")
            except:
                pass
            continue
    
    return video_data

def main():
    """
    Main function to run the TikTok scraper with queue system.
    """
    try:
        # Step 1: Get multiple TikTok URLs from user
        url_queue = get_tiktok_urls()
        
        if not url_queue:
            print("❌ No URLs provided")
            return
        
        print(f"\n🎯 Queue contains {len(url_queue)} URLs to process")
        
        # Step 2: Process the entire queue
        process_url_queue(url_queue)
        
        print("\n🎉 All scraping completed successfully!")
        
    except Exception as e:
        print(f"❌ An error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
