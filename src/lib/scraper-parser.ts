import { TikTokVideoData } from './video-data-service'

/**
 * Parse raw TikTok scraper output into structured video data
 */
export class ScraperParser {
  
  /**
   * Parse the raw scraper output from the TikTok scraper
   * Handles various output formats including JSON arrays and text output
   */
  static parseScraperOutput(rawOutput: string | any[]): TikTokVideoData[] {
    console.log('🔍 Parsing TikTok scraper output...')
    
    let videoData: any[] = []
    
    try {
      // If it's already an array (JSON format), use directly
      if (Array.isArray(rawOutput)) {
        videoData = rawOutput
      }
      // If it's a string, try to parse as JSON
      else if (typeof rawOutput === 'string') {
        videoData = this.extractJsonFromString(rawOutput)
      }
      // If it's an object, convert to array
      else if (typeof rawOutput === 'object' && rawOutput !== null) {
        videoData = [rawOutput]
      }
      else {
        throw new Error('Unsupported output format')
      }
      
      console.log(`📊 Found ${videoData.length} videos in scraper output`)
      
      // Validate and clean the video data
      const cleanedVideos = videoData
        .filter(video => video && typeof video === 'object')
        .map(video => this.cleanVideoData(video))
        .filter(video => video !== null)
      
      console.log(`✅ Successfully parsed ${cleanedVideos.length} videos`)
      
      return cleanedVideos
      
    } catch (error) {
      console.error('❌ Error parsing scraper output:', error)
      throw new Error(`Failed to parse scraper output: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Extract JSON data from string output that might contain other text
   */
  private static extractJsonFromString(rawString: string): any[] {
    // Try to find JSON array in the string
    const jsonArrayMatch = rawString.match(/\[[\s\S]*\]/)
    if (jsonArrayMatch) {
      try {
        return JSON.parse(jsonArrayMatch[0])
      } catch (error) {
        console.warn('⚠️  Failed to parse JSON array from string')
      }
    }
    
    // Try to find individual JSON objects
    const jsonObjectMatches = rawString.match(/\{[\s\S]*?\}(?=\s*[,\]]|\s*$)/g)
    if (jsonObjectMatches) {
      const objects = []
      for (const match of jsonObjectMatches) {
        try {
          objects.push(JSON.parse(match))
        } catch (error) {
          console.warn('⚠️  Failed to parse JSON object:', match.substring(0, 100))
        }
      }
      return objects
    }
    
    // If no JSON found, try to parse the entire string as JSON
    try {
      const parsed = JSON.parse(rawString)
      return Array.isArray(parsed) ? parsed : [parsed]
    } catch (error) {
      throw new Error('No valid JSON found in scraper output')
    }
  }
  
  /**
   * Clean and validate individual video data
   */
  private static cleanVideoData(rawVideo: any): TikTokVideoData | null {
    try {
      // Required fields check
      if (!rawVideo.video_url || typeof rawVideo.video_url !== 'string') {
        console.warn('⚠️  Skipping video without valid URL')
        return null
      }
      
      // Parse numeric values with fallbacks
      const views = this.parseNumericValue(rawVideo.views) || 0
      const likes = this.parseNumericValue(rawVideo.likes) || 0
      const bookmarks = this.parseNumericValue(rawVideo.bookmarks) || 0
      const comments = this.parseNumericValue(rawVideo.comments) || 0
      
      // Clean string values
      const description = this.cleanStringValue(rawVideo.description)
      const duration = this.cleanStringValue(rawVideo.duration)
      const upload_date = this.cleanStringValue(rawVideo.upload_date) || new Date().toISOString()
      
      // Clean array values
      const hashtags = this.cleanArrayValue(rawVideo.hashtags)
      const mentions = this.cleanArrayValue(rawVideo.mentions)
      const comments_list = this.cleanArrayValue(rawVideo.comments_list)
      
      // Get raw values for display
      const views_raw = this.cleanStringValue(rawVideo.views_raw) || views.toString()
      const likes_raw = this.cleanStringValue(rawVideo.likes_raw) || likes.toString()
      const bookmarks_raw = this.cleanStringValue(rawVideo.bookmarks_raw) || bookmarks.toString()
      const comments_raw = this.cleanStringValue(rawVideo.comments_raw) || comments.toString()
      
      const cleanedVideo: TikTokVideoData = {
        video_url: rawVideo.video_url,
        views,
        likes,
        bookmarks,
        comments,
        views_raw,
        likes_raw,
        bookmarks_raw,
        comments_raw,
        upload_date,
        description,
        hashtags,
        mentions,
        comments_list,
        duration,
        scraped_at: rawVideo.scraped_at || new Date().toISOString()
      }
      
      return cleanedVideo
      
    } catch (error) {
      console.warn('⚠️  Failed to clean video data:', error)
      return null
    }
  }
  
  /**
   * Parse numeric values from various formats (strings with K, M, etc.)
   */
  private static parseNumericValue(value: any): number {
    if (typeof value === 'number') {
      return Math.max(0, value)
    }
    
    if (typeof value === 'string') {
      // Remove commas and spaces
      const cleanValue = value.replace(/[,\s]/g, '').toLowerCase()
      
      // Handle K, M, B suffixes
      if (cleanValue.includes('k')) {
        const num = parseFloat(cleanValue.replace('k', ''))
        return Math.floor(num * 1000)
      }
      
      if (cleanValue.includes('m')) {
        const num = parseFloat(cleanValue.replace('m', ''))
        return Math.floor(num * 1000000)
      }
      
      if (cleanValue.includes('b')) {
        const num = parseFloat(cleanValue.replace('b', ''))
        return Math.floor(num * 1000000000)
      }
      
      // Try to parse as regular number
      const parsed = parseInt(cleanValue)
      return isNaN(parsed) ? 0 : Math.max(0, parsed)
    }
    
    return 0
  }
  
  /**
   * Clean string values
   */
  private static cleanStringValue(value: any): string {
    if (typeof value === 'string') {
      return value.trim()
    }
    
    if (value !== null && value !== undefined) {
      return String(value).trim()
    }
    
    return ''
  }
  
  /**
   * Clean array values
   */
  private static cleanArrayValue(value: any): string[] {
    if (Array.isArray(value)) {
      return value
        .filter(item => item !== null && item !== undefined)
        .map(item => String(item).trim())
        .filter(item => item.length > 0)
    }
    
    if (typeof value === 'string' && value.trim()) {
      // Try to parse as JSON array
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) {
          return this.cleanArrayValue(parsed)
        }
      } catch (error) {
        // If not JSON, treat as single item
        return [value.trim()]
      }
    }
    
    return []
  }
  
  /**
   * Validate video data structure
   */
  static validateVideoData(videos: TikTokVideoData[]): { valid: TikTokVideoData[], invalid: number } {
    const valid: TikTokVideoData[] = []
    let invalid = 0
    
    for (const video of videos) {
      if (this.isValidVideoData(video)) {
        valid.push(video)
      } else {
        invalid++
        console.warn('⚠️  Invalid video data structure:', {
          url: video.video_url,
          hasViews: typeof video.views === 'number',
          hasUploadDate: !!video.upload_date
        })
      }
    }
    
    return { valid, invalid }
  }
  
  /**
   * Check if video data is valid
   */
  private static isValidVideoData(video: TikTokVideoData): boolean {
    return !!(
      video.video_url &&
      typeof video.video_url === 'string' &&
      video.video_url.includes('tiktok.com') &&
      typeof video.views === 'number' &&
      typeof video.likes === 'number' &&
      typeof video.comments === 'number' &&
      video.upload_date
    )
  }
  
  /**
   * Get parsing statistics
   */
  static getParsingStats(originalCount: number, parsedCount: number, validCount: number) {
    return {
      originalCount,
      parsedCount,
      validCount,
      parseSuccessRate: originalCount > 0 ? (parsedCount / originalCount * 100).toFixed(1) : '0',
      validationSuccessRate: parsedCount > 0 ? (validCount / parsedCount * 100).toFixed(1) : '0',
      totalSuccessRate: originalCount > 0 ? (validCount / originalCount * 100).toFixed(1) : '0'
    }
  }
}

/**
 * Convenience function to parse scraper output and save to database
 */
export async function processTikTokScraperOutput(queueItemId: string, rawOutput: string | any[]) {
  console.log('🚀 Processing TikTok scraper output...')
  
  // Parse the raw output
  const parsedVideos = ScraperParser.parseScraperOutput(rawOutput)
  
  // Validate the data
  const { valid: validVideos, invalid: invalidCount } = ScraperParser.validateVideoData(parsedVideos)
  
  // Get statistics
  const stats = ScraperParser.getParsingStats(
    Array.isArray(rawOutput) ? rawOutput.length : 1,
    parsedVideos.length,
    validVideos.length
  )
  
  console.log('📊 Parsing Statistics:')
  console.log(`  Original items: ${stats.originalCount}`)
  console.log(`  Parsed videos: ${stats.parsedCount} (${stats.parseSuccessRate}% success)`)
  console.log(`  Valid videos: ${stats.validCount} (${stats.validationSuccessRate}% valid)`)
  console.log(`  Overall success: ${stats.totalSuccessRate}%`)
  
  if (invalidCount > 0) {
    console.warn(`⚠️  ${invalidCount} videos were invalid and will be skipped`)
  }
  
  if (validVideos.length === 0) {
    throw new Error('No valid video data found after parsing and validation')
  }
  
  // Save to database using the video data service
  const { videoDataService } = await import('./video-data-service')
  const result = await videoDataService.saveScrapedData(queueItemId, validVideos)
  
  console.log('✅ Successfully processed and saved TikTok scraper output')
  
  return result
} 