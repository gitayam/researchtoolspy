/**
 * Save Status Indicator Component
 * 
 * Shows the current save status with appropriate icons and messaging
 */

import React, { useState, useEffect } from 'react'
import { Check, Loader2, AlertCircle, Cloud, HardDrive } from 'lucide-react'
import { cn } from '@/lib/utils'
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
  const isAuthenticated = useIsAuthenticated()
  const [mounted, setMounted] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  
  // Avoid hydration issues
  useEffect(() => {
    setMounted(true)
  }, [])
  
  if (!mounted) {
    // Return a stable placeholder during SSR
    return (
      <div className={cn('flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700', className)}>
        <HardDrive className="h-4 w-4 text-gray-400" />
        <span className="font-medium text-gray-400">Auto-save ready</span>
        <div className="flex items-center gap-1 ml-2 pl-2 border-l border-gray-300 dark:border-gray-600">
          <HardDrive className="h-4 w-4 text-gray-400" />
          <span className="text-gray-500 dark:text-gray-400 text-xs">Local</span>
        </div>
      </div>
    )
  }
  
  const getStatusConfig = () => {
    switch (saveStatus) {
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
          message: 'Auto-saved',
          animate: false
        }
      
      case 'error':
        return {
          icon: AlertCircle,
          color: 'text-red-500',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          message: 'Save failed',
          animate: false
        }
      
      default:
        return {
          icon: isAuthenticated ? Cloud : HardDrive,
          color: 'text-gray-400',
          bgColor: 'bg-gray-50 dark:bg-gray-900/20',
          message: 'Auto-save ready',
          animate: false
        }
    }
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
  const StatusIcon = config.icon
  const StorageIcon = isAuthenticated ? Cloud : HardDrive
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
          'text-gray-400'
        )} />
        <span className="text-gray-500 dark:text-gray-400 text-xs">
          {isAuthenticated ? 'Cloud' : 'Local'}
        </span>
      </div>
    </div>
  )
}

/**
 * Compact Save Status - Simplified version without complex state
 */
export function CompactSaveStatus({ sessionId, className }: { sessionId: string, className?: string }) {
  const isAuthenticated = useIsAuthenticated()
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  if (!mounted) {
    return <HardDrive className={cn('h-4 w-4 text-gray-400', className)} />
  }
  
  const Icon = isAuthenticated ? Cloud : HardDrive
  
  return (
    <div 
      className={cn('relative group', className)}
      title="Auto-save enabled"
    >
      <Icon className="h-4 w-4 text-gray-400" />
    </div>
  )
}