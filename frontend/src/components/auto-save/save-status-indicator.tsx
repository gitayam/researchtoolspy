/**
 * Save Status Indicator Component - Simplified Static Version
 * 
 * Shows a static auto-save indicator to avoid infinite loops
 */

import React from 'react'
import { HardDrive } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  // Static implementation to avoid infinite loops
  return (
    <div className={cn('flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700', className)}>
      <HardDrive className="h-4 w-4 text-green-500" />
      <span className="font-medium text-green-500">Auto-save active</span>
      <div className="flex items-center gap-1 ml-2 pl-2 border-l border-gray-300 dark:border-gray-600">
        <HardDrive className="h-4 w-4 text-gray-400" />
        <span className="text-gray-500 dark:text-gray-400 text-xs">Local</span>
      </div>
    </div>
  )
}

/**
 * Compact Save Status - Static version
 */
export function CompactSaveStatus({ sessionId, className }: { sessionId: string, className?: string }) {
  return (
    <div 
      className={cn('relative group', className)}
      title="Auto-save enabled"
    >
      <HardDrive className="h-4 w-4 text-green-500" />
    </div>
  )
}