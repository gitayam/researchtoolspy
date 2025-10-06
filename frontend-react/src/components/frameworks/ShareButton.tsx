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

interface ShareButtonProps {
  frameworkId: string
  frameworkType: string
  isPublic: boolean
  shareToken?: string
  category?: string
  onUpdate?: (data: { isPublic: boolean; shareToken?: string; category?: string }) => void
}

const CATEGORIES = [
  { value: 'health', label: 'Health' },
  { value: 'civic', label: 'Civic Engagement' },
  { value: 'economic', label: 'Economic' },
  { value: 'social', label: 'Social' },
  { value: 'environmental', label: 'Environmental' },
  { value: 'education', label: 'Education' },
]

export function ShareButton({
  frameworkId,
  frameworkType,
  isPublic: initialIsPublic,
  shareToken: initialShareToken,
  category: initialCategory,
  onUpdate
}: ShareButtonProps) {
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [shareToken, setShareToken] = useState(initialShareToken)
  const [category, setCategory] = useState(initialCategory || '')
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)

  const shareUrl = shareToken
    ? `${window.location.origin}/public/framework/${shareToken}`
    : null

  const handleTogglePublic = async (newIsPublic: boolean) => {
    setSharing(true)
    try {
      const response = await fetch(`/api/frameworks/${frameworkId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: newIsPublic, category })
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
          category: data.category
        })
      }
    } catch (error) {
      console.error('Failed to toggle sharing:', error)
      alert('Failed to update sharing settings')
    } finally {
      setSharing(false)
    }
  }

  const handleCategoryChange = async (newCategory: string) => {
    setCategory(newCategory)

    // If public, update category on server
    if (isPublic) {
      try {
        await fetch(`/api/frameworks/${frameworkId}/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_public: true, category: newCategory })
        })

        if (onUpdate) {
          onUpdate({ isPublic, shareToken, category: newCategory })
        }
      } catch (error) {
        console.error('Failed to update category:', error)
      }
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
      <DropdownMenuContent align="end" className="w-80">
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

          {/* Category Selection (only for behavior framework when public) */}
          {frameworkType === 'behavior' && isPublic && (
            <div className="space-y-2">
              <Label>Category (Optional)</Label>
              <Select value={category} onValueChange={handleCategoryChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <p>✓ Anyone can view your analysis (no login)</p>
                <p>✓ Anyone can clone to work with it</p>
                <p>✓ Logged-in users save to workspace</p>
                <p>✓ Guests save to local storage (7 days)</p>
              </div>
            </>
          )}

          {/* Private Info */}
          {!isPublic && (
            <div className="text-xs text-gray-600 dark:text-gray-400 pt-2 border-t">
              <p>🔒 Only you can access this analysis</p>
              <p className="mt-2">Enable public sharing to allow others to view and clone your work</p>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
