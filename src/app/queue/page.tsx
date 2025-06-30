'use client'

import { useState, useEffect } from 'react'
import { PlusIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

interface QueueItem {
  id: string
  url: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  priority: number
  addedAt: string
  processedAt?: string
  error?: string
}

export default function QueuePage() {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [newUrl, setNewUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [addingUrl, setAddingUrl] = useState(false)

  const fetchQueue = async () => {
    try {
      const response = await fetch('/api/queue')
      if (response.ok) {
        const data = await response.json()
        setQueue(data)
      }
    } catch (error) {
      console.error('Failed to fetch queue:', error)
    } finally {
      setLoading(false)
    }
  }

  const addUrl = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUrl.trim()) return

    setAddingUrl(true)
    try {
      const response = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl.trim() })
      })
      
      if (response.ok) {
        setNewUrl('')
        fetchQueue() // Refresh the queue
      } else {
        alert('Failed to add URL to queue')
      }
    } catch (error) {
      console.error('Failed to add URL:', error)
      alert('Failed to add URL to queue')
    } finally {
      setAddingUrl(false)
    }
  }

  const removeItem = async (id: string) => {
    try {
      const response = await fetch(`/api/queue?id=${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        fetchQueue() // Refresh the queue
      } else {
        alert('Failed to remove item from queue')
      }
    } catch (error) {
      console.error('Failed to remove item:', error)
      alert('Failed to remove item from queue')
    }
  }

  const retryItem = async (id: string) => {
    try {
      const response = await fetch('/api/queue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'retry' })
      })
      
      if (response.ok) {
        fetchQueue() // Refresh the queue
      } else {
        alert('Failed to retry item')
      }
    } catch (error) {
      console.error('Failed to retry item:', error)
      alert('Failed to retry item')
    }
  }

  useEffect(() => {
    fetchQueue()
    // Set up polling for real-time updates
    const interval = setInterval(fetchQueue, 3000)
    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'status-pending'
      case 'processing': return 'status-processing'
      case 'completed': return 'status-completed'
      case 'failed': return 'status-failed'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
        <div className="bg-white shadow rounded-lg">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 border-b">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Queue Management</h1>
        <p className="mt-2 text-sm text-gray-600">
          Add TikTok URLs to the scraping queue and monitor their status
        </p>
      </div>

      {/* Add URL Form */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Add New URL</h2>
        <form onSubmit={addUrl} className="flex gap-4">
          <input
            type="url"
            placeholder="Enter TikTok URL (e.g., https://www.tiktok.com/@username/video/123456789)"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            required
          />
          <button
            type="submit"
            disabled={addingUrl}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-md hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {addingUrl ? (
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
            ) : (
              <PlusIcon className="h-4 w-4" />
            )}
            Add to Queue
          </button>
        </form>
      </div>

      {/* Queue List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Queue Items ({queue.length})</h2>
        </div>
        
        {queue.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No items in queue. Add a TikTok URL to get started.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {queue.map((item) => (
              <div key={item.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.status)}`}>
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </span>
                      <span className="text-sm text-gray-500">
                        Priority: {item.priority}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.url}
                    </p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                      <span>Added: {new Date(item.addedAt).toLocaleString()}</span>
                      {item.processedAt && (
                        <span>Processed: {new Date(item.processedAt).toLocaleString()}</span>
                      )}
                    </div>
                    {item.error && (
                      <p className="mt-2 text-sm text-red-600">
                        Error: {item.error}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    {item.status === 'failed' && (
                      <button
                        onClick={() => retryItem(item.id)}
                        className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md"
                        title="Retry"
                      >
                        <ArrowPathIcon className="h-4 w-4" />
                      </button>
                    )}
                    {item.status !== 'processing' && (
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md"
                        title="Remove"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 