import React from 'react';

const StatsCard = ({ title, value, icon, color, subtitle }) => {
  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="flex items-center">
        <div className={`flex-shrink-0 p-3 rounded-lg ${color} text-white`}>
          {icon}
        </div>
        <div className="ml-4 flex-1">
          <div className="text-sm font-medium text-gray-500 truncate">
            {title}
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
          {subtitle && (
            <div className="text-xs text-gray-400 mt-1">
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatsCard; 