import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { generateAccountHash } from '@/lib/hash-auth'

interface CreateWorkspaceDialogProps {
  onWorkspaceCreated?: () => void
}

export function CreateWorkspaceDialog({ onWorkspaceCreated }: CreateWorkspaceDialogProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    type: 'TEAM' as 'PERSONAL' | 'TEAM' | 'PUBLIC',
  })

  const ensureUserHash = () => {
    let userHash = localStorage.getItem('omnicore_user_hash')

    if (!userHash || userHash === 'guest') {
      // Generate a new bookmark hash for guest users
      userHash = generateAccountHash()
      localStorage.setItem('omnicore_user_hash', userHash)
      localStorage.setItem('omnicore_authenticated', 'true')

      toast({
        title: 'Account Created',
        description: 'Your bookmark account has been created. Save this URL to access your work!',
      })
    }

    return userHash
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Workspace name is required',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)

    try {
      // Ensure user has a hash
      const userHash = ensureUserHash()

      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Hash': userHash,
        },
        body: JSON.stringify({
          name: formData.name,
          type: formData.type,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create workspace')
      }

      const data = await response.json()

      toast({
        title: 'Workspace Created',
        description: `${formData.name} has been created successfully`,
      })

      setOpen(false)
      setFormData({ name: '', type: 'TEAM' })

      // Store the new workspace ID (API returns workspace directly)
      localStorage.setItem('omnicore_workspace_id', data.id)

      // Refresh the page or call callback
      if (onWorkspaceCreated) {
        onWorkspaceCreated()
      } else {
        window.location.reload()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create workspace',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <Plus className="h-5 w-5 mr-2" />
          Create Workspace
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Workspace</DialogTitle>
          <DialogDescription>
            Set up a workspace to collaborate with your investigation team
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Workspace Name *</Label>
            <Input
              id="workspace-name"
              placeholder="e.g., Enemy COG Investigation, Threat Analysis Team"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspace-type">Workspace Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value: any) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger id="workspace-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PERSONAL">Personal (Private)</SelectItem>
                <SelectItem value="TEAM">Team (Invite-only)</SelectItem>
                <SelectItem value="PUBLIC">Public (Anyone can view)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {formData.type === 'PERSONAL' && 'Only you can access this workspace'}
              {formData.type === 'TEAM' && 'Invite team members to collaborate'}
              {formData.type === 'PUBLIC' && 'Anyone with the link can view (read-only)'}
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Note:</strong> If you're using guest mode, creating a workspace will generate a
              bookmark account hash for you. Make sure to save your browser URL to access your workspace again!
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Creating...' : 'Create Workspace'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
