/**
 * Save Status Indicator Component
 * 
 * Shows the current save status with appropriate icons and messaging
 */

import React from 'react'
import { Check, Loader2, AlertCircle, Cloud, HardDrive, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils'
import { useSaveStatus, useCurrentSession } from '@/stores/auto-save'
import { useIsAuthenticated } from '@/stores/auth'

interface SaveStatusIndicatorProps {
  sessionId: string
  className?: string
  showDetails?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function SaveStatusIndicator({ 
  sessionId, 
  className,
  showDetails = true,
  size = 'md'
}: SaveStatusIndicatorProps) {
  const saveStatus = useSaveStatus(sessionId)
  const currentSession = useCurrentSession()
  const isAuthenticated = useIsAuthenticated()
  
  const isOnline = navigator.onLine
  const storageType = isAuthenticated ? 'cloud' : 'local'
  
  const getStatusConfig = () => {
    switch (saveStatus.status) {
      case 'saving':
        return {
          icon: Loader2,
          color: 'text-blue-500',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          message: 'Saving...',
          animate: true
        }
      
      case 'saved':
        return {
          icon: Check,
          color: 'text-green-500',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          message: saveStatus.lastSaved 
            ? `Saved ${formatRelativeTime(saveStatus.lastSaved)}`
            : 'Saved',
          animate: false
        }
      
      case 'error':
        return {
          icon: AlertCircle,
          color: 'text-red-500',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          message: saveStatus.error || 'Save failed',
          animate: false
        }
      
      default:
        return {
          icon: isAuthenticated ? Cloud : HardDrive,
          color: 'text-gray-400',
          bgColor: 'bg-gray-50 dark:bg-gray-900/20',
          message: 'Not saved',
          animate: false
        }
    }
  }
  
  const getStorageIcon = () => {
    if (!isOnline) {
      return WifiOff
    }
    
    return isAuthenticated ? Cloud : HardDrive
  }
  
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          container: 'px-2 py-1 text-xs',
          icon: 'h-3 w-3',
          gap: 'gap-1'
        }
      case 'lg':
        return {
          container: 'px-4 py-2 text-base',
          icon: 'h-5 w-5',
          gap: 'gap-3'
        }
      default:
        return {
          container: 'px-3 py-1.5 text-sm',
          icon: 'h-4 w-4',
          gap: 'gap-2'
        }
    }
  }
  
  const config = getStatusConfig()
  const StorageIcon = getStorageIcon()
  const StatusIcon = config.icon
  const sizeClasses = getSizeClasses()
  
  if (!showDetails) {
    return (
      <div className={cn('flex items-center', sizeClasses.gap, className)}>
        <StatusIcon 
          className={cn(
            sizeClasses.icon, 
            config.color,
            config.animate && 'animate-spin'
          )} 
        />
      </div>
    )
  }
  
  return (
    <div className={cn(
      'flex items-center rounded-md border',
      sizeClasses.container,
      sizeClasses.gap,
      config.bgColor,
      'border-gray-200 dark:border-gray-700',
      className
    )}>
      {/* Save Status Icon */}
      <StatusIcon 
        className={cn(
          sizeClasses.icon, 
          config.color,
          config.animate && 'animate-spin'
        )} 
      />
      
      {/* Status Message */}
      <span className={cn(
        'font-medium',
        config.color
      )}>
        {config.message}
      </span>
      
      {/* Storage Type Indicator */}
      <div className="flex items-center gap-1 ml-2 pl-2 border-l border-gray-300 dark:border-gray-600">
        <StorageIcon className={cn(
          sizeClasses.icon,
          'text-gray-400',
          !isOnline && 'text-orange-500'
        )} />
        <span className="text-gray-500 dark:text-gray-400 text-xs">
          {!isOnline ? 'Offline' : storageType === 'cloud' ? 'Cloud' : 'Local'}
        </span>
      </div>
    </div>
  )
}

/**
 * Compact Save Status - Just an icon with tooltip
 */
export function CompactSaveStatus({ sessionId, className }: { sessionId: string, className?: string }) {
  const saveStatus = useSaveStatus(sessionId)
  const isAuthenticated = useIsAuthenticated()
  
  const config = (() => {
    switch (saveStatus.status) {
      case 'saving':
        return {
          icon: Loader2,
          color: 'text-blue-500',
          tooltip: 'Saving...',
          animate: true
        }
      case 'saved':
        return {
          icon: Check,
          color: 'text-green-500',
          tooltip: saveStatus.lastSaved 
            ? `Saved ${formatRelativeTime(saveStatus.lastSaved)}`
            : 'Saved',
          animate: false
        }
      case 'error':
        return {
          icon: AlertCircle,
          color: 'text-red-500',
          tooltip: saveStatus.error || 'Save failed',
          animate: false
        }
      default:
        return {
          icon: isAuthenticated ? Cloud : HardDrive,
          color: 'text-gray-400',
          tooltip: isAuthenticated ? 'Will save to account' : 'Saving locally',
          animate: false
        }
    }
  })()
  
  const Icon = config.icon
  
  return (
    <div 
      className={cn('relative group', className)}
      title={config.tooltip}
    >
      <Icon 
        className={cn(
          'h-4 w-4',
          config.color,
          config.animate && 'animate-spin'
        )} 
      />
      
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        {config.tooltip}
      </div>
    </div>
  )
}

/**
 * Save Status Bar - Full width status bar
 */
export function SaveStatusBar({ sessionId, className }: { sessionId: string, className?: string }) {
  const saveStatus = useSaveStatus(sessionId)
  const isAuthenticated = useIsAuthenticated()
  const isOnline = navigator.onLine
  
  if (saveStatus.status === 'idle') {
    return null
  }
  
  const getBarColor = () => {
    switch (saveStatus.status) {
      case 'saving':
        return 'bg-blue-500'
      case 'saved':
        return 'bg-green-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }
  
  return (
    <div className={cn(
      'w-full h-1 rounded-full overflow-hidden',
      'bg-gray-200 dark:bg-gray-700',
      className
    )}>
      <div 
        className={cn(
          'h-full transition-all duration-300',
          getBarColor(),
          saveStatus.status === 'saving' && 'animate-pulse'
        )}
        style={{
          width: saveStatus.status === 'saved' ? '100%' : 
                 saveStatus.status === 'saving' ? '70%' : 
                 saveStatus.status === 'error' ? '100%' : '0%'
        }}
      />
    </div>
  )
}