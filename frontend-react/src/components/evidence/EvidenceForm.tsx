import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface EvidenceFormProps {
  open: boolean
  onClose: () => void
  onSave: (data: EvidenceData) => Promise<void>
  initialData?: EvidenceData
  mode: 'create' | 'edit'
}

interface EvidenceData {
  title: string
  description: string
  source: string
  type: string
  url?: string
  tags?: string[]
  reliability: string
  credibility: string
}

const evidenceTypes = [
  'Document',
  'Web Page',
  'Image',
  'Video',
  'Audio',
  'Social Media',
  'Email',
  'Database',
  'API',
  'Government Data'
]

const reliabilityLevels = [
  'A - Completely Reliable',
  'B - Usually Reliable',
  'C - Fairly Reliable',
  'D - Not Usually Reliable',
  'E - Unreliable',
  'F - Cannot be Judged'
]

const credibilityLevels = [
  '1 - Confirmed',
  '2 - Probably True',
  '3 - Possibly True',
  '4 - Doubtful',
  '5 - Improbable',
  '6 - Cannot be Judged'
]

export function EvidenceForm({ open, onClose, onSave, initialData, mode }: EvidenceFormProps) {
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [source, setSource] = useState(initialData?.source || '')
  const [type, setType] = useState(initialData?.type || '')
  const [url, setUrl] = useState(initialData?.url || '')
  const [tags, setTags] = useState<string[]>(initialData?.tags || [])
  const [tagInput, setTagInput] = useState('')
  const [reliability, setReliability] = useState(initialData?.reliability || '')
  const [credibility, setCredibility] = useState(initialData?.credibility || '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !source.trim() || !type) {
      alert('Please fill in all required fields')
      return
    }

    setSaving(true)
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        source: source.trim(),
        type,
        url: url.trim() || undefined,
        tags,
        reliability,
        credibility
      })
      onClose()
    } catch (error) {
      console.error('Failed to save evidence:', error)
      alert('Failed to save evidence. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag))
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add New Evidence' : 'Edit Evidence'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Add a new piece of evidence to your collection'
              : 'Update the evidence details'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Evidence title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the evidence..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">Evidence Type *</Label>
              <Select value={type} onValueChange={setType} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {evidenceTypes.map(t => (
                    <SelectItem key={t} value={t.toLowerCase().replace(' ', '_')}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="source">Source *</Label>
              <Input
                id="source"
                placeholder="Source name..."
                value={source}
                onChange={(e) => setSource(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="reliability">Source Reliability</Label>
              <Select value={reliability} onValueChange={setReliability}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reliability" />
                </SelectTrigger>
                <SelectContent>
                  {reliabilityLevels.map(level => (
                    <SelectItem key={level} value={level.charAt(0)}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="credibility">Information Credibility</Label>
              <Select value={credibility} onValueChange={setCredibility}>
                <SelectTrigger>
                  <SelectValue placeholder="Select credibility" />
                </SelectTrigger>
                <SelectContent>
                  {credibilityLevels.map(level => (
                    <SelectItem key={level} value={level.charAt(0)}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="tags">Tags</Label>
            <div className="flex gap-2 mb-2">
              <Input
                id="tags"
                placeholder="Add a tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              />
              <Button type="button" onClick={addTag} size="sm">
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : mode === 'create' ? 'Add Evidence' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
