'use client'

import { useState, useEffect } from 'react'
import { MagnifyingGlassIcon, EyeIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'

interface ScrapingResult {
  id: string
  url: string
  videoId: string
  title: string
  description: string
  author: string
  duration: number
  viewCount: number
  likeCount: number
  shareCount: number
  commentCount: number
  musicTitle?: string
  musicAuthor?: string
  hashtags: string[]
  scrapedAt: string
  processingTime: number
}

export default function ResultsPage() {
  const [results, setResults] = useState<ScrapingResult[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'scrapedAt' | 'viewCount' | 'likeCount'>('scrapedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const fetchResults = async () => {
    try {
      const params = new URLSearchParams({
        search: searchTerm,
        sortBy,
        sortOrder
      })
      
      const response = await fetch(`/api/results?${params}`)
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

  const exportResults = async () => {
    try {
      const response = await fetch('/api/results?format=csv')
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
  }, [searchTerm, sortBy, sortOrder])

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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

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
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by title, author, or hashtags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex gap-4 items-center">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="scrapedAt">Sort by Date</option>
              <option value="viewCount">Sort by Views</option>
              <option value="likeCount">Sort by Likes</option>
            </select>
            
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
            
            <button
              onClick={exportResults}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-md hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 flex items-center gap-2"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Results Grid */}
      {results.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-6 text-center text-gray-500">
          {searchTerm ? 'No results match your search criteria.' : 'No scraped videos yet. Add URLs to the queue to get started.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.map((result) => (
            <div key={result.id} className="bg-white shadow rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-medium text-gray-900 line-clamp-2">
                    {result.title}
                  </h3>
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-purple-600 hover:text-purple-800"
                    title="View Original"
                  >
                    <EyeIcon className="h-4 w-4" />
                  </a>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Author:</span>
                    <span className="font-medium">@{result.author}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-medium">{formatDuration(result.duration)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Scraped:</span>
                    <span className="font-medium">
                      {new Date(result.scrapedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900">
                      {formatNumber(result.viewCount)}
                    </p>
                    <p className="text-xs text-gray-600">Views</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900">
                      {formatNumber(result.likeCount)}
                    </p>
                    <p className="text-xs text-gray-600">Likes</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900">
                      {formatNumber(result.shareCount)}
                    </p>
                    <p className="text-xs text-gray-600">Shares</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900">
                      {formatNumber(result.commentCount)}
                    </p>
                    <p className="text-xs text-gray-600">Comments</p>
                  </div>
                </div>
                
                {/* Music Info */}
                {result.musicTitle && (
                  <div className="mb-4 p-3 bg-purple-50 rounded-lg">
                    <p className="text-sm font-medium text-purple-900">
                      🎵 {result.musicTitle}
                    </p>
                    {result.musicAuthor && (
                      <p className="text-xs text-purple-700">
                        by {result.musicAuthor}
                      </p>
                    )}
                  </div>
                )}
                
                {/* Hashtags */}
                {result.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {result.hashtags.slice(0, 3).map((hashtag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
                      >
                        #{hashtag}
                      </span>
                    ))}
                    {result.hashtags.length > 3 && (
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                        +{result.hashtags.length - 3} more
                      </span>
                    )}
                  </div>
                )}
                
                {/* Description */}
                {result.description && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm text-gray-600 line-clamp-3">
                      {result.description}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Results Summary */}
      <div className="mt-6 bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">{results.length}</p>
            <p className="text-sm text-gray-600">Total Results</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">
              {formatNumber(results.reduce((sum, r) => sum + r.viewCount, 0))}
            </p>
            <p className="text-sm text-gray-600">Total Views</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {formatNumber(results.reduce((sum, r) => sum + r.likeCount, 0))}
            </p>
            <p className="text-sm text-gray-600">Total Likes</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">
              {results.length > 0 ? 
                (results.reduce((sum, r) => sum + r.processingTime, 0) / results.length / 1000).toFixed(1) : 0
              }s
            </p>
            <p className="text-sm text-gray-600">Avg Processing Time</p>
          </div>
        </div>
      </div>
    </div>
  )
} 