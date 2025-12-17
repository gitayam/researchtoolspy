/**
 * Settings Page
 *
 * Main settings interface with tabbed navigation for all settings categories
 */

import { useState, useEffect, useCallback } from 'react'
import { Settings, Monitor, Briefcase, Sparkles, Database, AlertCircle } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { useSettings } from '@/hooks/useSettings'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { DisplayPreferences } from '@/components/settings/DisplayPreferences'
import { WorkspaceManagement } from '@/components/settings/WorkspaceManagement'
import { AIPreferences } from '@/components/settings/AIPreferences'
import { DataManagement } from '@/components/settings/DataManagement'
import type { WorkspaceType } from '@/types/settings'

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('display')
  const [updating, setUpdating] = useState(false)
  const { settings, loading, error, updateDisplaySettings, updateAISettings } = useSettings()
  const {
    workspaces,
    currentWorkspaceId,
    setCurrentWorkspaceId,
    setWorkspaces,
  } = useWorkspace()

  const userHash = typeof window !== 'undefined' ? localStorage.getItem('omnicore_user_hash') : null

  // Workspace management handlers
  const handleWorkspaceCreate = useCallback(
    async (name: string, type: WorkspaceType, description?: string) => {
      if (!userHash) return

      try {
        const response = await fetch('/api/settings/workspaces', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Hash': userHash,
          },
          body: JSON.stringify({ name, type, description }),
        })

        if (!response.ok) throw new Error('Failed to create workspace')

        const newWorkspace = await response.json()
        setWorkspaces([...workspaces, newWorkspace])
      } catch (error) {
        console.error('Create workspace error:', error)
        throw error
      }
    },
    [userHash, workspaces, setWorkspaces]
  )

  const handleWorkspaceDelete = useCallback(
    async (workspaceId: string) => {
      if (!userHash) return

      try {
        const response = await fetch(`/api/settings/workspaces/${workspaceId}`, {
          method: 'DELETE',
          headers: {
            'X-User-Hash': userHash,
          },
        })

        if (!response.ok) throw new Error('Failed to delete workspace')

        setWorkspaces(workspaces.filter((w) => w.id !== workspaceId))

        // If deleted current workspace, switch to first available
        if (workspaceId === currentWorkspaceId && workspaces.length > 0) {
          const remaining = workspaces.filter((w) => w.id !== workspaceId)
          if (remaining.length > 0) {
            setCurrentWorkspaceId(remaining[0].id)
          }
        }
      } catch (error) {
        console.error('Delete workspace error:', error)
        throw error
      }
    },
    [userHash, workspaces, currentWorkspaceId, setWorkspaces, setCurrentWorkspaceId]
  )

  const handleWorkspaceUpdate = useCallback(
    async (workspaceId: string, name: string, description?: string) => {
      if (!userHash) return

      try {
        const response = await fetch(`/api/settings/workspaces/${workspaceId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Hash': userHash,
          },
          body: JSON.stringify({ name, description }),
        })

        if (!response.ok) throw new Error('Failed to update workspace')

        const updated = await response.json()
        setWorkspaces(workspaces.map((w) => (w.id === workspaceId ? updated : w)))
      } catch (error) {
        console.error('Update workspace error:', error)
        throw error
      }
    },
    [userHash, workspaces, setWorkspaces]
  )

  // Wrap update handlers with loading state
  const handleDisplayUpdate = useCallback(
    async (updates: Parameters<typeof updateDisplaySettings>[0]) => {
      try {
        setUpdating(true)
        await updateDisplaySettings(updates)
      } finally {
        setUpdating(false)
      }
    },
    [updateDisplaySettings]
  )

  const handleAIUpdate = useCallback(
    async (updates: Parameters<typeof updateAISettings>[0]) => {
      try {
        setUpdating(true)
        await updateAISettings(updates)
      } finally {
        setUpdating(false)
      }
    },
    [updateAISettings]
  )

  // Show loading state
  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 dark:border-gray-700 border-t-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading settings...</p>
          </div>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">Failed to load settings</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show warning if no hash
  if (!userHash) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">No Account Hash</p>
                <p className="text-sm mt-1">
                  Please generate or enter your account hash to access settings.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your display preferences, workspaces, AI settings, and data
        </p>
      </div>

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 lg:grid-cols-4 w-full lg:w-auto">
          <TabsTrigger value="display" className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            <span className="hidden sm:inline">Display</span>
          </TabsTrigger>
          <TabsTrigger value="workspaces" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">Workspaces</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">AI</span>
          </TabsTrigger>
          <TabsTrigger value="data" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Data</span>
          </TabsTrigger>
        </TabsList>

        {/* Display Preferences Tab */}
        <TabsContent value="display" className="space-y-6">
          {settings && (
            <DisplayPreferences
              settings={settings.display}
              onUpdate={handleDisplayUpdate}
              updating={updating}
            />
          )}
        </TabsContent>

        {/* Workspace Management Tab */}
        <TabsContent value="workspaces" className="space-y-6">
          <WorkspaceManagement
            workspaces={workspaces.map(w => ({
              ...w,
              user_hash: userHash || '',
              is_default: w.id === '1',
              created_at: new Date().toISOString(),
              role: (w.role?.toLowerCase() as 'owner' | 'admin' | 'member' | 'viewer') || 'owner'
            }))}
            currentWorkspaceId={currentWorkspaceId}
            onWorkspaceChange={setCurrentWorkspaceId}
            onWorkspaceCreate={handleWorkspaceCreate}
            onWorkspaceDelete={handleWorkspaceDelete}
            onWorkspaceUpdate={handleWorkspaceUpdate}
          />
        </TabsContent>

        {/* AI Preferences Tab */}
        <TabsContent value="ai" className="space-y-6">
          {settings && (
            <AIPreferences
              settings={settings.ai}
              onUpdate={handleAIUpdate}
              updating={updating}
            />
          )}
        </TabsContent>

        {/* Data Management Tab */}
        <TabsContent value="data" className="space-y-6">
          <DataManagement userHash={userHash} workspaceId={currentWorkspaceId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
