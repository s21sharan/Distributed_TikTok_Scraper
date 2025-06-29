import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { 
  Server, Globe, HardDrive, Activity, 
  CheckCircle, Clock, AlertCircle 
} from 'lucide-react';

const WorkerCard = ({ worker, getStatusColor }) => {
  const formatUptime = (connectedAt) => {
    try {
      return formatDistanceToNow(new Date(connectedAt), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'idle':
        return <CheckCircle className="h-4 w-4" />;
      case 'busy':
        return <Activity className="h-4 w-4" />;
      case 'offline':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center">
          <Server className="h-5 w-5 text-gray-400 mr-2" />
          <div>
            <h3 className="font-medium text-gray-900 truncate">
              {worker.hostname}
            </h3>
            <p className="text-sm text-gray-500 truncate">
              {worker.ip_address}
            </p>
          </div>
        </div>
        
        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(worker.status)}`}>
          {getStatusIcon(worker.status)}
          <span className="ml-1 capitalize">{worker.status}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Connected:</span>
          <span className="text-gray-900">
            {formatUptime(worker.connected_at)}
          </span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Jobs Completed:</span>
          <span className="text-gray-900">
            {worker.total_jobs_completed || 0}
          </span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Videos Scraped:</span>
          <span className="text-gray-900">
            {(worker.total_videos_scraped || 0).toLocaleString()}
          </span>
        </div>

        {worker.current_job_id && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Current Job:</span>
            <span className="text-blue-600 font-medium">
              #{worker.current_job_id}
            </span>
          </div>
        )}
      </div>

      {worker.capabilities && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex flex-wrap gap-1">
            {worker.capabilities.browser && (
              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                {worker.capabilities.browser}
              </span>
            )}
            {worker.capabilities.headless && (
              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                Headless
              </span>
            )}
            {worker.capabilities.features && worker.capabilities.features.includes('auto_scroll') && (
              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">
                Auto-scroll
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="text-xs text-gray-400 truncate">
          ID: {worker.id}
        </div>
      </div>
    </div>
  );
};

export default WorkerCard; 