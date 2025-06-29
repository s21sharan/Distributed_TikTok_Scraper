import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { 
  Play, Pause, CheckCircle, XCircle, Clock, 
  Download, Eye, Heart, MessageCircle, Bookmark,
  User, ExternalLink
} from 'lucide-react';

const JobCard = ({ job, getStatusColor, onDownload }) => {
  const formatTime = (timestamp) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  const getProgressPercentage = () => {
    if (!job.total_videos || job.total_videos === 0) return 0;
    return Math.round((job.processed_videos / job.total_videos) * 100);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'running':
        return <Play className="h-4 w-4" />;
      case 'assigned':
        return <Clock className="h-4 w-4" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      case 'pending':
        return <Pause className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const canDownload = job.status === 'completed' && job.processed_videos > 0;

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center mb-1">
            <User className="h-4 w-4 text-gray-400 mr-2" />
            <h3 className="font-medium text-gray-900 truncate">
              @{job.profile_username || 'Unknown'}
            </h3>
            <span className="ml-2 text-sm text-gray-500">
              #{job.id}
            </span>
          </div>
          <p className="text-sm text-gray-500 truncate" title={job.url}>
            {job.url}
          </p>
        </div>
        
        <div className="flex items-center space-x-2 ml-4">
          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
            {getStatusIcon(job.status)}
            <span className="ml-1 capitalize">{job.status}</span>
          </div>
          
          {canDownload && (
            <button
              onClick={() => onDownload(job.id)}
              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
              title="Download results"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            title="Open TikTok profile"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Progress Section */}
      {(job.status === 'running' || job.status === 'assigned' || job.status === 'completed') && job.total_videos > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Progress</span>
            <span className="text-gray-900">
              {job.processed_videos}/{job.total_videos} videos ({getProgressPercentage()}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                job.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
        </div>
      )}

      {/* Job Details */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Created:</span>
          <span className="text-gray-900">
            {formatTime(job.created_at)}
          </span>
        </div>
        
        {job.started_at && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Started:</span>
            <span className="text-gray-900">
              {formatTime(job.started_at)}
            </span>
          </div>
        )}

        {job.completed_at && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Completed:</span>
            <span className="text-gray-900">
              {formatTime(job.completed_at)}
            </span>
          </div>
        )}

        {job.assigned_worker_id && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Worker:</span>
            <span className="text-blue-600 font-mono text-xs">
              {job.assigned_worker_id.slice(0, 8)}...
            </span>
          </div>
        )}
      </div>

      {/* Video Statistics */}
      {job.status === 'completed' && job.processed_videos > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center">
              <Eye className="h-4 w-4 text-gray-400 mr-1" />
              <span className="text-gray-500">Videos:</span>
              <span className="ml-1 font-medium text-gray-900">
                {job.processed_videos.toLocaleString()}
              </span>
            </div>
            
            {job.failed_videos > 0 && (
              <div className="flex items-center">
                <XCircle className="h-4 w-4 text-red-400 mr-1" />
                <span className="text-gray-500">Failed:</span>
                <span className="ml-1 font-medium text-red-600">
                  {job.failed_videos}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {job.status === 'failed' && job.error_message && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <div className="flex">
              <XCircle className="h-5 w-5 text-red-400 mr-2 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-red-800">Error</h4>
                <p className="text-sm text-red-600 mt-1">
                  {job.error_message}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Running Status Message */}
      {job.status === 'running' && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="flex">
              <Play className="h-5 w-5 text-blue-400 mr-2 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-800">In Progress</h4>
                <p className="text-sm text-blue-600 mt-1">
                  Scraping TikTok profile...
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobCard; 