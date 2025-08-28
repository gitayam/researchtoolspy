/**
 * Auto-save indicator component
 * Shows the current auto-save status to users
 */

import React from 'react'
import { CheckCircle, Clock, AlertCircle, Save } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AutoSaveStatus {
  status: 'idle' | 'saving' | 'saved' | 'error'
  lastSaved?: Date
  error?: string
}

interface AutoSaveIndicatorProps {
  status: AutoSaveStatus
  className?: string
}

export function AutoSaveIndicator({ status, className }: AutoSaveIndicatorProps) {
  const getIcon = () => {
    switch (status.status) {
      case 'saving':
        return <Save className="h-4 w-4 animate-pulse" />
      case 'saved':
        return <CheckCircle className="h-4 w-4" />
      case 'error':
        return <AlertCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getText = () => {
    switch (status.status) {
      case 'saving':
        return 'Saving...'
      case 'saved':
        return status.lastSaved 
          ? `Saved ${formatTimeAgo(status.lastSaved)}`
          : 'Saved'
      case 'error':
        return status.error || 'Save failed'
      default:
        return 'Not saved'
    }
  }

  const getColorClasses = () => {
    switch (status.status) {
      case 'saving':
        return 'text-blue-600 dark:text-blue-400'
      case 'saved':
        return 'text-green-600 dark:text-green-400'
      case 'error':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-gray-500 dark:text-gray-400'
    }
  }

  return (
    <div className={cn(
      'flex items-center space-x-2 text-sm',
      getColorClasses(),
      className
    )}>
      {getIcon()}
      <span>{getText()}</span>
    </div>
  )
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)

  if (diffSeconds < 60) {
    return 'just now'
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else {
    return date.toLocaleDateString()
  }
}