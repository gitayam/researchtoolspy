/**
 * Investigation Packets Page
 * Manage multi-source investigation cases with claims, evidence, and entities
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Folder,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  Link as LinkIcon,
  Loader2
} from 'lucide-react'

interface InvestigationPacket {
  id: string
  title: string
  description?: string
  investigation_type?: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'active' | 'completed' | 'archived'
  category?: string
  tags: string[]
  created_at: string
  updated_at: string
  content_count: number
  claim_count: number
}

export function InvestigationPacketsPage() {
  const navigate = useNavigate()
  const [packets, setPackets] = useState<InvestigationPacket[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [investigationType, setInvestigationType] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')

  useEffect(() => {
    loadPackets()
  }, [])

  const loadPackets = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/investigation-packets/list', {
        credentials: 'include'
      })

      if (!response.ok) throw new Error('Failed to load packets')

      const data = await response.json()
      if (data.success) {
        setPackets(data.packets || [])
      }
    } catch (error) {
      console.error('Error loading packets:', error)
    } finally {
      setLoading(false)
    }
  }

  const createPacket = async () => {
    if (!title.trim()) {
      alert('Title is required')
      return
    }

    try {
      setCreating(true)
      const response = await fetch('/api/investigation-packets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          investigation_type: investigationType.trim() || undefined,
          priority,
          category: category.trim() || undefined,
          tags: tags.trim() ? tags.split(',').map(t => t.trim()).filter(Boolean) : []
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create packet')
      }

      const data = await response.json()
      if (data.success && data.packet) {
        // Navigate to the packet detail page
        navigate(`/investigations/${data.packet.id}`)
      }
    } catch (error) {
      console.error('Error creating packet:', error)
      alert(error instanceof Error ? error.message : 'Failed to create packet')
    } finally {
      setCreating(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
      case 'high': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
      case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'low': return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Clock className="h-4 w-4" />
      case 'completed': return <CheckCircle2 className="h-4 w-4" />
      case 'archived': return <Folder className="h-4 w-4" />
      default: return <AlertCircle className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
      case 'completed': return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
      case 'archived': return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Investigation Packets</h1>
          <p className="text-muted-foreground mt-2">
            Organize multi-source investigations with claims, evidence, and entities
          </p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Investigation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Investigation Packet</DialogTitle>
              <DialogDescription>
                Start a new investigation to organize claims across multiple sources
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title *</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Red Hat CVE-2024-1234 Investigation"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief overview of the investigation..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Investigation Type</label>
                  <Input
                    value={investigationType}
                    onChange={(e) => setInvestigationType(e.target.value)}
                    placeholder="e.g., Breach Analysis"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority</label>
                  <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g., Cybersecurity, Political, Financial"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Tags (comma-separated)</label>
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g., CVE-2024-1234, Red Hat, OpenSSL"
                />
              </div>

              <Button onClick={createPacket} disabled={creating} className="w-full">
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Investigation
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!loading && packets.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Folder className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="font-semibold text-lg">No investigations yet</h3>
                <p className="text-muted-foreground mt-1">
                  Create your first investigation packet to organize multi-source cases
                </p>
              </div>
              <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Investigation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Packets List */}
      {!loading && packets.length > 0 && (
        <div className="grid gap-4">
          {packets.map((packet) => (
            <Card
              key={packet.id}
              className="cursor-pointer hover:bg-accent transition-colors"
              onClick={() => navigate(`/investigations/${packet.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <Folder className="h-5 w-5" />
                      {packet.title}
                    </CardTitle>
                    {packet.description && (
                      <CardDescription className="mt-2">
                        {packet.description}
                      </CardDescription>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Badge className={getPriorityColor(packet.priority)}>
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {packet.priority.toUpperCase()}
                    </Badge>
                    <Badge className={getStatusColor(packet.status)}>
                      {getStatusIcon(packet.status)}
                      <span className="ml-1">{packet.status.toUpperCase()}</span>
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    {packet.content_count} {packet.content_count === 1 ? 'source' : 'sources'}
                  </span>
                  <span className="flex items-center gap-1">
                    <LinkIcon className="h-4 w-4" />
                    {packet.claim_count} {packet.claim_count === 1 ? 'claim' : 'claims'}
                  </span>
                  <span className="ml-auto">
                    Updated {new Date(packet.updated_at).toLocaleDateString()}
                  </span>
                </div>

                {packet.tags.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    {packet.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
