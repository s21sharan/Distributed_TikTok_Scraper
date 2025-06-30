'use client'

import { useState, useEffect } from 'react'
import StatCard from '@/components/StatCard'
import { 
  QueueListIcon, 
  CpuChipIcon, 
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

interface Stats {
  totalInQueue: number
  activeWorkers: number
  totalResults: number
  recentlyCompleted: number
  pendingTasks: number
  failedTasks: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalInQueue: 0,
    activeWorkers: 0,
    totalResults: 0,
    recentlyCompleted: 0,
    pendingTasks: 0,
    failedTasks: 0
  })
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    // Set up polling for real-time updates
    const interval = setInterval(fetchStats, 5000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="mb-6">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white shadow rounded-lg p-6">
              <div className="h-12 bg-gray-200 rounded mb-4"></div>
              <div className="h-6 bg-gray-200 rounded mb-2"></div>
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
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Overview of your TikTok scraping operations
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <StatCard
          title="Queue Items"
          value={stats.totalInQueue}
          icon={<QueueListIcon className="h-6 w-6" />}
          description="Total videos in queue"
        />
        
        <StatCard
          title="Active Workers"
          value={stats.activeWorkers}
          icon={<CpuChipIcon className="h-6 w-6" />}
          description="Currently running workers"
        />
        
        <StatCard
          title="Total Results"
          value={stats.totalResults}
          icon={<DocumentTextIcon className="h-6 w-6" />}
          description="Scraped videos in database"
        />
        
        <StatCard
          title="Pending Tasks"
          value={stats.pendingTasks}
          icon={<ClockIcon className="h-6 w-6" />}
          description="Waiting to be processed"
        />
        
        <StatCard
          title="Completed Today"
          value={stats.recentlyCompleted}
          icon={<CheckCircleIcon className="h-6 w-6" />}
          description="Successfully processed"
        />
        
        <StatCard
          title="Failed Tasks"
          value={stats.failedTasks}
          icon={<ExclamationTriangleIcon className="h-6 w-6" />}
          description="Requires attention"
        />
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">System Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Queue Status</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pending</span>
                <span className="px-2 py-1 text-xs rounded-full status-pending">
                  {stats.pendingTasks}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Processing</span>
                <span className="px-2 py-1 text-xs rounded-full status-processing">
                  {stats.activeWorkers}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Failed</span>
                <span className="px-2 py-1 text-xs rounded-full status-failed">
                  {stats.failedTasks}
                </span>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Performance</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Success Rate</span>
                <span className="text-sm font-medium text-green-600">
                  {stats.totalResults > 0 ? 
                    Math.round((stats.recentlyCompleted / (stats.recentlyCompleted + stats.failedTasks)) * 100) : 0
                  }%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Average per Worker</span>
                <span className="text-sm font-medium text-blue-600">
                  {stats.activeWorkers > 0 ? Math.round(stats.totalResults / stats.activeWorkers) : 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 