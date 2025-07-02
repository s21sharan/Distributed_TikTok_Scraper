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
from datetime import datetime, timedelta
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
MAX_VIDEOS_TO_SCRAPE = None  # Set to None for all videos, or a number like 5 for testing

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

def parse_upload_date(date_str):
    """
    Parse TikTok upload date strings into proper datetime objects.
    Handles multiple formats:
    - Relative dates: "3d ago", "2w ago", "1m ago", "1y ago"
    - Partial dates: "4-25" (month-day, current year assumed)
    - Full dates: "2024-12-23"
    
    Args:
        date_str (str): Date string from TikTok
        
    Returns:
        str: ISO formatted date string or None if parsing fails
    """
    if not date_str:
        return None
    
    date_str = date_str.strip()
    now = datetime.now()
    
    try:
        # Handle relative dates like "3d ago", "2w ago", "1m ago", "1y ago"
        if 'ago' in date_str.lower():
            # Extract number and unit
            match = re.match(r'(\d+)([dwmy])\s*ago', date_str.lower())
            if match:
                num = int(match.group(1))
                unit = match.group(2)
                
                if unit == 'd':  # days
                    upload_date = now - timedelta(days=num)
                elif unit == 'w':  # weeks
                    upload_date = now - timedelta(weeks=num)
                elif unit == 'm':  # months (approximate)
                    upload_date = now - timedelta(days=num * 30)
                elif unit == 'y':  # years (approximate)
                    upload_date = now - timedelta(days=num * 365)
                else:
                    return None
                
                return upload_date.isoformat()
        
        # Handle partial dates like "4-25" (month-day format)
        elif re.match(r'^\d{1,2}-\d{1,2}$', date_str):
            month, day = map(int, date_str.split('-'))
            # Use current year, but if the date is in the future, use previous year
            year = now.year
            try:
                upload_date = datetime(year, month, day)
                if upload_date > now:
                    upload_date = datetime(year - 1, month, day)
                return upload_date.isoformat()
            except ValueError:
                # Invalid date (e.g., Feb 30)
                return None
        
        # Handle full dates like "2024-12-23"
        elif re.match(r'^\d{4}-\d{1,2}-\d{1,2}$', date_str):
            try:
                upload_date = datetime.strptime(date_str, '%Y-%m-%d')
                return upload_date.isoformat()
            except ValueError:
                return None
        
        # Handle other potential formats
        else:
            print(f"   ⚠️  Unknown date format: {date_str}")
            return None
            
    except Exception as e:
        print(f"   ❌ Error parsing date '{date_str}': {e}")
        return None

def auto_scroll_and_load_videos(driver):
    """
    Auto-scroll to load all videos on TikTok profile page.
    Continues scrolling until no new content loads.
    
    Args:
        driver: Selenium WebDriver instance
        
    Returns:
        list: List of video container elements found
    """
    print("🔄 Starting auto-scroll to load all videos...")
    
    last_height = driver.execute_script("return document.body.scrollHeight")
    scroll_attempts = 0
    no_change_count = 0
    max_no_change = 3  # Stop after 3 consecutive attempts with no height change
    max_total_attempts = 100  # Safety limit to prevent infinite loops
    
    while scroll_attempts < max_total_attempts:
        scroll_attempts += 1
        print(f"   📜 Scroll #{scroll_attempts}: Scrolling to bottom...")
        
        # Scroll to bottom
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        
        # Wait for content to load
        time.sleep(2)
        
        # Check if page height changed (new content loaded)
        new_height = driver.execute_script("return document.body.scrollHeight")
        
        if new_height == last_height:
            no_change_count += 1
            print(f"   ⏸️  No new content loaded ({no_change_count}/{max_no_change})")
            
            if no_change_count >= max_no_change:
                print(f"   🏁 Stopping: No new content for {max_no_change} consecutive attempts")
                break
        else:
            print(f"   ✅ New content loaded: {last_height} → {new_height}")
            last_height = new_height
            no_change_count = 0  # Reset counter when content loads
    
    if scroll_attempts >= max_total_attempts:
        print(f"   🛑 Stopped after reaching maximum attempts ({max_total_attempts})")
    
    # Find video containers using common selectors
    video_containers = []
    selectors = [
        'a[href*="/video/"]',
        '[data-e2e="user-post-item"]',
        'a.css-1mdo0pl-AVideoContainer'
    ]
    
    for selector in selectors:
        try:
            containers = driver.find_elements(By.CSS_SELECTOR, selector)
            if len(containers) > len(video_containers):
                video_containers = containers
                print(f"   ✅ Using selector: {selector} (found {len(containers)} videos)")
        except:
            continue
    
    print(f"🎯 Auto-scroll complete! Found {len(video_containers)} videos after {scroll_attempts} scrolls")
    return video_containers

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
        
        # Additional options for stability
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--disable-web-security")
        
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
        
        print("\n🚀 Starting automated processing...")
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
                upload_date = None
                description = ""
                hashtags = []
                mentions = []
                
                print(f"   🔍 Extracting metrics and content from video page...")
                
                # Extract upload date using TikTok's data-e2e="browser-nickname" selector
                try:
                    print(f"   🔍 DEBUG: Looking for upload date...")
                    # Look for the date in the browser-nickname span structure
                    date_elements = driver.find_elements(By.CSS_SELECTOR, 'span[data-e2e="browser-nickname"]')
                    print(f"   🔍 DEBUG: Found {len(date_elements)} browser-nickname elements")
                    
                    for i, date_element in enumerate(date_elements):
                        # The date is usually in the last part after the " · " separator
                        element_text = date_element.text.strip()
                        print(f"   🔍 DEBUG: browser-nickname[{i}] text: '{element_text}'")
                        
                        if ' · ' in element_text:
                            # Split by the separator and get the last part (the date)
                            date_part = element_text.split(' · ')[-1].strip()
                            print(f"   🔍 DEBUG: Extracted date part: '{date_part}'")
                            
                            if date_part and not date_part.startswith('@'):
                                print(f"   🔍 DEBUG: Attempting to parse date: '{date_part}'")
                                upload_date = parse_upload_date(date_part)
                                if upload_date:
                                    print(f"   📅 ✅ Found upload date: {date_part} → {upload_date}")
                                    break
                                else:
                                    print(f"   🔍 DEBUG: Failed to parse date: '{date_part}'")
                            else:
                                print(f"   🔍 DEBUG: Skipping date part (empty or @mention): '{date_part}'")
                    
                    # If not found in browser-nickname, try alternative selectors
                    if not upload_date:
                        print(f"   🔍 DEBUG: No date found in browser-nickname, trying XPath selectors...")
                        # Try to find date in other common TikTok date containers using XPath for text search
                        try:
                            # XPath to find spans containing "ago"
                            date_elements = driver.find_elements(By.XPATH, "//span[contains(text(), 'ago')]")
                            print(f"   🔍 DEBUG: Found {len(date_elements)} spans containing 'ago'")
                            
                            for i, elem in enumerate(date_elements):
                                text = elem.text.strip()
                                print(f"   🔍 DEBUG: XPath ago[{i}] text: '{text}'")
                                if text:
                                    upload_date = parse_upload_date(text)
                                    if upload_date:
                                        print(f"   📅 ✅ Found upload date (XPath ago): {text} → {upload_date}")
                                        break
                                    else:
                                        print(f"   🔍 DEBUG: Failed to parse XPath ago date: '{text}'")
                        except Exception as e:
                            print(f"   🔍 DEBUG: XPath ago search failed: {e}")
                            pass
                        
                        # Try XPath for date patterns like "4-25" or "2024-12-23"
                        if not upload_date:
                            print(f"   🔍 DEBUG: Trying XPath for date patterns with '-'...")
                            try:
                                date_elements = driver.find_elements(By.XPATH, "//span[contains(text(), '-')]")
                                print(f"   🔍 DEBUG: Found {len(date_elements)} spans containing '-'")
                                
                                for i, elem in enumerate(date_elements):
                                    text = elem.text.strip()
                                    print(f"   🔍 DEBUG: XPath dash[{i}] text: '{text}'")
                                    if text and (re.match(r'\d+-\d+', text) or re.match(r'\d{4}-\d+-\d+', text)):
                                        print(f"   🔍 DEBUG: Text matches date pattern, attempting to parse: '{text}'")
                                        upload_date = parse_upload_date(text)
                                        if upload_date:
                                            print(f"   📅 ✅ Found upload date (XPath date): {text} → {upload_date}")
                                            break
                                        else:
                                            print(f"   🔍 DEBUG: Failed to parse XPath date: '{text}'")
                                    else:
                                        print(f"   🔍 DEBUG: Text doesn't match date pattern: '{text}'")
                            except Exception as e:
                                print(f"   🔍 DEBUG: XPath date search failed: {e}")
                                pass
                                
                        # Try CSS selectors for data attributes
                        if not upload_date:
                            print(f"   🔍 DEBUG: Trying CSS selectors for date attributes...")
                            try:
                                css_selectors = ['[data-e2e*="date"]', '.date', 'time']
                                for selector in css_selectors:
                                    print(f"   🔍 DEBUG: Trying CSS selector: '{selector}'")
                                    date_elements = driver.find_elements(By.CSS_SELECTOR, selector)
                                    print(f"   🔍 DEBUG: Found {len(date_elements)} elements with selector '{selector}'")
                                    
                                    for i, elem in enumerate(date_elements):
                                        text = elem.text.strip()
                                        print(f"   🔍 DEBUG: CSS[{selector}][{i}] text: '{text}'")
                                        if text and ('ago' in text or re.match(r'\d+-\d+', text) or re.match(r'\d{4}-\d+-\d+', text)):
                                            print(f"   🔍 DEBUG: Text matches criteria, attempting to parse: '{text}'")
                                            upload_date = parse_upload_date(text)
                                            if upload_date:
                                                print(f"   📅 ✅ Found upload date (CSS): {text} → {upload_date}")
                                                break
                                            else:
                                                print(f"   🔍 DEBUG: Failed to parse CSS date: '{text}'")
                                        else:
                                            print(f"   🔍 DEBUG: Text doesn't match criteria: '{text}'")
                                    if upload_date:
                                        break
                            except Exception as e:
                                print(f"   🔍 DEBUG: CSS selector search failed: {e}")
                                pass
                                
                    if not upload_date:
                        print(f"   ⚠️  DEBUG: No upload date found after trying all methods")
                        
                except Exception as e:
                    print(f"   ❌ DEBUG: Error extracting upload date: {e}")
                
                # Extract video description
                print(f"   🔍 DEBUG: Looking for video description...")
                try:
                    print(f"   🔍 DEBUG: Trying primary selector: span[data-e2e='new-desc-span']")
                    desc_element = driver.find_element(By.CSS_SELECTOR, 'span[data-e2e="new-desc-span"]')
                    description = desc_element.text.strip()
                    print(f"   📝 ✅ Found description: {description[:100]}{'...' if len(description) > 100 else ''}")
                    print(f"   🔍 DEBUG: Full description: '{description}'")
                except Exception as e:
                    print(f"   🔍 DEBUG: Primary selector failed: {e}")
                    try:
                        # Fallback selectors for description
                        alt_desc_selectors = [
                            'span[data-e2e*="desc"]',
                            '.video-meta-description',
                            '[data-e2e="video-desc"]'
                        ]
                        print(f"   🔍 DEBUG: Trying {len(alt_desc_selectors)} fallback selectors...")
                        
                        for i, selector in enumerate(alt_desc_selectors):
                            try:
                                print(f"   🔍 DEBUG: Trying fallback[{i}]: '{selector}'")
                                desc_element = driver.find_element(By.CSS_SELECTOR, selector)
                                description = desc_element.text.strip()
                                print(f"   📝 ✅ Found description (fallback): {description[:100]}{'...' if len(description) > 100 else ''}")
                                print(f"   🔍 DEBUG: Full description: '{description}'")
                                break
                            except Exception as fallback_error:
                                print(f"   🔍 DEBUG: Fallback[{i}] failed: {fallback_error}")
                                continue
                    except Exception as e2:
                        print(f"   🔍 DEBUG: All fallback selectors failed: {e2}")
                        print(f"   ⚠️  DEBUG: No description found after trying all methods")
                
                # Extract hashtags and mentions from links
                print(f"   🔍 DEBUG: Looking for hashtags and mentions...")
                try:
                    # Find all search-common-link elements
                    print(f"   🔍 DEBUG: Searching for elements with selector: a[data-e2e='search-common-link']")
                    link_elements = driver.find_elements(By.CSS_SELECTOR, 'a[data-e2e="search-common-link"]')
                    print(f"   🔍 DEBUG: Found {len(link_elements)} search-common-link elements")
                    
                    for i, link in enumerate(link_elements):
                        try:
                            href = link.get_attribute('href')
                            text = link.text.strip()
                            print(f"   🔍 DEBUG: Link[{i}] - href: '{href}', text: '{text}'")
                            
                            if href and text:
                                # Check if it's a hashtag (links to /tag/...)
                                if '/tag/' in href and text.startswith('#'):
                                    hashtag = text.replace('#', '').strip()
                                    print(f"   🔍 DEBUG: Found hashtag link - extracted: '{hashtag}'")
                                    if hashtag and hashtag not in hashtags:
                                        hashtags.append(hashtag)
                                        print(f"   🏷️  ✅ Added hashtag: '{hashtag}'")
                                    else:
                                        print(f"   🔍 DEBUG: Skipping hashtag (empty or duplicate): '{hashtag}'")
                                
                                # Check if it's a mention (links to /@...)
                                elif '/@' in href and text.startswith('@'):
                                    mention = text.replace('@', '').strip()
                                    print(f"   🔍 DEBUG: Found mention link - extracted: '{mention}'")
                                    if mention and mention not in mentions:
                                        mentions.append(mention)
                                        print(f"   👤 ✅ Added mention: '{mention}'")
                                    else:
                                        print(f"   🔍 DEBUG: Skipping mention (empty or duplicate): '{mention}'")
                                else:
                                    print(f"   🔍 DEBUG: Link doesn't match hashtag or mention pattern")
                            else:
                                print(f"   🔍 DEBUG: Link missing href or text")
                        except Exception as link_error:
                            print(f"   🔍 DEBUG: Error processing link[{i}]: {link_error}")
                            continue
                    
                    print(f"   🔍 DEBUG: Final results - Hashtags: {hashtags}, Mentions: {mentions}")
                    
                    if hashtags:
                        print(f"   🏷️  ✅ Found hashtags: {hashtags}")
                    if mentions:
                        print(f"   👤 ✅ Found mentions: {mentions}")
                        
                    if not hashtags and not mentions:
                        print(f"   ⚠️  DEBUG: No hashtags or mentions found after processing all links")
                        
                except Exception as e:
                    print(f"   ❌ DEBUG: Error extracting hashtags/mentions: {e}")
                
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
                    'upload_date': upload_date,
                    'description': description,
                    'hashtags': hashtags,
                    'mentions': mentions,
                    'scraped_at': datetime.now().isoformat()
                }
                
                video_data.append(video_info)
                
                print(f"   👁️  Views: {view_count} ({parsed_views:,})")
                print(f"   ❤️  Likes: {likes} ({parsed_likes:,})")
                print(f"   🔖 Bookmarks: {bookmarks} ({parsed_bookmarks:,})")
                print(f"   💬 Comments: {comments} ({parsed_comments:,})")
                if upload_date:
                    print(f"   📅 Upload Date: {upload_date}")
                if description:
                    print(f"   📝 Description: {description[:80]}{'...' if len(description) > 80 else ''}")
                if hashtags:
                    print(f"   🏷️  Hashtags: {hashtags}")
                if mentions:
                    print(f"   👤 Mentions: {mentions}")
                
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
        
        # Additional options for stability
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--disable-web-security")
        
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
        
        print(f"\n🚀 Starting automatic processing for batch {batch_num}...")
        
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
        
        # Now process each profile's videos simultaneously
        print(f"\n🎯 Processing videos from ALL windows simultaneously...")
        processing_threads = []
        thread_results = [None for _ in batch_urls]
        
        def process_videos_thread(index, url, driver, video_containers):
            """Thread function to process videos from a single profile"""
            if driver is None:
                return
                
            username = get_profile_username(url)
            print(f"\n" + "="*60)
            print(f"🎯 Processing videos for @{username} (Window {index+1})")
            print("="*60)
            
            # Focus on this window
            driver.switch_to.window(driver.current_window_handle)
            
            # Process videos from this profile
            video_data = scrape_videos_from_containers(driver, video_containers, WebDriverWait(driver, 10))
            
            if video_data:
                # Save data for this profile
                filepath = save_to_csv(video_data, username)
                thread_results[index] = {
                    'username': username,
                    'url': url,
                    'videos_count': len(video_data),
                    'filepath': filepath
                }
            else:
                print(f"❌ No data collected for @{username}")
                thread_results[index] = {
                    'username': username,
                    'url': url,
                    'videos_count': 0,
                    'filepath': None
                }
        
        # Start all video processing threads simultaneously
        for i, (url, driver, video_containers) in enumerate(zip(batch_urls, drivers, all_video_containers)):
            if driver is not None:
                thread = threading.Thread(target=process_videos_thread, args=(i, url, driver, video_containers))
                processing_threads.append(thread)
                thread.start()
        
        # Wait for all video processing threads to complete
        for thread in processing_threads:
            thread.join()
        
        # Collect results from threads
        for result in thread_results:
            if result is not None:
                batch_results.append(result)
        
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
    Auto-scroll for parallel processing - continues until no new content loads.
    
    Args:
        driver: Selenium WebDriver instance
        username: Profile username for logging
        window_num: Window number for logging
        
    Returns:
        list: List of video container elements found
    """
    print(f"   🔄 Window {window_num} (@{username}): Starting auto-scroll...")
    
    last_height = driver.execute_script("return document.body.scrollHeight")
    scroll_attempts = 0
    no_change_count = 0
    max_no_change = 3  # Stop after 3 consecutive attempts with no change
    max_total_attempts = 80  # Slightly reduced for parallel processing
    
    while scroll_attempts < max_total_attempts:
        scroll_attempts += 1
        print(f"   📜 Window {window_num} (@{username}): Scroll #{scroll_attempts}")
        
        # Scroll to bottom
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(1.5)  # Shorter wait for parallel
        
        # Check if page height changed
        new_height = driver.execute_script("return document.body.scrollHeight")
        
        if new_height == last_height:
            no_change_count += 1
            print(f"   ⏸️  Window {window_num} (@{username}): No new content ({no_change_count}/{max_no_change})")
            
            if no_change_count >= max_no_change:
                print(f"   🏁 Window {window_num} (@{username}): Stopping after {max_no_change} attempts")
                break
        else:
            print(f"   ✅ Window {window_num} (@{username}): New content loaded")
            last_height = new_height
            no_change_count = 0  # Reset counter
    
    if scroll_attempts >= max_total_attempts:
        print(f"   🛑 Window {window_num} (@{username}): Stopped after {max_total_attempts} attempts")
    
    # Find video containers
    video_containers = []
    selectors = ['a[href*="/video/"]', '[data-e2e="user-post-item"]', 'a.css-1mdo0pl-AVideoContainer']
    
    for selector in selectors:
        try:
            containers = driver.find_elements(By.CSS_SELECTOR, selector)
            if len(containers) > len(video_containers):
                video_containers = containers
        except:
            continue
    
    print(f"   🎯 Window {window_num} (@{username}): Found {len(video_containers)} videos after {scroll_attempts} scrolls")
    return video_containers

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
        
        print("\n🚀 Starting automated processing...")
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
            upload_date = None
            description = ""
            hashtags = []
            mentions = []
            
            print(f"   🔍 Extracting metrics and content from video page...")
            
            # Extract upload date using TikTok's data-e2e="browser-nickname" selector
            try:
                print(f"   🔍 DEBUG: Looking for upload date...")
                # Look for the date in the browser-nickname span structure
                date_elements = driver.find_elements(By.CSS_SELECTOR, 'span[data-e2e="browser-nickname"]')
                print(f"   🔍 DEBUG: Found {len(date_elements)} browser-nickname elements")
                
                for i, date_element in enumerate(date_elements):
                    # The date is usually in the last part after the " · " separator
                    element_text = date_element.text.strip()
                    print(f"   🔍 DEBUG: browser-nickname[{i}] text: '{element_text}'")
                    
                    if ' · ' in element_text:
                        # Split by the separator and get the last part (the date)
                        date_part = element_text.split(' · ')[-1].strip()
                        print(f"   🔍 DEBUG: Extracted date part: '{date_part}'")
                        
                        if date_part and not date_part.startswith('@'):
                            print(f"   🔍 DEBUG: Attempting to parse date: '{date_part}'")
                            upload_date = parse_upload_date(date_part)
                            if upload_date:
                                print(f"   📅 ✅ Found upload date: {date_part} → {upload_date}")
                                break
                            else:
                                print(f"   🔍 DEBUG: Failed to parse date: '{date_part}'")
                        else:
                            print(f"   🔍 DEBUG: Skipping date part (empty or @mention): '{date_part}'")
                
                # If not found in browser-nickname, try alternative selectors
                if not upload_date:
                    print(f"   🔍 DEBUG: No date found in browser-nickname, trying XPath selectors...")
                    # Try to find date in other common TikTok date containers using XPath for text search
                    try:
                        # XPath to find spans containing "ago"
                        date_elements = driver.find_elements(By.XPATH, "//span[contains(text(), 'ago')]")
                        print(f"   🔍 DEBUG: Found {len(date_elements)} spans containing 'ago'")
                        
                        for i, elem in enumerate(date_elements):
                            text = elem.text.strip()
                            print(f"   🔍 DEBUG: XPath ago[{i}] text: '{text}'")
                            if text:
                                upload_date = parse_upload_date(text)
                                if upload_date:
                                    print(f"   📅 ✅ Found upload date (XPath ago): {text} → {upload_date}")
                                    break
                                else:
                                    print(f"   🔍 DEBUG: Failed to parse XPath ago date: '{text}'")
                    except Exception as e:
                        print(f"   🔍 DEBUG: XPath ago search failed: {e}")
                        pass
                    
                    # Try XPath for date patterns like "4-25" or "2024-12-23"
                    if not upload_date:
                        print(f"   🔍 DEBUG: Trying XPath for date patterns with '-'...")
                        try:
                            date_elements = driver.find_elements(By.XPATH, "//span[contains(text(), '-')]")
                            print(f"   🔍 DEBUG: Found {len(date_elements)} spans containing '-'")
                            
                            for i, elem in enumerate(date_elements):
                                text = elem.text.strip()
                                print(f"   🔍 DEBUG: XPath dash[{i}] text: '{text}'")
                                if text and (re.match(r'\d+-\d+', text) or re.match(r'\d{4}-\d+-\d+', text)):
                                    print(f"   🔍 DEBUG: Text matches date pattern, attempting to parse: '{text}'")
                                    upload_date = parse_upload_date(text)
                                    if upload_date:
                                        print(f"   📅 ✅ Found upload date (XPath date): {text} → {upload_date}")
                                        break
                                    else:
                                        print(f"   🔍 DEBUG: Failed to parse XPath date: '{text}'")
                                else:
                                    print(f"   🔍 DEBUG: Text doesn't match date pattern: '{text}'")
                        except Exception as e:
                            print(f"   🔍 DEBUG: XPath date search failed: {e}")
                            pass
                            
                    # Try CSS selectors for data attributes
                    if not upload_date:
                        print(f"   🔍 DEBUG: Trying CSS selectors for date attributes...")
                        try:
                            css_selectors = ['[data-e2e*="date"]', '.date', 'time']
                            for selector in css_selectors:
                                print(f"   🔍 DEBUG: Trying CSS selector: '{selector}'")
                                date_elements = driver.find_elements(By.CSS_SELECTOR, selector)
                                print(f"   🔍 DEBUG: Found {len(date_elements)} elements with selector '{selector}'")
                                
                                for i, elem in enumerate(date_elements):
                                    text = elem.text.strip()
                                    print(f"   🔍 DEBUG: CSS[{selector}][{i}] text: '{text}'")
                                    if text and ('ago' in text or re.match(r'\d+-\d+', text) or re.match(r'\d{4}-\d+-\d+', text)):
                                        print(f"   🔍 DEBUG: Text matches criteria, attempting to parse: '{text}'")
                                        upload_date = parse_upload_date(text)
                                        if upload_date:
                                            print(f"   📅 ✅ Found upload date (CSS): {text} → {upload_date}")
                                            break
                                        else:
                                            print(f"   🔍 DEBUG: Failed to parse CSS date: '{text}'")
                                    else:
                                        print(f"   🔍 DEBUG: Text doesn't match criteria: '{text}'")
                                if upload_date:
                                    break
                        except Exception as e:
                            print(f"   🔍 DEBUG: CSS selector search failed: {e}")
                            pass
                            
                if not upload_date:
                    print(f"   ⚠️  DEBUG: No upload date found after trying all methods")
                    
            except Exception as e:
                print(f"   ❌ Error extracting upload date: {e}")
            
            # Extract video description
            print(f"   🔍 DEBUG: Looking for video description...")
            try:
                print(f"   🔍 DEBUG: Trying primary selector: span[data-e2e='new-desc-span']")
                desc_element = driver.find_element(By.CSS_SELECTOR, 'span[data-e2e="new-desc-span"]')
                description = desc_element.text.strip()
                print(f"   📝 ✅ Found description: {description[:100]}{'...' if len(description) > 100 else ''}")
                print(f"   🔍 DEBUG: Full description: '{description}'")
            except Exception as e:
                print(f"   🔍 DEBUG: Primary selector failed: {e}")
                try:
                    # Fallback selectors for description
                    alt_desc_selectors = [
                        'span[data-e2e*="desc"]',
                        '.video-meta-description',
                        '[data-e2e="video-desc"]'
                    ]
                    print(f"   🔍 DEBUG: Trying {len(alt_desc_selectors)} fallback selectors...")
                    
                    for i, selector in enumerate(alt_desc_selectors):
                        try:
                            print(f"   🔍 DEBUG: Trying fallback[{i}]: '{selector}'")
                            desc_element = driver.find_element(By.CSS_SELECTOR, selector)
                            description = desc_element.text.strip()
                            print(f"   📝 ✅ Found description (fallback): {description[:100]}{'...' if len(description) > 100 else ''}")
                            print(f"   🔍 DEBUG: Full description: '{description}'")
                            break
                        except Exception as fallback_error:
                            print(f"   🔍 DEBUG: Fallback[{i}] failed: {fallback_error}")
                            continue
                except Exception as e2:
                    print(f"   🔍 DEBUG: All fallback selectors failed: {e2}")
                    print(f"   ⚠️  DEBUG: No description found after trying all methods")
            
            # Extract hashtags and mentions from links
            print(f"   🔍 DEBUG: Looking for hashtags and mentions...")
            try:
                # Find all search-common-link elements
                print(f"   🔍 DEBUG: Searching for elements with selector: a[data-e2e='search-common-link']")
                link_elements = driver.find_elements(By.CSS_SELECTOR, 'a[data-e2e="search-common-link"]')
                print(f"   🔍 DEBUG: Found {len(link_elements)} search-common-link elements")
                
                for i, link in enumerate(link_elements):
                    try:
                        href = link.get_attribute('href')
                        text = link.text.strip()
                        print(f"   🔍 DEBUG: Link[{i}] - href: '{href}', text: '{text}'")
                        
                        if href and text:
                            # Check if it's a hashtag (links to /tag/...)
                            if '/tag/' in href and text.startswith('#'):
                                hashtag = text.replace('#', '').strip()
                                print(f"   🔍 DEBUG: Found hashtag link - extracted: '{hashtag}'")
                                if hashtag and hashtag not in hashtags:
                                    hashtags.append(hashtag)
                                    print(f"   🏷️  ✅ Added hashtag: '{hashtag}'")
                                else:
                                    print(f"   🔍 DEBUG: Skipping hashtag (empty or duplicate): '{hashtag}'")
                            
                            # Check if it's a mention (links to /@...)
                            elif '/@' in href and text.startswith('@'):
                                mention = text.replace('@', '').strip()
                                print(f"   🔍 DEBUG: Found mention link - extracted: '{mention}'")
                                if mention and mention not in mentions:
                                    mentions.append(mention)
                                    print(f"   👤 ✅ Added mention: '{mention}'")
                                else:
                                    print(f"   🔍 DEBUG: Skipping mention (empty or duplicate): '{mention}'")
                            else:
                                print(f"   🔍 DEBUG: Link doesn't match hashtag or mention pattern")
                        else:
                            print(f"   🔍 DEBUG: Link missing href or text")
                    except Exception as link_error:
                        print(f"   🔍 DEBUG: Error processing link[{i}]: {link_error}")
                        continue
                
                print(f"   🔍 DEBUG: Final results - Hashtags: {hashtags}, Mentions: {mentions}")
                
                if hashtags:
                    print(f"   🏷️  ✅ Found hashtags: {hashtags}")
                if mentions:
                    print(f"   👤 ✅ Found mentions: {mentions}")
                    
                if not hashtags and not mentions:
                    print(f"   ⚠️  DEBUG: No hashtags or mentions found after processing all links")
                    
            except Exception as e:
                print(f"   ❌ DEBUG: Error extracting hashtags/mentions: {e}")
            
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
                'upload_date': upload_date,
                'description': description,
                'hashtags': hashtags,
                'mentions': mentions,
                'scraped_at': datetime.now().isoformat()
            }
            
            video_data.append(video_info)
            
            print(f"   👁️  Views: {view_count} ({parsed_views:,})")
            print(f"   ❤️  Likes: {likes} ({parsed_likes:,})")
            print(f"   🔖 Bookmarks: {bookmarks} ({parsed_bookmarks:,})")
            print(f"   💬 Comments: {comments} ({parsed_comments:,})")
            if upload_date:
                print(f"   📅 Upload Date: {upload_date}")
            if description:
                print(f"   📝 Description: {description[:80]}{'...' if len(description) > 80 else ''}")
            if hashtags:
                print(f"   🏷️  Hashtags: {hashtags}")
            if mentions:
                print(f"   👤 Mentions: {mentions}")
            
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
    Supports both interactive mode and command line arguments.
    """
    import signal
    
    def signal_handler(signum, frame):
        print(f"\n🛑 Received signal {signum}. Gracefully shutting down...")
        print("🔒 Cleaning up and closing browser...")
        sys.exit(1)
    
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # Check if URL was provided as command line argument
        if len(sys.argv) > 1:
            # Non-interactive mode - URL provided as argument
            url = sys.argv[1].strip()
            print(f"🎯 Processing URL from command line: {url}")
            
            if not validate_tiktok_url(url):
                print(f"❌ Invalid TikTok URL: {url}")
                print("[SCRAPER_OUTPUT_START]")
                print("[]")
                print("[SCRAPER_OUTPUT_END]")
                sys.exit(1)
            
            # Process single URL
            result = scrape_tiktok_profile(url)
            
            # Output JSON for worker consumption with clear delimiters
            import json
            print("[SCRAPER_OUTPUT_START]")
            print(json.dumps(result, indent=2))
            print("[SCRAPER_OUTPUT_END]")
            return  # Exit after outputting JSON - don't continue to interactive mode
            
        else:
            # Interactive mode - get URLs from user
            print("🎵 TikTok Scraper - Interactive Mode")
            url_queue = get_tiktok_urls()
            
            if not url_queue:
                print("❌ No URLs provided")
                return
            
            print(f"\n🎯 Queue contains {len(url_queue)} URLs to process")
            
            # Step 2: Process the entire queue
            process_url_queue(url_queue)
            
            print("\n🎉 All scraping completed successfully!")
        
    except KeyboardInterrupt:
        print(f"\n🛑 Keyboard interrupt received. Gracefully shutting down...")
        print("🔒 Cleaning up and closing browser...")
        # Output empty result for worker
        if len(sys.argv) > 1:
            print("[SCRAPER_OUTPUT_START]")
            print("[]")
            print("[SCRAPER_OUTPUT_END]")
        sys.exit(1)
    except Exception as e:
        print(f"❌ An error occurred: {e}")
        # Output empty result for worker in case of error
        if len(sys.argv) > 1:
            print("[SCRAPER_OUTPUT_START]")
            print("[]")
            print("[SCRAPER_OUTPUT_END]")
        sys.exit(1)

if __name__ == "__main__":
    main()
