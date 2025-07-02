const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkExistingData() {
  console.log('🔍 Checking existing video data in database...\n')
  
  try {
    // Get the latest video data records
    const recentVideos = await prisma.videoData.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        result: {
          select: {
            username: true,
            completedAt: true
          }
        }
      }
    })

    if (recentVideos.length === 0) {
      console.log('📭 No video data found in database yet.')
      return
    }

    console.log(`📊 Found ${recentVideos.length} recent video records:`)
    console.log('=' .repeat(50))

    recentVideos.forEach((video, index) => {
      console.log(`\n🎬 Video ${index + 1}:`)
      console.log(`   Video ID: ${video.videoId}`)
      console.log(`   Username: ${video.result?.username || 'N/A'}`)
      console.log(`   URL: ${video.url}`)
      console.log(`   
   🆕 NEW FIELDS:`)
      console.log(`   Description: ${video.description || 'NULL'}`)
      console.log(`   Duration: ${video.duration || 'NULL'}`)
      console.log(`   Upload Date: ${video.uploadDate || 'NULL'}`)
      console.log(`   Hashtags: ${JSON.stringify(video.hashtags)}`)
      console.log(`   Mentions: ${JSON.stringify(video.mentions)}`)
      console.log(`   Comments: ${video.commentTexts?.length || 0} comments`)
      console.log(`   
   📈 METRICS:`)
      console.log(`   Views: ${video.views}`)
      console.log(`   Likes: ${video.likes}`)
      console.log(`   Comments Count: ${video.comments}`)
      console.log(`   Created: ${video.createdAt}`)
    })

    // Check field population rates
    console.log('\n\n📊 FIELD POPULATION ANALYSIS:')
    console.log('=' .repeat(40))
    
    const totalVideos = await prisma.videoData.count()
    const fieldStats = await prisma.videoData.findMany({
      select: {
        description: true,
        duration: true,
        uploadDate: true,
        hashtags: true,
        mentions: true,
        commentTexts: true
      }
    })

    const stats = {
      total: totalVideos,
      withDescription: fieldStats.filter(v => v.description && v.description.trim() !== '').length,
      withDuration: fieldStats.filter(v => v.duration && v.duration.trim() !== '').length,
      withUploadDate: fieldStats.filter(v => v.uploadDate).length,
      withHashtags: fieldStats.filter(v => v.hashtags && v.hashtags.length > 0).length,
      withMentions: fieldStats.filter(v => v.mentions && v.mentions.length > 0).length,
      withComments: fieldStats.filter(v => v.commentTexts && v.commentTexts.length > 0).length
    }

    console.log(`Total video records: ${stats.total}`)
    console.log(`With description: ${stats.withDescription} (${(stats.withDescription/stats.total*100).toFixed(1)}%)`)
    console.log(`With duration: ${stats.withDuration} (${(stats.withDuration/stats.total*100).toFixed(1)}%)`)
    console.log(`With upload date: ${stats.withUploadDate} (${(stats.withUploadDate/stats.total*100).toFixed(1)}%)`)
    console.log(`With hashtags: ${stats.withHashtags} (${(stats.withHashtags/stats.total*100).toFixed(1)}%)`)
    console.log(`With mentions: ${stats.withMentions} (${(stats.withMentions/stats.total*100).toFixed(1)}%)`)
    console.log(`With comments: ${stats.withComments} (${(stats.withComments/stats.total*100).toFixed(1)}%)`)

  } catch (error) {
    console.error('❌ Error checking database:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkExistingData()
