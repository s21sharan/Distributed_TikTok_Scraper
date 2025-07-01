'use client'

import { useState, useEffect } from 'react'
import { PlayIcon, PauseIcon, StopIcon, CpuChipIcon } from '@heroicons/react/24/outline'

interface Worker {
  id: string
  name: string
  status: 'idle' | 'running' | 'paused' | 'stopped' | 'error'
  currentTask?: string
  tasksCompleted: number
  startedAt: string
  lastActivity?: string
  host: string
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)

  const fetchWorkers = async () => {
    try {
      const response = await fetch('/api/workers')
      if (response.ok) {
        const data = await response.json()
        setWorkers(data)
      }
    } catch (error) {
      console.error('Failed to fetch workers:', error)
    } finally {
      setLoading(false)
    }
  }

  const controlWorker = async (workerId: string, action: 'start' | 'pause' | 'stop') => {
    try {
      const response = await fetch('/api/workers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId, action })
      })
      
      if (response.ok) {
        fetchWorkers() // Refresh workers list
      } else {
        alert(`Failed to ${action} worker`)
      }
    } catch (error) {
      console.error(`Failed to ${action} worker:`, error)
      alert(`Failed to ${action} worker`)
    }
  }





  useEffect(() => {
    fetchWorkers()
    // Set up polling for real-time updates
    const interval = setInterval(fetchWorkers, 3000)
    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-100 text-green-800'
      case 'paused': return 'bg-yellow-100 text-yellow-800'
      case 'stopped': return 'bg-red-100 text-red-800'
      case 'idle': return 'bg-blue-100 text-blue-800'
      case 'error': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <PlayIcon className="h-4 w-4 text-green-600" />
      case 'paused': return <PauseIcon className="h-4 w-4 text-yellow-600" />
      case 'stopped': return <StopIcon className="h-4 w-4 text-red-600" />
      case 'idle': return <CpuChipIcon className="h-4 w-4 text-blue-600" />
      case 'error': return <StopIcon className="h-4 w-4 text-red-600" />
      default: return <CpuChipIcon className="h-4 w-4 text-gray-600" />
    }
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
              <div className="h-8 bg-gray-200 rounded mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const runningWorkers = workers.filter(w => w.status === 'running').length
  const totalTasks = workers.reduce((sum, w) => sum + w.tasksCompleted, 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Worker Management</h1>
        <p className="mt-2 text-sm text-gray-600">
          Monitor and control TikTok scraper workers across your infrastructure
        </p>
      </div>

      {/* Worker Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <CpuChipIcon className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Workers</p>
              <p className="text-2xl font-bold text-gray-900">{workers.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <PlayIcon className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Running</p>
              <p className="text-2xl font-bold text-gray-900">{runningWorkers}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <PauseIcon className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Paused</p>
              <p className="text-2xl font-bold text-gray-900">
                {workers.filter(w => w.status === 'paused').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <StopIcon className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Stopped</p>
              <p className="text-2xl font-bold text-gray-900">
                {workers.filter(w => w.status === 'stopped').length}
              </p>
            </div>
          </div>
        </div>
      </div>



      {/* Workers Grid */}
      {workers.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-6 text-center text-gray-500">
          No workers available. Start workers from the command line to see them here.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workers.map((worker) => (
            <div key={worker.id} className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {getStatusIcon(worker.status)}
                  <h3 className="text-lg font-medium text-gray-900">{worker.name}</h3>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(worker.status)}`}>
                  {worker.status.charAt(0).toUpperCase() + worker.status.slice(1)}
                </span>
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Host:</span>
                  <span className="font-medium">{worker.host}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tasks Completed:</span>
                  <span className="font-medium">{worker.tasksCompleted}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Started:</span>
                  <span className="font-medium">
                    {new Date(worker.startedAt).toLocaleDateString()}
                  </span>
                </div>
                {worker.lastActivity && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Last Activity:</span>
                    <span className="font-medium">
                      {new Date(worker.lastActivity).toLocaleTimeString()}
                    </span>
                  </div>
                )}
                {worker.currentTask && (
                  <div className="text-sm">
                    <span className="text-gray-600">Current Task:</span>
                    <p className="font-medium text-purple-600 truncate mt-1">
                      {worker.currentTask}
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                {(worker.status === 'stopped' || worker.status === 'idle') && (
                  <button
                    onClick={() => controlWorker(worker.id, 'start')}
                    className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center justify-center gap-1"
                  >
                    <PlayIcon className="h-4 w-4" />
                    Start
                  </button>
                )}
                
                {worker.status === 'running' && (
                  <button
                    onClick={() => controlWorker(worker.id, 'pause')}
                    className="flex-1 px-3 py-2 bg-yellow-600 text-white text-sm rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 flex items-center justify-center gap-1"
                  >
                    <PauseIcon className="h-4 w-4" />
                    Pause
                  </button>
                )}
                
                {worker.status === 'paused' && (
                  <button
                    onClick={() => controlWorker(worker.id, 'start')}
                    className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center justify-center gap-1"
                  >
                    <PlayIcon className="h-4 w-4" />
                    Resume
                  </button>
                )}
                
                {worker.status !== 'stopped' && (
                  <button
                    onClick={() => controlWorker(worker.id, 'stop')}
                    className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 flex items-center justify-center gap-1"
                  >
                    <StopIcon className="h-4 w-4" />
                    Stop
                  </button>
                )}
                

              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 