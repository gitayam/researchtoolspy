/**
 * Data Management Component
 *
 * UI for exporting, importing, and managing user data
 */

import { useState, useCallback } from 'react'
import { Download, Upload, Trash2, Shield, AlertTriangle, FileJson, Key } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { ExportType, ExportFormat } from '@/types/settings'

interface DataManagementProps {
  userHash: string
  workspaceId: string
}

export function DataManagement({ userHash, workspaceId }: DataManagementProps) {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [clearing, setClearing] = useState(false)

  // Export options
  const [exportType, setExportType] = useState<ExportType>('full')
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json')
  const [includeMetadata, setIncludeMetadata] = useState(true)
  const [includeComments, setIncludeComments] = useState(true)

  /**
   * Export data
   */
  const handleExport = useCallback(async () => {
    try {
      setExporting(true)

      const response = await fetch('/api/settings/data/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Hash': userHash,
        },
        body: JSON.stringify({
          export_type: exportType,
          format: exportFormat,
          workspace_id: exportType === 'workspace' ? workspaceId : undefined,
          include_metadata: includeMetadata,
          include_comments: includeComments,
        }),
      })

      if (!response.ok) {
        throw new Error('Export failed')
      }

      // Download the file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `omnicore_export_${Date.now()}.${exportFormat}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export data. Please try again.')
    } finally {
      setExporting(false)
    }
  }, [userHash, workspaceId, exportType, exportFormat, includeMetadata, includeComments])

  /**
   * Import data from file
   */
  const handleImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setImporting(true)

      const text = await file.text()
      const data = JSON.parse(text)

      const response = await fetch('/api/settings/data/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Hash': userHash,
        },
        body: JSON.stringify({
          data,
          options: {
            merge: true,
            overwrite: false,
            import_settings: true,
            import_workspaces: true,
            import_frameworks: true,
            import_evidence: true,
            import_analyses: true,
          },
        }),
      })

      if (!response.ok) {
        throw new Error('Import failed')
      }

      const result = await response.json()
      alert(`Successfully imported: ${JSON.stringify(result.imported_count, null, 2)}`)

      // Reload page to refresh data
      window.location.reload()
    } catch (error) {
      console.error('Import error:', error)
      alert('Failed to import data. Please check the file format and try again.')
    } finally {
      setImporting(false)
      // Reset file input
      event.target.value = ''
    }
  }, [userHash])

  /**
   * Clear workspace data
   */
  const handleClearData = useCallback(async () => {
    try {
      setClearing(true)

      const response = await fetch(`/api/settings/data/workspace/${workspaceId}`, {
        method: 'DELETE',
        headers: {
          'X-User-Hash': userHash,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to clear data')
      }

      alert('Workspace data cleared successfully')
      setClearDialogOpen(false)

      // Reload page
      window.location.reload()
    } catch (error) {
      console.error('Clear data error:', error)
      alert('Failed to clear workspace data. Please try again.')
    } finally {
      setClearing(false)
    }
  }, [userHash, workspaceId])

  /**
   * Download hash backup
   */
  const handleDownloadHashBackup = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/hash/backup', {
        method: 'POST',
        headers: {
          'X-User-Hash': userHash,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to generate backup')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `omnicore_hash_backup_${Date.now()}.txt`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Backup error:', error)
      alert('Failed to generate hash backup. Please try again.')
    }
  }, [userHash])

  return (
    <div className="space-y-6">
      {/* Export Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Data
          </CardTitle>
          <CardDescription>
            Download your data in various formats for backup or migration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Export Type</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={exportType}
                onChange={(e) => setExportType(e.target.value as ExportType)}
              >
                <option value="full">Full Export - Everything</option>
                <option value="workspace">Current Workspace Only</option>
                <option value="settings">Settings Only</option>
                <option value="frameworks">Frameworks Only</option>
                <option value="evidence">Evidence Only</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Format</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
              >
                <option value="json">JSON - Full fidelity</option>
                <option value="csv">CSV - Tabular data</option>
                <option value="excel">Excel - Spreadsheet</option>
                <option value="pdf">PDF - Reports</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Options</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-metadata"
                  checked={includeMetadata}
                  onCheckedChange={(checked) => setIncludeMetadata(checked as boolean)}
                />
                <label
                  htmlFor="include-metadata"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Include metadata (timestamps, IDs, etc.)
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-comments"
                  checked={includeComments}
                  onCheckedChange={(checked) => setIncludeComments(checked as boolean)}
                />
                <label
                  htmlFor="include-comments"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Include comments and annotations
                </label>
              </div>
            </div>
          </div>

          <Button onClick={handleExport} disabled={exporting} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Exporting...' : 'Export Data'}
          </Button>
        </CardContent>
      </Card>

      {/* Import Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Data
          </CardTitle>
          <CardDescription>
            Import previously exported data or migrate from another account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <FileJson className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium">Import Instructions</p>
                <ul className="mt-1 ml-4 list-disc space-y-1">
                  <li>Only JSON exports are supported for import</li>
                  <li>Existing data will be merged (not overwritten)</li>
                  <li>Duplicate items will be skipped</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              disabled={importing}
              className="hidden"
              id="import-file"
            />
            <Label htmlFor="import-file">
              <Button asChild disabled={importing} className="w-full">
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  {importing ? 'Importing...' : 'Select File to Import'}
                </span>
              </Button>
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Hash Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Hash Backup
          </CardTitle>
          <CardDescription>
            Download a backup of your account hash for recovery
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium">Critical: Store Securely</p>
                <p className="mt-1">
                  Your account hash is the ONLY way to access your data. Store this backup in a secure location like a password manager. No recovery is possible if lost.
                </p>
              </div>
            </div>
          </div>

          <Button onClick={handleDownloadHashBackup} variant="outline" className="w-full">
            <Key className="h-4 w-4 mr-2" />
            Download Hash Backup
          </Button>
        </CardContent>
      </Card>

      {/* Clear Data */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions that permanently delete data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5" />
              <div className="text-sm text-red-800 dark:text-red-200">
                <p className="font-medium">Warning: Permanent Deletion</p>
                <p className="mt-1">
                  This will permanently delete ALL data in your current workspace. This action cannot be undone.
                </p>
              </div>
            </div>
          </div>

          <Button
            variant="destructive"
            onClick={() => setClearDialogOpen(true)}
            className="w-full"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Current Workspace
          </Button>
        </CardContent>
      </Card>

      {/* Clear Confirmation Dialog */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Workspace Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete:
              <ul className="mt-2 ml-4 list-disc space-y-1">
                <li>All frameworks and analyses</li>
                <li>All evidence and datasets</li>
                <li>All comments and annotations</li>
                <li>All reports and exports</li>
              </ul>
              <p className="mt-3 font-medium text-destructive">
                This action cannot be undone. Make sure you have exported any data you want to keep.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearData}
              disabled={clearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearing ? 'Clearing...' : 'Yes, Delete Everything'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
