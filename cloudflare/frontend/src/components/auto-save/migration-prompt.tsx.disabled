/**
 * Migration Prompt Component
 * 
 * Handles the user experience for migrating anonymous work to authenticated accounts
 */

import React, { useState } from 'react'
import { Upload, Download, X, AlertTriangle, Clock, FileText, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import { 
  usePendingMigration, 
  useMigrationInProgress, 
  useAutoSaveActions 
} from '@/stores/auto-save'
import { formatRelativeTime } from '@/lib/utils'
import type { FrameworkSession } from '@/services/auto-save'

interface MigrationPromptProps {
  onComplete?: () => void
  onDismiss?: () => void
  compact?: boolean
}

export function MigrationPrompt({ 
  onComplete, 
  onDismiss, 
  compact = false 
}: MigrationPromptProps) {
  const { toast } = useToast()
  const pendingMigration = usePendingMigration()
  const migrationInProgress = useMigrationInProgress()
  const { startMigration, dismissMigration, clearAnonymousData } = useAutoSaveActions()
  
  const [selectedSessions, setSelectedSessions] = useState<string[]>([])
  const [showDetails, setShowDetails] = useState(false)
  
  if (pendingMigration.length === 0) {
    return null
  }
  
  const handleMigrate = async () => {
    try {
      await startMigration()
      
      toast({
        title: 'Migration Complete',
        description: `Successfully saved ${pendingMigration.length} session(s) to your account`
      })
      
      onComplete?.()
    } catch (error) {
      toast({
        title: 'Migration Failed',
        description: 'Some sessions could not be saved. Please try again.',
        variant: 'destructive'
      })
    }
  }
  
  const handleDismiss = () => {
    dismissMigration()
    onDismiss?.()
  }
  
  const handleClearAll = () => {
    clearAnonymousData()
    
    toast({
      title: 'Local Data Cleared',
      description: 'All local work has been permanently deleted'
    })
    
    onDismiss?.()
  }
  
  const groupedSessions = pendingMigration.reduce((acc, session) => {
    if (!acc[session.frameworkType]) {
      acc[session.frameworkType] = []
    }
    acc[session.frameworkType].push(session)
    return acc
  }, {} as Record<string, FrameworkSession[]>)
  
  const totalSessions = pendingMigration.length
  const frameworkTypes = Object.keys(groupedSessions).length
  
  if (compact) {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Upload className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Save Your Work
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                You have {totalSessions} unsaved session(s) from when you weren't logged in.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleMigrate}
              disabled={migrationInProgress}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {migrationInProgress ? 'Saving...' : 'Save to Account'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="text-blue-600 hover:text-blue-800"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <Card className="border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg">
              <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-blue-900 dark:text-blue-100">
                Save Your Work to Account
              </CardTitle>
              <CardDescription className="text-blue-700 dark:text-blue-300 mt-1">
                You have unsaved work from when you weren't logged in. 
                Would you like to save it to your account?
              </CardDescription>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-blue-600 hover:text-blue-800 -mt-2 -mr-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <span className="font-medium">{totalSessions} sessions</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-white dark:bg-gray-800">
              {frameworkTypes} framework{frameworkTypes !== 1 ? 's' : ''}
            </Badge>
          </div>
        </div>
        
        {/* Details Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDetails(!showDetails)}
          className="text-blue-600 hover:text-blue-800 p-0 h-auto"
        >
          {showDetails ? 'Hide' : 'Show'} details
        </Button>
        
        {/* Session Details */}
        {showDetails && (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {Object.entries(groupedSessions).map(([frameworkType, sessions]) => (
              <div key={frameworkType} className="space-y-2">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 capitalize">
                  {frameworkType.replace('-', ' ')} ({sessions.length})
                </h4>
                
                <div className="space-y-1 ml-4">
                  {sessions.map((session) => (
                    <div 
                      key={session.id}
                      className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {session.title}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(session.lastModified)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        
        <Separator />
        
        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              onClick={handleMigrate}
              disabled={migrationInProgress}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Upload className="h-4 w-4 mr-2" />
              {migrationInProgress ? 'Saving...' : 'Save All to Account'}
            </Button>
            
            <Button
              variant="outline"
              onClick={handleDismiss}
              disabled={migrationInProgress}
            >
              Skip for Now
            </Button>
          </div>
          
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClearAll}
            disabled={migrationInProgress}
            className="text-xs"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Delete All
          </Button>
        </div>
        
        {/* Warning */}
        <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
          <div className="text-xs text-yellow-700 dark:text-yellow-300">
            <p className="font-medium">Important:</p>
            <p>
              Your work is currently saved locally in your browser. 
              If you clear your browser data or use a different device, 
              this work will be lost unless you save it to your account.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Migration Banner - Compact notification bar
 */
export function MigrationBanner({ className }: { className?: string }) {
  const pendingMigration = usePendingMigration()
  const { startMigration, dismissMigration } = useAutoSaveActions()
  const { toast } = useToast()
  
  if (pendingMigration.length === 0) {
    return null
  }
  
  const handleQuickSave = async () => {
    try {
      await startMigration()
      toast({
        title: 'Work Saved',
        description: 'Your local work has been saved to your account'
      })
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: 'Could not save your work. Please try again.',
        variant: 'destructive'
      })
    }
  }
  
  return (
    <div className={`bg-blue-600 text-white px-4 py-2 ${className}`}>
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Upload className="h-4 w-4" />
          <span className="text-sm font-medium">
            You have {pendingMigration.length} unsaved session(s) from before you logged in
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleQuickSave}
            className="text-xs"
          >
            Save to Account
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={dismissMigration}
            className="text-white hover:text-gray-200 text-xs"
          >
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  )
}