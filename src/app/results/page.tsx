'use client'

import { useState, useEffect } from 'react'
import { MagnifyingGlassIcon, EyeIcon, ArrowDownTrayIcon, UserIcon, PlayIcon } from '@heroicons/react/24/outline'

interface VideoData {
  videoId: string
  url: string
  description: string | null
  likes: number
  shares: number
  comments: number
  views: number
  duration: string | null
  uploadDate: string | null
  hashtags: string[]
  mentions: string[]
  commentTexts: string[]
}

interface ScrapingResult {
  id: string
  queueItemId: string
  url: string
  username: string | null
  totalVideos: number
  successfulVideos: number
  failedVideos: number
  csvFilePath: string | null
  completedAt: string
  processingTime: number
  videoData: VideoData[]
}

export default function ResultsPage() {
  const [results, setResults] = useState<ScrapingResult[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [artistFilter, setArtistFilter] = useState('')
  const [sortBy, setSortBy] = useState<'completedAt' | 'views' | 'likes'>('completedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useState<'results' | 'videos'>('results')

  const fetchResults = async () => {
    try {
      const response = await fetch('/api/results')
      if (response.ok) {
        const data = await response.json()
        setResults(data)
      }
    } catch (error) {
      console.error('Failed to fetch results:', error)
    } finally {
      setLoading(false)
    }
  }

  const downloadVideosByArtist = async (username: string) => {
    try {
      const response = await fetch('/api/results/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${username}_videos_${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else {
        throw new Error('Download failed')
      }
    } catch (error) {
      console.error('Failed to download videos:', error)
      alert('Failed to download videos')
    }
  }

  const downloadSingleVideo = async (videoData: VideoData, username: string) => {
    try {
      const response = await fetch('/api/results/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: videoData.videoId, username })
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${username}_${videoData.videoId}_${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else {
        throw new Error('Download failed')
      }
    } catch (error) {
      console.error('Failed to download video:', error)
      alert('Failed to download video data')
    }
  }

  const exportAllResults = async () => {
    try {
      const response = await fetch('/api/results/export?format=csv')
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `tiktok-results-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Failed to export results:', error)
      alert('Failed to export results')
    }
  }

  useEffect(() => {
    fetchResults()
  }, [])

  useEffect(() => {
    // Set up polling for real-time updates
    const interval = setInterval(fetchResults, 10000)
    return () => clearInterval(interval)
  }, [])

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatDuration = (duration: string | null) => {
    if (!duration) return 'N/A'
    return duration
  }

  // Get all unique artists
  const allArtists = Array.from(new Set(
    results
      .filter(r => r.username)
      .map(r => r.username!)
  )).sort()

  // Filter results based on search term and artist filter
  const filteredResults = results.filter(result => {
    const matchesSearch = !searchTerm || 
      result.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      result.videoData.some(video => 
        video.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        video.hashtags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    
    const matchesArtist = !artistFilter || result.username === artistFilter
    
    return matchesSearch && matchesArtist
  })

  // Get all videos from filtered results
  const allVideos = filteredResults.flatMap(result => 
    result.videoData.map(video => ({
      ...video,
      username: result.username,
      scrapingResultId: result.id
    }))
  )

  // Sort videos
  const sortedVideos = [...allVideos].sort((a, b) => {
    let aVal, bVal
    switch (sortBy) {
      case 'views':
        aVal = a.views
        bVal = b.views
        break
      case 'likes':
        aVal = a.likes
        bVal = b.likes
        break
      default:
        aVal = new Date(a.uploadDate || 0).getTime()
        bVal = new Date(b.uploadDate || 0).getTime()
    }
    
    return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
  })

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white shadow rounded-lg p-6">
              <div className="h-4 bg-gray-200 rounded mb-4"></div>
              <div className="h-20 bg-gray-200 rounded mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Scraping Results</h1>
        <p className="mt-2 text-sm text-gray-600">
          Browse and analyze scraped TikTok video data
        </p>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex flex-col gap-4">
          {/* First row: Search and View Mode */}
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by description or hashtags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('results')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  viewMode === 'results'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Scraping Results
              </button>
              <button
                onClick={() => setViewMode('videos')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  viewMode === 'videos'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Individual Videos
              </button>
            </div>
          </div>

          {/* Second row: Filters and Actions */}
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex gap-4 items-center flex-1">
              <select
                value={artistFilter}
                onChange={(e) => setArtistFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">All Artists</option>
                {allArtists.map(artist => (
                  <option key={artist} value={artist}>@{artist}</option>
                ))}
              </select>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="completedAt">Sort by Date</option>
                <option value="views">Sort by Views</option>
                <option value="likes">Sort by Likes</option>
              </select>
              
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
            
            <button
              onClick={exportAllResults}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-md hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 flex items-center gap-2"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Export All
            </button>
          </div>
        </div>
      </div>

      {/* Results Content */}
      {viewMode === 'results' ? (
        // Scraping Results View
        filteredResults.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-6 text-center text-gray-500">
            {searchTerm || artistFilter ? 'No results match your filter criteria.' : 'No scraped data yet. Add URLs to the queue to get started.'}
          </div>
        ) : (
          <div className="space-y-6">
            {filteredResults.map((result) => (
              <div key={result.id} className="bg-white shadow rounded-lg overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        @{result.username}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Scraped {new Date(result.completedAt).toLocaleDateString()} • {result.successfulVideos} videos
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => downloadVideosByArtist(result.username!)}
                        className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm flex items-center gap-1"
                      >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        Download All
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center">
                      <p className="text-xl font-bold text-gray-900">{result.totalVideos}</p>
                      <p className="text-xs text-gray-600">Total Videos</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-green-600">{result.successfulVideos}</p>
                      <p className="text-xs text-gray-600">Successful</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-red-600">{result.failedVideos}</p>
                      <p className="text-xs text-gray-600">Failed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-blue-600">{result.processingTime}s</p>
                      <p className="text-xs text-gray-600">Processing Time</p>
                    </div>
                  </div>

                  {/* Sample Videos */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Sample Videos:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {result.videoData.slice(0, 6).map((video) => (
                        <div key={video.videoId} className="border rounded-lg p-3 hover:bg-gray-50">
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-sm font-medium text-gray-900 line-clamp-2">
                              {video.description?.substring(0, 50) || 'No description'}
                            </p>
                            <div className="flex gap-1 ml-2">
                              <a
                                href={video.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 text-purple-600 hover:text-purple-800"
                                title="View Original"
                              >
                                <EyeIcon className="h-3 w-3" />
                              </a>
                              <button
                                onClick={() => downloadSingleVideo(video, result.username!)}
                                className="p-1 text-green-600 hover:text-green-800"
                                title="Download Video Data"
                              >
                                <ArrowDownTrayIcon className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-600">
                            <span>{formatNumber(video.views)} views</span>
                            <span>{formatNumber(video.likes)} likes</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {result.videoData.length > 6 && (
                      <p className="text-sm text-gray-500 mt-2">
                        ... and {result.videoData.length - 6} more videos
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        // Individual Videos View
        sortedVideos.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-6 text-center text-gray-500">
            {searchTerm || artistFilter ? 'No videos match your filter criteria.' : 'No videos found.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedVideos.map((video) => (
              <div key={`${video.scrapingResultId}-${video.videoId}`} className="bg-white shadow rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-900">@{video.username}</span>
                    </div>
                    <div className="flex gap-1">
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-purple-600 hover:text-purple-800"
                        title="View Original"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </a>
                      <button
                        onClick={() => downloadSingleVideo(video, video.username!)}
                        className="p-1 text-green-600 hover:text-green-800"
                        title="Download Video Data"
                      >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 line-clamp-3">
                      {video.description || 'No description available'}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center">
                      <p className="text-lg font-bold text-gray-900">
                        {formatNumber(video.views)}
                      </p>
                      <p className="text-xs text-gray-600">Views</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-gray-900">
                        {formatNumber(video.likes)}
                      </p>
                      <p className="text-xs text-gray-600">Likes</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-gray-900">
                        {formatNumber(video.comments)}
                      </p>
                      <p className="text-xs text-gray-600">Comments</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-gray-900">
                        {formatDuration(video.duration)}
                      </p>
                      <p className="text-xs text-gray-600">Duration</p>
                    </div>
                  </div>
                  
                  {/* Hashtags */}
                  {video.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {video.hashtags.slice(0, 3).map((hashtag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
                        >
                          #{hashtag}
                        </span>
                      ))}
                      {video.hashtags.length > 3 && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                          +{video.hashtags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-500">
                    {video.uploadDate ? `Uploaded: ${new Date(video.uploadDate).toLocaleDateString()}` : 'Upload date unknown'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
      
      {/* Summary Stats */}
      <div className="mt-6 bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">{filteredResults.length}</p>
            <p className="text-sm text-gray-600">Scraping Results</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{allVideos.length}</p>
            <p className="text-sm text-gray-600">Total Videos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {formatNumber(allVideos.reduce((sum, v) => sum + v.views, 0))}
            </p>
            <p className="text-sm text-gray-600">Total Views</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">
              {formatNumber(allVideos.reduce((sum, v) => sum + v.likes, 0))}
            </p>
            <p className="text-sm text-gray-600">Total Likes</p>
          </div>
        </div>
      </div>
    </div>
  )
} 