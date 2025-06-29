import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import toast, { Toaster } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import {
  Users, Activity, CheckCircle, XCircle, Clock, Play, 
  Pause, Server, Zap, TrendingUp, Download, Plus,
  MonitorSpeaker, Globe, HardDrive, Eye
} from 'lucide-react';

import WorkerCard from './WorkerCard';
import JobCard from './JobCard';
import StatsCard from './StatsCard';
import JobForm from './JobForm';
import ProgressChart from './ProgressChart';

const Dashboard = () => {
  // State management
  const [systemStats, setSystemStats] = useState({
    total_workers: 0,
    active_workers: 0,
    idle_workers: 0,
    busy_workers: 0,
    offline_workers: 0,
    total_jobs: 0,
    pending_jobs: 0,
    running_jobs: 0,
    completed_jobs: 0,
    failed_jobs: 0,
    total_videos_scraped: 0
  });
  
  const [workers, setWorkers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [recentVideos, setRecentVideos] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const [showJobForm, setShowJobForm] = useState(false);
  const [logs, setLogs] = useState([]);

  // WebSocket connection
  useEffect(() => {
    const newSocket = io(window.location.origin, {
      transports: ['websocket']
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
      toast.success('Connected to server');
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
      toast.error('Disconnected from server');
    });

    // Real-time updates
    newSocket.on('dashboard_data', (data) => {
      console.log('Dashboard data received:', data);
      const dashboardData = data.data;
      
      setSystemStats(dashboardData.system_stats);
      setWorkers(dashboardData.workers || []);
      setJobs(dashboardData.active_jobs || []);
      setRecentVideos(dashboardData.recent_videos || []);
      setLogs(dashboardData.logs || []);
    });

    newSocket.on('worker_connected', (data) => {
      const { worker_id, worker_data } = data.data;
      setWorkers(prev => [...prev.filter(w => w.id !== worker_id), worker_data]);
      toast.success(`Worker ${worker_data.hostname} connected`);
      addLog(`Worker ${worker_data.hostname} (${worker_id}) connected`);
    });

    newSocket.on('worker_disconnected', (data) => {
      const { worker_id, reason } = data.data;
      setWorkers(prev => prev.filter(w => w.id !== worker_id));
      toast.error(`Worker disconnected: ${reason}`);
      addLog(`Worker ${worker_id} disconnected: ${reason}`);
    });

    newSocket.on('worker_status_update', (data) => {
      const { worker_id, status } = data.data;
      setWorkers(prev => 
        prev.map(w => w.id === worker_id ? { ...w, status } : w)
      );
    });

    newSocket.on('job_created', (data) => {
      const job = data.data;
      setJobs(prev => [job, ...prev]);
      toast.success(`New job created: ${job.profile_username}`);
      addLog(`Job ${job.id} created for ${job.profile_username}`);
    });

    newSocket.on('job_assigned', (data) => {
      const { job_id, worker_id } = data.data;
      setJobs(prev => 
        prev.map(j => j.id === job_id ? { ...j, assigned_worker_id: worker_id, status: 'assigned' } : j)
      );
      addLog(`Job ${job_id} assigned to worker ${worker_id}`);
    });

    newSocket.on('job_progress', (data) => {
      const progress = data.data;
      setJobs(prev => 
        prev.map(j => j.id === progress.job_id ? {
          ...j,
          total_videos: progress.total_videos,
          processed_videos: progress.processed_videos,
          failed_videos: progress.failed_videos,
          status: progress.status
        } : j)
      );
      
      if (progress.message) {
        addLog(`Job ${progress.job_id}: ${progress.message}`);
      }
    });

    newSocket.on('job_completed', (data) => {
      const { job_id } = data.data;
      toast.success(`Job ${job_id} completed successfully!`);
      addLog(`Job ${job_id} completed successfully`);
    });

    newSocket.on('job_failed', (data) => {
      const { job_id, error } = data.data;
      toast.error(`Job ${job_id} failed: ${error}`);
      addLog(`Job ${job_id} failed: ${error}`);
    });

    newSocket.on('system_stats', (data) => {
      setSystemStats(data.data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const addLog = useCallback((message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 99)]); // Keep last 100 logs
  }, []);

  // API calls
  const createJob = async (jobData) => {
    try {
      const response = await axios.post('/api/jobs', jobData);
      toast.success('Job created successfully!');
      setShowJobForm(false);
      return response.data;
    } catch (error) {
      toast.error(`Failed to create job: ${error.response?.data?.detail || error.message}`);
      throw error;
    }
  };

  const downloadJobResults = async (jobId) => {
    try {
      const response = await axios.get(`/api/jobs/${jobId}/download`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `job_${jobId}_results.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Results downloaded successfully!');
    } catch (error) {
      toast.error('Failed to download results');
    }
  };

  const getWorkerStatusColor = (status) => {
    switch (status) {
      case 'idle': return 'text-green-600 bg-green-100';
      case 'busy': return 'text-blue-600 bg-blue-100';
      case 'offline': return 'text-gray-600 bg-gray-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-yellow-600 bg-yellow-100';
    }
  };

  const getJobStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'running': return 'text-blue-600 bg-blue-100';
      case 'assigned': return 'text-purple-600 bg-purple-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <MonitorSpeaker className="h-8 w-8 text-indigo-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  TikTok Scraper Dashboard
                </h1>
                <p className="text-sm text-gray-500">
                  Real-time distributed scraping system
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-gray-600">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              
              <button
                onClick={() => setShowJobForm(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Job
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* System Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
          <StatsCard
            title="Total Workers"
            value={systemStats.total_workers}
            icon={<Server className="h-5 w-5" />}
            color="bg-blue-500"
          />
          <StatsCard
            title="Active Workers"
            value={systemStats.active_workers}
            icon={<Activity className="h-5 w-5" />}
            color="bg-green-500"
          />
          <StatsCard
            title="Total Jobs"
            value={systemStats.total_jobs}
            icon={<HardDrive className="h-5 w-5" />}
            color="bg-purple-500"
          />
          <StatsCard
            title="Running Jobs"
            value={systemStats.running_jobs}
            icon={<Play className="h-5 w-5" />}
            color="bg-blue-500"
          />
          <StatsCard
            title="Completed Jobs"
            value={systemStats.completed_jobs}
            icon={<CheckCircle className="h-5 w-5" />}
            color="bg-green-500"
          />
          <StatsCard
            title="Videos Scraped"
            value={systemStats.total_videos_scraped.toLocaleString()}
            icon={<Eye className="h-5 w-5" />}
            color="bg-indigo-500"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Workers Section */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900 flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Connected Workers ({workers.length})
                </h2>
              </div>
              <div className="p-6">
                {workers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Server className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No workers connected</p>
                    <p className="text-sm">Start a worker to begin scraping</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {workers.map((worker) => (
                      <WorkerCard 
                        key={worker.id} 
                        worker={worker}
                        getStatusColor={getWorkerStatusColor}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Jobs Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900 flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  Active Jobs ({jobs.length})
                </h2>
              </div>
              <div className="p-6">
                {jobs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <HardDrive className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No active jobs</p>
                    <p className="text-sm">Create a new job to start scraping</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {jobs.slice(0, 10).map((job) => (
                      <JobCard 
                        key={job.id} 
                        job={job}
                        getStatusColor={getJobStatusColor}
                        onDownload={downloadJobResults}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Activity Logs */}
        <div className="mt-8">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900 flex items-center">
                <Zap className="h-5 w-5 mr-2" />
                Activity Logs
              </h2>
            </div>
            <div className="p-6">
              <div className="bg-gray-900 rounded-lg p-4 h-64 overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="text-gray-400 text-center py-8">
                    <p>No activity logs yet</p>
                    <p className="text-sm">System events will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {logs.map((log, index) => (
                      <div key={index} className="text-green-400 font-mono text-sm">
                        {log}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Job Form Modal */}
      {showJobForm && (
        <JobForm
          onSubmit={createJob}
          onClose={() => setShowJobForm(false)}
        />
      )}
    </div>
  );
};

export default Dashboard; 