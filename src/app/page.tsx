'use client'

import { useState, useEffect } from 'react'
import StatCard from '@/components/StatCard'
import { 
  QueueListIcon, 
  CpuChipIcon, 
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  ChartBarIcon,
  UsersIcon,
  VideoCameraIcon
} from '@heroicons/react/24/outline'

interface Stats {
  totalInQueue: number
  activeWorkers: number
  totalResults: number
  recentlyCompleted: number
  pendingTasks: number
  failedTasks: number
  totalWorkers: number
  totalProcessing: number
  totalCompleted: number
  uptime: number
  scrapingResults: number
  successRate: number
  avgVideosPerResult: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalInQueue: 0,
    activeWorkers: 0,
    totalResults: 0,
    recentlyCompleted: 0,
    pendingTasks: 0,
    failedTasks: 0,
    totalWorkers: 0,
    totalProcessing: 0,
    totalCompleted: 0,
    uptime: 0,
    scrapingResults: 0,
    successRate: 0,
    avgVideosPerResult: 0
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

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `${days}d ${hours % 24}h`
    }
    return `${hours}h ${minutes}m`
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="mb-6">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
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

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <StatCard
          title="Queue Items"
          value={formatNumber(stats.totalInQueue)}
          icon={<QueueListIcon className="h-6 w-6" />}
          description="Total items in queue"
          trend={stats.pendingTasks > 0 ? {
            value: stats.pendingTasks,
            label: "pending",
            positive: false
          } : undefined}
        />
        
        <StatCard
          title="Active Workers"
          value={stats.activeWorkers}
          icon={<CpuChipIcon className="h-6 w-6" />}
          description={`${stats.totalWorkers} total workers`}
          trend={stats.activeWorkers > 0 ? {
            value: Math.round((stats.activeWorkers / Math.max(stats.totalWorkers, 1)) * 100),
            label: "utilization",
            positive: true
          } : undefined}
        />
        
        <StatCard
          title="Videos Scraped"
          value={formatNumber(stats.totalResults)}
          icon={<VideoCameraIcon className="h-6 w-6" />}
          description={`From ${stats.scrapingResults} operations`}
          trend={stats.avgVideosPerResult > 0 ? {
            value: stats.avgVideosPerResult,
            label: "avg per operation",
            positive: true
          } : undefined}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <StatCard
          title="Pending Tasks"
          value={stats.pendingTasks}
          icon={<ClockIcon className="h-6 w-6" />}
          description="Waiting to be processed"
          className={stats.pendingTasks > 10 ? "border-l-4 border-l-yellow-500" : ""}
        />
        
        <StatCard
          title="Completed Today"
          value={stats.recentlyCompleted}
          icon={<CheckCircleIcon className="h-6 w-6" />}
          description="Successfully processed (24h)"
          className={stats.recentlyCompleted > 0 ? "border-l-4 border-l-green-500" : ""}
        />
        
        <StatCard
          title="Failed Tasks"
          value={stats.failedTasks}
          icon={<ExclamationTriangleIcon className="h-6 w-6" />}
          description="Requires attention"
          className={stats.failedTasks > 0 ? "border-l-4 border-l-red-500" : ""}
        />
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Queue Status */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <QueueListIcon className="h-5 w-5" />
            Queue Status
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Pending</span>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 text-sm rounded-full bg-yellow-100 text-yellow-800 font-medium">
                  {stats.pendingTasks}
                </span>
                <div className="w-20 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: stats.totalInQueue > 0 
                        ? `${Math.min((stats.pendingTasks / stats.totalInQueue) * 100, 100)}%` 
                        : '0%' 
                    }}
                  ></div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Processing</span>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-800 font-medium">
                  {stats.totalProcessing}
                </span>
                <div className="w-20 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: stats.totalInQueue > 0 
                        ? `${Math.min((stats.totalProcessing / stats.totalInQueue) * 100, 100)}%` 
                        : '0%' 
                    }}
                  ></div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Completed</span>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 text-sm rounded-full bg-green-100 text-green-800 font-medium">
                  {stats.totalCompleted}
                </span>
                <div className="w-20 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: stats.totalInQueue > 0 
                        ? `${Math.min((stats.totalCompleted / stats.totalInQueue) * 100, 100)}%` 
                        : '0%' 
                    }}
                  ></div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Failed</span>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 text-sm rounded-full bg-red-100 text-red-800 font-medium">
                  {stats.failedTasks}
                </span>
                <div className="w-20 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-red-500 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: stats.totalInQueue > 0 
                        ? `${Math.min((stats.failedTasks / stats.totalInQueue) * 100, 100)}%` 
                        : '0%' 
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <ChartBarIcon className="h-5 w-5" />
            Performance Metrics
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Success Rate</span>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${
                  stats.successRate >= 80 ? 'text-green-600' : 
                  stats.successRate >= 60 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {stats.successRate}%
                </span>
                <div className="w-20 bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      stats.successRate >= 80 ? 'bg-green-500' : 
                      stats.successRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(stats.successRate, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Worker Utilization</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-blue-600">
                  {stats.totalWorkers > 0 ? Math.round((stats.activeWorkers / stats.totalWorkers) * 100) : 0}%
                </span>
                <div className="w-20 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: stats.totalWorkers > 0 
                        ? `${Math.min((stats.activeWorkers / stats.totalWorkers) * 100, 100)}%` 
                        : '0%' 
                    }}
                  ></div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Avg Videos/Operation</span>
              <span className="text-sm font-bold text-purple-600">
                {stats.avgVideosPerResult}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Operations</span>
              <span className="text-sm font-bold text-gray-900">
                {formatNumber(stats.scrapingResults)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 shadow rounded-lg p-6 text-white">
        <h2 className="text-lg font-medium mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/queue"
            className="bg-white bg-opacity-20 hover:bg-opacity-30 transition-colors rounded-lg p-4 text-center"
          >
            <QueueListIcon className="h-8 w-8 mx-auto mb-2" />
            <div className="font-medium">Manage Queue</div>
            <div className="text-sm opacity-90">Add URLs & monitor progress</div>
          </a>
          
          <a
            href="/workers"
            className="bg-white bg-opacity-20 hover:bg-opacity-30 transition-colors rounded-lg p-4 text-center"
          >
            <UsersIcon className="h-8 w-8 mx-auto mb-2" />
            <div className="font-medium">Manage Workers</div>
            <div className="text-sm opacity-90">Control scraping workers</div>
          </a>
          
          <a
            href="/results"
            className="bg-white bg-opacity-20 hover:bg-opacity-30 transition-colors rounded-lg p-4 text-center"
          >
            <DocumentTextIcon className="h-8 w-8 mx-auto mb-2" />
            <div className="font-medium">View Results</div>
            <div className="text-sm opacity-90">Browse & download data</div>
          </a>
        </div>
      </div>
    </div>
  )
} 