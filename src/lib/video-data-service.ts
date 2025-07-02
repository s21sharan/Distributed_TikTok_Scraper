import { prisma } from './database'
import { publishUpdate } from './realtime'

export interface TikTokVideoData {
  video_url: string
  views: number
  likes: number
  bookmarks: number
  comments: number
  views_raw: string
  likes_raw: string
  bookmarks_raw: string
  comments_raw: string
  upload_date: string
  description: string
  hashtags: string[]
  mentions: string[]
  comments_list: string[]
  duration: string | null
  scraped_at: string
}

export interface ProcessedVideoData {
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

export class VideoDataService {
  
  /**
   * Main function to save scraped video data to database
   */
  async saveScrapedData(queueItemId: string, scrapedVideos: TikTokVideoData[]) {
    console.log('🔄 Starting video data processing...')
    console.log(`📊 Processing ${scrapedVideos.length} videos for queue item: ${queueItemId}`)
    
    // Get queue item info
    const queueItem = await prisma.queueItem.findUnique({ 
      where: { id: queueItemId } 
    })
    
    if (!queueItem) {
      throw new Error(`Queue item not found: ${queueItemId}`)
    }

    // Extract username from URL
    const urlMatch = queueItem.url.match(/@([^\/\?]+)/)
    const username = urlMatch ? urlMatch[1] : 'unknown'
    
    console.log(`👤 Profile: @${username}`)

    // Process and categorize video data
    const processedVideos = await this.processVideoData(scrapedVideos)
    
    // Calculate summary statistics
    const stats = this.calculateSummaryStats(processedVideos)
    
    console.log('📈 Summary Statistics:')
    console.log(`  Total videos: ${stats.totalVideos}`)
    console.log(`  Average engagement rate: ${stats.avgEngagementRate.toFixed(2)}%`)
    console.log(`  Videos with music content: ${stats.musicVideos}`)
    console.log(`  Videos with trending hashtags: ${stats.trendingHashtagVideos}`)

    // Prepare database payload
    const databasePayload = {
      queueItemId: queueItemId,
      url: queueItem.url,
      username: username,
      totalVideos: processedVideos.length,
      successfulVideos: processedVideos.length,
      failedVideos: 0,
      processingTime: 0,
      videoData: {
        create: processedVideos.map(video => ({
          videoId: video.videoId,
          url: video.url,
          description: video.description,
          likes: video.likes,
          shares: video.bookmarks, // Using bookmarks as shares since shares aren't in scraper data
          comments: video.comments,
          views: video.views,
          duration: video.duration,
          uploadDate: video.uploadDate,
          hashtags: video.hashtags,
          mentions: video.mentions,
          commentTexts: video.commentTexts
        }))
      }
    }

    console.log('\n💾 DATABASE PAYLOAD PREVIEW:')
    console.log('📋 Scraping Result:')
    console.log(`   Queue Item ID: ${databasePayload.queueItemId}`)
    console.log(`   URL: ${databasePayload.url}`)
    console.log(`   Username: ${databasePayload.username}`)
    console.log(`   Total Videos: ${databasePayload.totalVideos}`)
    
    console.log('\n📹 VIDEO DATA PAYLOAD (First 2 videos):')
    databasePayload.videoData.create.slice(0, 2).forEach((video, index) => {
      console.log(`\n   Video ${index + 1}:`)
      console.log(`     videoId: "${video.videoId}"`)
      console.log(`     url: "${video.url}"`)
      console.log(`     description: "${video.description?.substring(0, 50)}${(video.description?.length ?? 0) > 50 ? '...' : ''}"`)
      console.log(`     views: ${video.views}`)
      console.log(`     likes: ${video.likes}`)
      console.log(`     comments: ${video.comments}`)
      console.log(`     shares: ${video.shares}`)
      console.log(`     duration: "${video.duration}"`)
      console.log(`     uploadDate: ${video.uploadDate?.toISOString()}`)
      console.log(`     hashtags: [${video.hashtags.slice(0, 3).join(', ')}${video.hashtags.length > 3 ? ', ...' : ''}] (${video.hashtags.length} total)`)
      console.log(`     mentions: [${video.mentions.slice(0, 2).join(', ')}${video.mentions.length > 2 ? ', ...' : ''}] (${video.mentions.length} total)`)
      console.log(`     commentTexts: ${video.commentTexts.length} comments stored`)
    })
    
    if (databasePayload.videoData.create.length > 2) {
      console.log(`\n   ... and ${databasePayload.videoData.create.length - 2} more videos`)
    }

    console.log('\n🔄 Saving to database...')

    // Save to database
    const result = await prisma.scrapingResult.create({
      data: databasePayload,
      include: {
        queueItem: true,
        videoData: true
      }
    })
    
    console.log(`✅ Successfully saved ${result.videoData.length} videos to database`)
    
    // Log what was actually saved to database
    console.log('\n✅ DATABASE SAVE CONFIRMATION:')
    console.log('📋 Saved Scraping Result:')
    console.log(`   ID: ${result.id}`)
    console.log(`   Username: ${result.username}`)
    console.log(`   Total Videos: ${result.totalVideos}`)
    console.log(`   Successful: ${result.successfulVideos}`)
    console.log(`   Completed At: ${result.completedAt.toISOString()}`)
    
    console.log('\n📹 SAVED VIDEO DATA (First 2 videos):')
    result.videoData.slice(0, 2).forEach((video, index) => {
      console.log(`\n   Saved Video ${index + 1}:`)
      console.log(`     Database ID: ${video.id}`)
      console.log(`     Video ID: ${video.videoId}`)
      console.log(`     URL: ${video.url}`)
      console.log(`     Description: "${video.description?.substring(0, 50)}${(video.description?.length ?? 0) > 50 ? '...' : ''}"`)
      console.log(`     Views: ${video.views}`)
      console.log(`     Likes: ${video.likes}`)
      console.log(`     Comments: ${video.comments}`)
      console.log(`     Shares: ${video.shares}`)
      console.log(`     Duration: ${video.duration}`)
      console.log(`     Upload Date: ${video.uploadDate?.toISOString()}`)
      console.log(`     Hashtags: [${video.hashtags.slice(0, 3).join(', ')}${video.hashtags.length > 3 ? ', ...' : ''}] (${video.hashtags.length} total)`)
      console.log(`     Mentions: [${video.mentions.slice(0, 2).join(', ')}${video.mentions.length > 2 ? ', ...' : ''}] (${video.mentions.length} total)`)
      console.log(`     Comment Texts: ${video.commentTexts.length} comments`)
      if (video.commentTexts.length > 0) {
        console.log(`     Sample Comments:`)
        video.commentTexts.slice(0, 2).forEach((comment, i) => {
          console.log(`       ${i + 1}. "${comment.substring(0, 40)}${comment.length > 40 ? '...' : ''}"`)
        })
      }
      console.log(`     Created At: ${video.createdAt.toISOString()}`)
    })
    
    if (result.videoData.length > 2) {
      console.log(`\n   ... and ${result.videoData.length - 2} more videos saved to database`)
    }
    
    // Publish realtime update
    await publishUpdate({
      type: 'result',
      action: 'create',
      data: this.mapResult(result),
      timestamp: Date.now()
    })
    
    return this.mapResult(result)
  }

  /**
   * Process and categorize individual video data
   */
  private async processVideoData(videos: TikTokVideoData[]): Promise<ProcessedVideoData[]> {
    console.log('🔍 Processing and categorizing video data...')
    
    return videos.map((video, index) => {
      console.log(`📹 Processing video ${index + 1}/${videos.length}`)
      
      // Extract video ID from URL
      const videoId = this.extractVideoId(video.video_url)
      
      // Parse upload date
      const uploadDate = this.parseUploadDate(video.upload_date)
      
      // Calculate metrics
      const metrics = this.calculateVideoMetrics(video)
      
      // Categorize content
      const content_categories = this.categorizeContent(video)
      
      // Clean and validate data
      const processedVideo: ProcessedVideoData = {
        videoId,
        url: video.video_url || '',
        description: this.cleanDescription(video.description),
        likes: Math.max(0, video.likes || 0),
        bookmarks: Math.max(0, video.bookmarks || 0),
        comments: Math.max(0, video.comments || 0),
        views: Math.max(0, video.views || 0),
        duration: this.normalizeDuration(video.duration),
        uploadDate,
        hashtags: this.cleanHashtags(video.hashtags || []),
        mentions: this.cleanMentions(video.mentions || []),
        commentTexts: this.filterComments(video.comments_list || []),
        metrics,
        content_categories
      }
      
      console.log(`  ✅ ${videoId}: ${processedVideo.views.toLocaleString()} views, ${metrics.engagement_rate.toFixed(1)}% engagement`)
      
      // Detailed logging of processed video data
      console.log(`  📊 PROCESSED DATA for ${videoId}:`)
      console.log(`     📝 Description: "${processedVideo.description?.substring(0, 60)}${(processedVideo.description?.length ?? 0) > 60 ? '...' : ''}"`)
      console.log(`     📈 Metrics:`, {
        views: processedVideo.views,
        likes: processedVideo.likes,
        comments: processedVideo.comments,
        bookmarks: processedVideo.bookmarks,
        engagement_rate: `${metrics.engagement_rate.toFixed(2)}%`,
        likes_per_view: metrics.likes_per_view.toFixed(4),
        comments_per_view: metrics.comments_per_view.toFixed(4)
      })
      console.log(`     🏷️  Categories:`, {
        music: content_categories.has_music,
        dance: content_categories.has_dance,
        comedy: content_categories.has_comedy,
        educational: content_categories.has_educational,
        trending: content_categories.has_trending_hashtags
      })
      console.log(`     🔗 Hashtags: [${processedVideo.hashtags.slice(0, 5).join(', ')}${processedVideo.hashtags.length > 5 ? ', ...' : ''}]`)
      console.log(`     👤 Mentions: [${processedVideo.mentions.slice(0, 3).join(', ')}${processedVideo.mentions.length > 3 ? ', ...' : ''}]`)
      console.log(`     💬 Comments: ${processedVideo.commentTexts.length} stored`)
      if (processedVideo.commentTexts.length > 0) {
        console.log(`     💬 Sample comments:`)
        processedVideo.commentTexts.slice(0, 2).forEach((comment, i) => {
          console.log(`        ${i + 1}. "${comment.substring(0, 50)}${comment.length > 50 ? '...' : ''}"`)
        })
      }
      console.log(`     ⏱️  Duration: ${processedVideo.duration || 'N/A'}`)
      console.log(`     📅 Upload Date: ${processedVideo.uploadDate?.toISOString() || 'N/A'}`)
      
      return processedVideo
    })
  }

  /**
   * Extract video ID from TikTok URL
   */
  private extractVideoId(url: string): string {
    if (!url) return 'unknown'
    
    const match = url.match(/\/video\/(\d+)/)
    return match ? match[1] : 'unknown'
  }

  /**
   * Parse upload date with multiple format support
   */
  private parseUploadDate(dateString: string): Date | null {
    if (!dateString) return null
    
    try {
      // Handle ISO format dates
      if (dateString.includes('T')) {
        return new Date(dateString)
      }
      
      // Handle other common formats
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        console.warn(`⚠️  Invalid upload date format: ${dateString}`)
        return null
      }
      
      return date
    } catch (error) {
      console.warn(`⚠️  Failed to parse upload date: ${dateString}`)
      return null
    }
  }

  /**
   * Calculate engagement metrics for a video
   */
  private calculateVideoMetrics(video: TikTokVideoData) {
    const views = Math.max(1, video.views || 1) // Avoid division by zero
    const likes = video.likes || 0
    const comments = video.comments || 0
    const bookmarks = video.bookmarks || 0
    
    const totalEngagement = likes + comments + bookmarks
    const engagement_rate = (totalEngagement / views) * 100
    
    return {
      engagement_rate: Math.min(100, engagement_rate), // Cap at 100%
      likes_per_view: likes / views,
      comments_per_view: comments / views,
      bookmarks_per_view: bookmarks / views
    }
  }

  /**
   * Categorize content based on description, hashtags, and other signals
   */
  private categorizeContent(video: TikTokVideoData) {
    const description = (video.description || '').toLowerCase()
    const hashtags = (video.hashtags || []).map(tag => tag.toLowerCase())
    const allText = `${description} ${hashtags.join(' ')}`
    
    // Music-related keywords
    const musicKeywords = ['music', 'song', 'singing', 'audio', 'sound', 'beat', 'remix', 'cover', 'lyrics', 'album']
    const has_music = musicKeywords.some(keyword => allText.includes(keyword))
    
    // Dance-related keywords
    const danceKeywords = ['dance', 'dancing', 'choreography', 'moves', 'tiktokdance', 'trend']
    const has_dance = danceKeywords.some(keyword => allText.includes(keyword))
    
    // Comedy-related keywords
    const comedyKeywords = ['funny', 'comedy', 'humor', 'joke', 'lol', 'laugh', 'meme', 'viral']
    const has_comedy = comedyKeywords.some(keyword => allText.includes(keyword))
    
    // Educational keywords
    const eduKeywords = ['learn', 'tutorial', 'how to', 'educational', 'facts', 'tips', 'guide', 'explain']
    const has_educational = eduKeywords.some(keyword => allText.includes(keyword))
    
    // Common trending hashtags (this could be expanded with a dynamic list)
    const trendingHashtags = ['fyp', 'foryou', 'viral', 'trending', 'tiktok', 'xyzbca']
    const has_trending_hashtags = hashtags.some(tag => trendingHashtags.includes(tag))
    
    return {
      has_music,
      has_dance,
      has_comedy,
      has_educational,
      has_trending_hashtags
    }
  }

  /**
   * Clean and normalize description text
   */
  private cleanDescription(description: string | null): string | null {
    if (!description || description.trim() === '') return null
    
    // Remove excessive whitespace and clean up
    return description.trim().substring(0, 2000) // Limit length
  }

  /**
   * Clean and normalize hashtags
   */
  private cleanHashtags(hashtags: string[]): string[] {
    return hashtags
      .filter(tag => tag && tag.trim() !== '')
      .map(tag => tag.replace('#', '').trim().toLowerCase())
      .filter(tag => tag.length > 0 && tag.length <= 50) // Filter out empty and overly long tags
      .slice(0, 30) // Limit number of hashtags
  }

  /**
   * Clean and normalize mentions
   */
  private cleanMentions(mentions: string[]): string[] {
    return mentions
      .filter(mention => mention && mention.trim() !== '')
      .map(mention => mention.replace('@', '').trim())
      .filter(mention => mention.length > 0)
      .slice(0, 20) // Limit number of mentions
  }

  /**
   * Filter and clean comment texts
   */
  private filterComments(comments: string[]): string[] {
    return comments
      .filter(comment => comment && comment.trim() !== '')
      .map(comment => comment.trim())
      .filter(comment => comment.length <= 500) // Filter out overly long comments
      .slice(0, 100) // Limit number of comments stored
  }

  /**
   * Normalize duration format
   */
  private normalizeDuration(duration: string | null): string | null {
    if (!duration) return null
    
    // Ensure format is MM:SS or HH:MM:SS
    const timeRegex = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/
    if (timeRegex.test(duration.trim())) {
      return duration.trim()
    }
    
    console.warn(`⚠️  Invalid duration format: ${duration}`)
    return null
  }

  /**
   * Calculate summary statistics for processed videos
   */
  private calculateSummaryStats(videos: ProcessedVideoData[]) {
    const totalVideos = videos.length
    const totalEngagementRate = videos.reduce((sum, video) => sum + video.metrics.engagement_rate, 0)
    const avgEngagementRate = totalVideos > 0 ? totalEngagementRate / totalVideos : 0
    
    const musicVideos = videos.filter(video => video.content_categories.has_music).length
    const danceVideos = videos.filter(video => video.content_categories.has_dance).length
    const comedyVideos = videos.filter(video => video.content_categories.has_comedy).length
    const educationalVideos = videos.filter(video => video.content_categories.has_educational).length
    const trendingHashtagVideos = videos.filter(video => video.content_categories.has_trending_hashtags).length
    
    return {
      totalVideos,
      avgEngagementRate,
      musicVideos,
      danceVideos,
      comedyVideos,
      educationalVideos,
      trendingHashtagVideos
    }
  }

  /**
   * Map database result for API response
   */
  private mapResult(result: any) {
    return {
      id: result.id,
      queueItemId: result.queueItemId,
      url: result.url,
      username: result.username,
      totalVideos: result.totalVideos,
      successfulVideos: result.successfulVideos,
      failedVideos: result.failedVideos,
      csvFilePath: result.csvFilePath,
      completedAt: result.completedAt.toISOString(),
      processingTime: result.processingTime,
      videoData: result.videoData?.map((video: any) => ({
        videoId: video.videoId,
        url: video.url,
        description: video.description,
        likes: video.likes,
        shares: video.shares,
        comments: video.comments,
        views: video.views,
        duration: video.duration,
        uploadDate: video.uploadDate?.toISOString(),
        hashtags: video.hashtags,
        mentions: video.mentions,
        commentTexts: video.commentTexts
      })) || []
    }
  }
}

export const videoDataService = new VideoDataService() 