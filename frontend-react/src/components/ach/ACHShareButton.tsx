import { useState } from 'react'
import { Share2, Copy, Check, Globe, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ACHDomain } from '@/types/ach'

interface ACHShareButtonProps {
  analysisId: string
  isPublic: boolean
  shareToken?: string
  domain?: ACHDomain
  tags?: string[]
  onUpdate?: (data: { isPublic: boolean; shareToken?: string; domain?: string; tags?: string[] }) => void
}

const DOMAINS: { value: ACHDomain; label: string }[] = [
  { value: 'intelligence', label: 'Intelligence Analysis' },
  { value: 'security', label: 'Security & Law Enforcement' },
  { value: 'business', label: 'Business Strategy' },
  { value: 'research', label: 'Scientific Research' },
  { value: 'medical', label: 'Medical Diagnosis' },
  { value: 'legal', label: 'Legal Analysis' },
  { value: 'other', label: 'Other' },
]

export function ACHShareButton({
  analysisId,
  isPublic: initialIsPublic,
  shareToken: initialShareToken,
  domain: initialDomain,
  tags: initialTags,
  onUpdate
}: ACHShareButtonProps) {
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [shareToken, setShareToken] = useState(initialShareToken)
  const [domain, setDomain] = useState<ACHDomain | ''>(initialDomain || '')
  const [tags, setTags] = useState<string[]>(initialTags || [])
  const [newTag, setNewTag] = useState('')
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)

  const shareUrl = shareToken
    ? `${window.location.origin}/public/ach/${shareToken}`
    : null

  const handleTogglePublic = async (newIsPublic: boolean) => {
    setSharing(true)
    try {
      const response = await fetch(`/api/ach/${analysisId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: newIsPublic, domain, tags })
      })

      if (!response.ok) {
        throw new Error('Failed to update sharing settings')
      }

      const data = await response.json()
      setIsPublic(data.is_public)
      setShareToken(data.share_token)

      if (onUpdate) {
        onUpdate({
          isPublic: data.is_public,
          shareToken: data.share_token,
          domain: data.domain,
          tags: data.tags
        })
      }
    } catch (error) {
      console.error('Failed to toggle sharing:', error)
      alert('Failed to update sharing settings')
    } finally {
      setSharing(false)
    }
  }

  const handleDomainChange = async (newDomain: ACHDomain) => {
    setDomain(newDomain)

    // If public, update domain on server
    if (isPublic) {
      try {
        await fetch(`/api/ach/${analysisId}/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_public: true, domain: newDomain, tags })
        })

        if (onUpdate) {
          onUpdate({ isPublic, shareToken, domain: newDomain, tags })
        }
      } catch (error) {
        console.error('Failed to update domain:', error)
      }
    }
  }

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      const updatedTags = [...tags, newTag.trim()]
      setTags(updatedTags)
      setNewTag('')

      // If public, update tags on server
      if (isPublic) {
        fetch(`/api/ach/${analysisId}/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_public: true, domain, tags: updatedTags })
        }).then(() => {
          if (onUpdate) {
            onUpdate({ isPublic, shareToken, domain, tags: updatedTags })
          }
        }).catch(console.error)
      }
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = tags.filter(t => t !== tagToRemove)
    setTags(updatedTags)

    // If public, update tags on server
    if (isPublic) {
      fetch(`/api/ach/${analysisId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: true, domain, tags: updatedTags })
      }).then(() => {
        if (onUpdate) {
          onUpdate({ isPublic, shareToken, domain, tags: updatedTags })
        }
      }).catch(console.error)
    }
  }

  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          {isPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuLabel>Sharing Options</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="p-3 space-y-4">
          {/* Public/Private Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="font-medium">Public Access</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Anyone with the link can view and clone
              </p>
            </div>
            <Switch
              checked={isPublic}
              onCheckedChange={handleTogglePublic}
              disabled={sharing}
            />
          </div>

          {/* Domain Selection (when public) */}
          {isPublic && (
            <div className="space-y-2">
              <Label>Domain</Label>
              <Select value={domain} onValueChange={(value) => handleDomainChange(value as ACHDomain)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select domain" />
                </SelectTrigger>
                <SelectContent>
                  {DOMAINS.map(d => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Tags (when public) */}
          {isPublic && (
            <div className="space-y-2">
              <Label>Tags (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddTag()
                    }
                  }}
                  placeholder="Add tag..."
                  className="text-sm"
                />
                <Button type="button" size="sm" onClick={handleAddTag}>
                  Add
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {tags.map(tag => (
                    <div
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Share Link (when public) */}
          {isPublic && shareUrl && (
            <>
              <div className="space-y-2">
                <Label>Share Link</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={shareUrl}
                    className="text-xs"
                    onClick={(e) => e.currentTarget.select()}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyLink}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1 pt-2 border-t">
                <p>✓ Anyone can view your analysis</p>
                <p>✓ Logged-in users can clone and score independently</p>
                <p>✓ Original analysis attribution preserved</p>
                <p>✓ Cloned analyses start with blank scores</p>
              </div>
            </>
          )}

          {/* Private Info */}
          {!isPublic && (
            <div className="text-xs text-gray-600 dark:text-gray-400 pt-2 border-t">
              <p>🔒 Only you can access this analysis</p>
              <p className="mt-2">Enable public sharing to allow others to view and clone your intelligence analysis</p>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
