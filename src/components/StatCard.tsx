'use client'

import { ReactNode } from 'react'

interface StatCardProps {
  title: string
  value: string | number
  icon: ReactNode
  description?: string
  trend?: {
    value: number
    label: string
    positive: boolean
  }
  className?: string
}

export default function StatCard({ 
  title, 
  value, 
  icon, 
  description, 
  trend,
  className = ""
}: StatCardProps) {
  return (
    <div className={`bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 hover:shadow-md transition-shadow ${className}`}>
      <div className="p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="flex items-center justify-center h-12 w-12 rounded-md bg-gradient-to-r from-purple-500 to-pink-500 text-white">
              {icon}
            </div>
          </div>
          <div className="ml-4 flex-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 truncate">
                  {title}
                </p>
                <p className="text-3xl font-bold text-gray-900">
                  {value}
                </p>
              </div>
              {trend && (
                <div className="flex items-center">
                  <span className={`text-sm font-medium ${
                    trend.positive ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {trend.positive ? '+' : '-'}{Math.abs(trend.value)}%
                  </span>
                </div>
              )}
            </div>
            {description && (
              <p className="mt-2 text-sm text-gray-500">
                {description}
              </p>
            )}
            {trend && (
              <p className="mt-1 text-xs text-gray-400">
                {trend.label}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 