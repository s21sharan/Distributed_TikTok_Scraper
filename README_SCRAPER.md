# 🎵 TikTok Scraper

A powerful TikTok profile scraper that extracts video metrics and saves them to CSV files using Selenium WebDriver.

## ✨ Features

- 🔍 **Profile Scraping**: Extract data from entire TikTok profiles
- 📋 **Queue System**: Process multiple TikTok profiles in batches of 2 with simultaneous browser windows
- 📜 **Simultaneous Processing**: Auto-scrolling AND video processing both use threading for maximum speed
- 🤖 **Fully Automated**: No manual intervention required - completely automatic
- 📊 **Comprehensive Metrics**: Captures views, likes, bookmarks/saves, and comments
- 💾 **Separate CSV Files**: Saves individual CSV files per profile with username identification
- 🎯 **Smart Parsing**: Converts TikTok's "142.5K" format to actual numbers
- 🚗 **Browser Automation**: Uses Selenium WebDriver for reliable scraping
- 🔧 **Auto ChromeDriver**: Automatically downloads and manages ChromeDriver
- 🎲 **Randomized Delays**: Human-like random delays between actions
- 🎯 **TikTok's Exact Selectors**: Uses TikTok's actual data-e2e selectors for maximum accuracy
- 🔄 **Error Handling**: Robust error handling and recovery

## 🚀 Quick Start

### 1. Install Google Chrome
Make sure you have Google Chrome installed:
- **Windows/Mac**: Download from [chrome.google.com](https://www.google.com/chrome/)
- **Ubuntu**: `sudo apt update && sudo apt install google-chrome-stable`
- **CentOS**: `sudo yum install google-chrome-stable`

### 2. Setup (First Time Only)
```bash
python3 setup_scraper.py
```

### 3. Run the Scraper
```bash
python3 tiktok_scraper.py
```

### 4. Build Your URL Queue
Enter multiple TikTok profile URLs one by one:
```
🎵 TikTok Scraper - Queue System
==================================================
📋 Enter multiple TikTok URLs to scrape in batch:
Enter TikTok URL #1: https://www.tiktok.com/@artist1
Enter TikTok URL #2: https://www.tiktok.com/@artist2  
Enter TikTok URL #3: https://www.tiktok.com/@artist3
Enter TikTok URL #4: done

✅ Queue complete! 3 URLs ready for processing.
```

### 5. Automated Batch Processing
- Processes profiles in batches of 2 at a time
- Opens 2 browser windows simultaneously per batch
- True simultaneous auto-scrolling AND video processing using threading
- Confirmation prompt between batches
- Separate CSV file generated per profile

### 6. Fully Automated Processing
- Two browser windows open side by side automatically
- Pages load and auto-scrolling starts immediately
- No manual intervention required
- Videos processed simultaneously from both windows

## 📊 Output

The scraper generates **separate CSV files** for each profile in the `data/` folder with the following columns:

| Column | Description | Example |
|--------|-------------|---------|
| `profile_username` | TikTok profile username | d4vdd |
| `video_url` | Direct link to the video | https://www.tiktok.com/@d4vdd/video/1234567890 |
| `views` | View count (parsed) | 142500 |
| `likes` | Like count (parsed) | 15200 |
| `bookmarks` | Bookmark count (parsed) | 890 |
| `comments` | Comment count (parsed) | 450 |
| `views_raw` | Original view text | "142.5K" |
| `likes_raw` | Original like text | "15.2K" |
| `bookmarks_raw` | Original bookmark text | "890" |
| `comments_raw` | Original comment text | "450" |
| `scraped_at` | Timestamp | 2024-01-15T10:30:45.123456 |

### File Naming Convention
- Individual files: `tiktok_username_YYYYMMDD_HHMMSS.csv`
- Example: `tiktok_d4vdd_20250628_192349.csv`

## 🔧 Configuration

### Headless Mode
To run without showing the browser window, edit `tiktok_scraper.py`:
```python
chrome_options.add_argument("--headless")  # Uncomment this line
```

### Video Limit
By default, the scraper processes ALL videos on the profile. To set a custom limit, edit the configuration at the top of `tiktok_scraper.py`:
```python
MAX_VIDEOS_TO_SCRAPE = None  # None = all videos
# or
MAX_VIDEOS_TO_SCRAPE = 50    # Limit to 50 videos
```

### Batch Size
The scraper processes profiles in batches of 2 by default. To change the batch size, edit the `BATCH_SIZE` variable in `process_url_queue()`:
```python
BATCH_SIZE = 2    # Process 2 profiles per batch (default)
# or
BATCH_SIZE = 3    # Process 3 profiles per batch
```

### Threading
Both auto-scrolling AND video processing use Python threading for maximum speed:
- **Auto-scrolling**: Each window scrolls in its own thread
- **Video processing**: Each profile processes videos in its own thread
- True parallel execution for both phases
- Progress messages may appear interleaved (this is normal and shows true simultaneity)

## 📁 File Structure

```
tiktok-music-trends/
├── tiktok_scraper.py          # Main scraper script with queue system
├── setup_scraper.py           # Setup and installation script
├── requirements_scraper.txt   # Python dependencies
├── README_SCRAPER.md         # This file
└── data/                     # Output CSV files (one per profile)
    ├── tiktok_artist1_20250628_192349.csv
    ├── tiktok_artist2_20250628_193425.csv
    └── tiktok_artist3_20250628_194512.csv
```

## 🎯 Supported URL Formats

- Profile URLs: `https://www.tiktok.com/@username`
- Profile URLs: `https://tiktok.com/@username`
- Short URLs: `https://www.tiktok.com/t/shortcode`
- Mobile URLs: `https://vm.tiktok.com/shortcode`

## ⚠️ Important Notes

1. **Parallel Processing**: Opens 2 browser windows simultaneously per batch for faster processing
2. **Threaded Processing**: Uses multi-threading for both scrolling AND video extraction simultaneously
3. **Profile URLs Only**: The scraper works with profile URLs, not individual video URLs
4. **Chrome Required**: Google Chrome browser must be installed
5. **ChromeDriver Auto-Managed**: ChromeDriver is automatically downloaded and updated
6. **Zero Manual Steps**: Completely automated processing with no user intervention required
7. **Window Positioning**: Browser windows are automatically positioned side by side for easy management
8. **Separate CSV Files**: Each profile gets its own timestamped CSV file with username identification
9. **Scrapes All Videos**: By default processes ALL videos on each profile (configurable)
10. **TikTok's Actual Selectors**: Uses TikTok's real data-e2e selectors (`browse-like-count`, `browse-comment-count`, `undefined-count`)
11. **Randomized Timing**: Uses random delays (1-4 seconds) between actions to mimic human behavior
12. **Rate Limiting**: The scraper includes delays to avoid being blocked
13. **Terms of Service**: Please respect TikTok's terms of service and rate limits
14. **Public Data Only**: This scraper only accesses publicly available data

## 🐛 Troubleshooting

### Common Issues

**"No videos found"**
- Make sure the profile is public
- Check if the URL is correct
- Videos are processed in the order they appear on the profile (most recent first)
- Some profiles may have different HTML structure

**Chrome/ChromeDriver Issues**
- Make sure Google Chrome is installed and up to date
- ChromeDriver is auto-managed, but if issues persist, try reinstalling
- Run `python3 setup_scraper.py` again

**"Chrome not detected"**
- Install Google Chrome browser first
- Check if Chrome is in the standard installation path
- Run the setup script to verify detection

**Permission Errors**
- Make sure you have write permissions in the current directory
- The script creates a `data/` folder automatically

### Debug Mode
The scraper runs with browser visible by default so you can see what's happening. This helps with debugging and verification.

## 🔄 Integration with Music Dashboard

The scraped CSV data can be imported into your TikTok Music Analytics dashboard:

1. Run the scraper on music artist profiles
2. Use the CSV data to populate your custom artists database
3. Convert metrics to match your dashboard format (likes, followers, trending score)

## 📈 Sample Output

```
🎵 TikTok Scraper - Queue System
==================================================
📋 Enter multiple TikTok URLs to scrape in batch:
Enter TikTok URL #1 (or 'done'/'clear'/'exit'): https://www.tiktok.com/@d4vdd
✅ Added to queue: https://www.tiktok.com/@d4vdd
Enter TikTok URL #2 (or 'done'/'clear'/'exit'): https://www.tiktok.com/@artist2
✅ Added to queue: https://www.tiktok.com/@artist2
Enter TikTok URL #3 (or 'done'/'clear'/'exit'): done

✅ Queue complete! 2 URLs ready for processing.

🎯 Queue contains 4 URLs to process

🚀 Starting batch processing of 4 profiles...
📦 Processing in batches of 2 profiles each (2 batches total)
======================================================================

🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸
📦 BATCH 1/2 - Processing 2 profiles
🎯 Profiles 1-2 of 4
🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸
   1. @d4vdd: https://www.tiktok.com/@d4vdd
   2. @artist2: https://www.tiktok.com/@artist2

🌐 Opening 2 browser windows for batch 1...
   🌐 Opening window 1: @d4vdd
   📄 Navigating @d4vdd to profile page...
   🌐 Opening window 2: @artist2
   📄 Navigating @artist2 to profile page...
   ⏱️  Waiting 4.1s for pages to load...

🚀 Starting automatic processing for batch 1...

📜 Auto-scrolling ALL windows simultaneously...
   📜 Starting auto-scroll for @d4vdd (Window 1)...
   📜 Starting auto-scroll for @artist2 (Window 2)...
   📜 Window 1 (@d4vdd): +15 videos (total: 47)
   📜 Window 2 (@artist2): +12 videos (total: 38)
   📜 Window 2 (@artist2): +9 videos (total: 47)
   📜 Window 1 (@d4vdd): +8 videos (total: 55)
   📜 Window 1 (@d4vdd): +15 videos (total: 70)
   📜 Window 2 (@artist2): +13 videos (total: 60)
   🏁 Window 2 (@artist2): Reached end after 3 scrolls
   📜 Window 1 (@d4vdd): +7 videos (total: 77)
   🏁 Window 1 (@d4vdd): Reached end after 5 scrolls
   🎯 Window 2 (@artist2): Complete! 60 total videos loaded
   🎯 Window 1 (@d4vdd): Complete! 77 total videos loaded

✅ Auto-scrolling complete for all windows!

🎯 Processing videos from ALL windows simultaneously...

============================================================
🎯 Processing videos for @d4vdd (Window 1)
============================================================

============================================================
🎯 Processing videos for @artist2 (Window 2)
============================================================

📹 Processing video 1/70...                    ← Window 1 (d4vdd)
📹 Processing video 1/60...                    ← Window 2 (artist2)
   ✅ Found profile view count: 142.5K         ← Window 1
   ✅ Found profile view count: 89.2K          ← Window 2
   ⏱️  Pre-click delay: 1.2s                   ← Window 1
   ⏱️  Pre-click delay: 0.9s                   ← Window 2
   ✅ Found likes: 52.3K (browse-like-count)   ← Window 1
   ✅ Found likes: 34.1K (browse-like-count)   ← Window 2
   📹 Processing video 2/70...                 ← Window 1
   📹 Processing video 2/60...                 ← Window 2

... (both profiles processing simultaneously) ...

💾 Saving data to tiktok_d4vdd_20250628_192349.csv...
✅ Saved 70 videos to data/tiktok_d4vdd_20250628_192349.csv

📊 Profile Summary for @d4vdd:
   📹 Videos scraped: 70
   👁️  Total views: 15,234,567
   ❤️  Total likes: 2,456,789
   🔖 Total bookmarks: 89,123
   💬 Total comments: 45,678

💾 Saving data to tiktok_d4vdd_20250628_192349.csv...
✅ Saved 70 videos to data/tiktok_d4vdd_20250628_192349.csv

📊 Profile Summary for @d4vdd:
   📹 Videos scraped: 70
   👁️  Total views: 15,234,567
   ❤️  Total likes: 2,456,789
   🔖 Total bookmarks: 89,123
   💬 Total comments: 45,678

============================================================
🎯 Processing videos for @artist2 (Window 2)
============================================================

... (processing all 60 videos for artist2) ...

💾 Saving data to tiktok_artist2_20250628_193425.csv...
✅ Saved 60 videos to data/tiktok_artist2_20250628_193425.csv

📊 Profile Summary for @artist2:
   📹 Videos scraped: 60
   👁️  Total views: 8,456,123
   ❤️  Total likes: 1,234,567
   🔖 Total bookmarks: 67,890
   💬 Total comments: 34,567

🔒 Closing all browser windows for batch 1...
   🔒 Closing window 1...
   🔒 Closing window 2...

✅ Batch 1 complete!
   📊 Batch stats: 2/2 successful, 130 videos
   ⏸️  Taking a 7.3s break before next batch...

🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸
📦 BATCH 2/2 - Processing 2 profiles
🎯 Profiles 3-4 of 4
🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸🔸
   3. @artist3: https://www.tiktok.com/@artist3
   4. @artist4: https://www.tiktok.com/@artist4

⏸️  Ready to start batch 2?
   Press ENTER to continue, or type 'exit' to stop: 

🌐 Launching fresh browser for batch 2...

... (similar process for batch 2) ...

✅ Batch 2 complete!
   📊 Batch stats: 2/2 successful, 146 videos

======================================================================
🎉 ALL BATCHES COMPLETE!
======================================================================
📊 Final Summary:
   📦 Batches processed: 2/2
   👤 Total profiles processed: 4
   ✅ Successful profiles: 4
   📹 Total videos scraped: 276

   📦 Batch 1:
      ✅ @d4vdd: 70 videos
      ✅ @artist2: 60 videos
   📦 Batch 2:
      ✅ @artist3: 82 videos
      ✅ @artist4: 64 videos

📁 All CSV files saved in the 'data/' directory

🎉 All scraping completed successfully! 
```

## 🛠️ Requirements

- Python 3.7+
- Google Chrome browser
- selenium>=4.15.0
- webdriver-manager>=4.0.0

ChromeDriver is automatically downloaded and managed by webdriver-manager. 