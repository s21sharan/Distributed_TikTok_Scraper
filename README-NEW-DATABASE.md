# New TikTok Video Data Saving System

This document explains the new, rebuilt database saving system for TikTok video data. The old functions have been completely replaced with a cleaner, more robust system that includes data validation, categorization, and comprehensive parsing.

## 🚀 Overview

The new system consists of three main components:

1. **`video-data-service.ts`** - Core service for processing and saving video data
2. **`scraper-parser.ts`** - Parser for handling raw TikTok scraper output
3. **Updated API routes** - Integration with existing API endpoints

## 📊 Features

### Data Processing
- ✅ **Data Validation** - Validates and cleans all input data
- ✅ **Content Categorization** - Automatically categorizes videos (music, dance, comedy, etc.)
- ✅ **Engagement Metrics** - Calculates engagement rates and per-view metrics
- ✅ **Format Normalization** - Handles various data formats and edge cases
- ✅ **Error Handling** - Robust error handling with detailed logging

### Content Categories
The system automatically categorizes videos based on keywords in descriptions and hashtags:

- **Music**: music, song, singing, audio, sound, beat, remix, cover, lyrics, album
- **Dance**: dance, dancing, choreography, moves, tiktokdance, trend
- **Comedy**: funny, comedy, humor, joke, lol, laugh, meme, viral
- **Educational**: learn, tutorial, how to, educational, facts, tips, guide, explain
- **Trending**: fyp, foryou, viral, trending, tiktok, xyzbca

### Calculated Metrics
For each video, the system calculates:
- **Engagement Rate**: (likes + comments + bookmarks) / views * 100
- **Likes per View**: likes / views
- **Comments per View**: comments / views  
- **Bookmarks per View**: bookmarks / views

## 🔧 Usage

### Direct Usage in API Routes

```typescript
import { processTikTokScraperOutput } from '@/lib/scraper-parser'

// In your API route
const result = await processTikTokScraperOutput(queueItemId, rawScraperData)
```

### Using the Video Data Service

```typescript
import { videoDataService } from '@/lib/video-data-service'

// Process cleaned TikTok data
const result = await videoDataService.saveScrapedData(queueItemId, cleanedVideoData)
```

### Using the Scraper Parser

```typescript
import { ScraperParser } from '@/lib/scraper-parser'

// Parse raw scraper output
const parsedVideos = ScraperParser.parseScraperOutput(rawOutput)

// Validate parsed data
const { valid, invalid } = ScraperParser.validateVideoData(parsedVideos)

// Get parsing statistics
const stats = ScraperParser.getParsingStats(originalCount, parsedCount, validCount)
```

## 📋 Data Format

### Input Format (Raw Scraper Data)
The system expects TikTok scraper data in this format:

```json
[
  {
    "video_url": "https://www.tiktok.com/@username/video/1234567890",
    "views": 12100000,
    "likes": 1600000,
    "bookmarks": 127200,
    "comments": 4655,
    "views_raw": "12.1M",
    "likes_raw": "1.6M",
    "bookmarks_raw": "127.2K",
    "comments_raw": "4655",
    "upload_date": "2024-12-17T00:00:00",
    "description": "Amazing video description here!",
    "hashtags": ["fyp", "viral", "music"],
    "mentions": ["@username1", "@username2"],
    "comments_list": [
      "Great video!",
      "Love this content",
      "Amazing work"
    ],
    "duration": "00:42",
    "scraped_at": "2025-07-02T03:32:27.087823"
  }
]
```

### Output Format (Processed Data)
The system outputs structured data saved to the database:

```typescript
interface ProcessedVideoData {
  videoId: string
  url: string
  description: string | null
  likes: number
  bookmarks: number
  comments: number
  views: number
  duration: string | null
  uploadDate: Date | null
  hashtags: string[]
  mentions: string[]
  commentTexts: string[]
  metrics: {
    engagement_rate: number
    likes_per_view: number
    comments_per_view: number
    bookmarks_per_view: number
  }
  content_categories: {
    has_music: boolean
    has_dance: boolean
    has_comedy: boolean
    has_educational: boolean
    has_trending_hashtags: boolean
  }
}
```

## 🧪 Testing

Run the test script to validate the parser:

```bash
cd tiktok-music-trends
node test-new-parser.js
```

This will test:
- Parsing array data
- Data validation
- String parsing (JSON format)
- Statistics generation
- Error handling

## 📈 Console Output

The new system provides detailed logging:

```
🔄 Starting video data processing...
📊 Processing 10 videos for queue item: abc123
👤 Profile: @charlixcx
🔍 Processing and categorizing video data...
📹 Processing video 1/10
  ✅ 7449635413716765985: 12,100,000 views, 14.6% engagement
📈 Summary Statistics:
  Total videos: 10
  Average engagement rate: 12.45%
  Videos with music content: 6
  Videos with trending hashtags: 8
✅ Successfully saved 10 videos to database
```

## 🔍 Data Validation

The system performs comprehensive validation:

- **URL Validation**: Ensures valid TikTok URLs
- **Numeric Validation**: Validates and converts view/like counts
- **Date Validation**: Parses various date formats
- **Content Validation**: Filters invalid or empty content
- **Length Limits**: Enforces reasonable limits on text fields

## 🛠 Error Handling

The system handles various error scenarios:

- Invalid JSON format
- Missing required fields
- Malformed URLs
- Invalid date formats
- Network errors
- Database constraints

## 📊 Statistics and Monitoring

The system provides detailed statistics:

```
📊 Parsing Statistics:
  Original items: 15
  Parsed videos: 14 (93.3% success)
  Valid videos: 12 (85.7% valid)
  Overall success: 80.0%
```

## 🔄 Migration from Old System

The old `saveResults` function in `storage-db.ts` has been updated to use the new system:

```typescript
// OLD (removed)
async saveResults(queueItemId: string, scrapedVideos: any[]): Promise<ScrapingResult> {
  // Complex inline processing...
}

// NEW (simplified)
async saveResults(queueItemId: string, scrapedVideos: any[]): Promise<ScrapingResult> {
  const { videoDataService } = await import('./video-data-service')
  return await videoDataService.saveScrapedData(queueItemId, scrapedVideos)
}
```

## 🚨 Important Notes

1. **Backward Compatibility**: The API remains the same, only internal processing has changed
2. **Data Quality**: The new system is stricter about data validation
3. **Performance**: Includes built-in limits to prevent memory issues
4. **Logging**: Much more detailed logging for debugging
5. **Categories**: New automatic content categorization features

## 🔧 Configuration

Key limits and settings (can be adjusted in the service files):

- **Max Comments Stored**: 100 per video
- **Max Hashtags**: 30 per video
- **Max Mentions**: 20 per video
- **Description Length**: 2000 characters
- **Comment Length**: 500 characters
- **Max Engagement Rate**: 100% (capped)

## 📝 Example Usage

Here's a complete example of processing TikTok scraper data:

```typescript
// Sample scraper output
const rawScraperData = [
  {
    "video_url": "https://www.tiktok.com/@charlixcx/video/7449635413716765985",
    "views": 12100000,
    "likes": 1600000,
    "bookmarks": 127200,
    "comments": 4655,
    "views_raw": "12.1M",
    "likes_raw": "1.6M",
    "bookmarks_raw": "127.2K",
    "comments_raw": "4655",
    "upload_date": "2024-12-17T00:00:00",
    "description": "love u billieeeeee and hbd!!! <3",
    "hashtags": ["music", "concert"],
    "mentions": ["BILLIE EILISH"],
    "comments_list": ["Amazing show!", "Love this!"],
    "duration": "00:42",
    "scraped_at": "2025-07-02T03:32:27.087823"
  }
]

// Process and save to database
const queueItemId = "queue-item-123"
const result = await processTikTokScraperOutput(queueItemId, rawScraperData)

console.log(`Saved ${result.totalVideos} videos for @${result.username}`)
```

This will automatically:
1. Parse the raw data
2. Validate all fields
3. Calculate engagement metrics
4. Categorize the content (music: true, trending: false, etc.)
5. Save to the database
6. Return the processed result

The new system is now ready to handle your TikTok scraper output with robust processing, validation, and categorization! 