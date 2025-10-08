import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'

interface PublishDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  frameworkId: string
  frameworkType: string
  defaultTitle?: string
  defaultDescription?: string
}

export function PublishDialog({
  open,
  onOpenChange,
  frameworkId,
  frameworkType,
  defaultTitle = '',
  defaultDescription = '',
}: PublishDialogProps) {
  const { t } = useTranslation(['library', 'common'])
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: defaultTitle,
    description: defaultDescription,
    category: '',
    tags: '',
  })

  const handlePublish = async () => {
    const userHash = localStorage.getItem('omnicore_user_hash')
    if (!userHash) {
      toast({
        title: t('common:errors.error'),
        description: t('common:errors.loginRequired'),
        variant: 'destructive',
      })
      return
    }

    if (!formData.title.trim()) {
      toast({
        title: t('common:errors.error'),
        description: t('library:publish.form.titlePlaceholder'),
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/library', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Hash': userHash,
        },
        body: JSON.stringify({
          framework_id: frameworkId,
          framework_type: frameworkType,
          title: formData.title,
          description: formData.description,
          category: formData.category || null,
          tags: formData.tags,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: t('common:success'),
          description: t('library:publish.success'),
        })
        onOpenChange(false)
        setFormData({ title: '', description: '', category: '', tags: '' })
      } else {
        toast({
          title: t('common:errors.error'),
          description: data.error || t('library:publish.error'),
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('[PublishDialog] Error:', error)
      toast({
        title: t('common:errors.error'),
        description: t('library:publish.error'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t('library:publish.title')}</DialogTitle>
          <DialogDescription>{t('library:publish.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">{t('library:publish.form.title')}</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder={t('library:publish.form.titlePlaceholder')}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">{t('library:publish.form.description')}</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('library:publish.form.descriptionPlaceholder')}
              rows={4}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">{t('library:publish.form.category')}</Label>
            <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
              <SelectTrigger>
                <SelectValue placeholder={t('library:publish.form.categoryPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="adversary_analysis">{t('library:categories.adversary_analysis')}</SelectItem>
                <SelectItem value="friendly_analysis">{t('library:categories.friendly_analysis')}</SelectItem>
                <SelectItem value="host_nation">{t('library:categories.host_nation')}</SelectItem>
                <SelectItem value="strategic_planning">{t('library:categories.strategic_planning')}</SelectItem>
                <SelectItem value="operational_planning">{t('library:categories.operational_planning')}</SelectItem>
                <SelectItem value="tactical_analysis">{t('library:categories.tactical_analysis')}</SelectItem>
                <SelectItem value="intelligence">{t('library:categories.intelligence')}</SelectItem>
                <SelectItem value="deception">{t('library:categories.deception')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">{t('library:publish.form.tags')}</Label>
            <Input
              id="tags"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder={t('library:publish.form.tagsPlaceholder')}
            />
            <p className="text-xs text-gray-500">{t('library:publish.form.tagsHint')}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('common:cancel')}
          </Button>
          <Button onClick={handlePublish} disabled={loading}>
            {loading ? t('library:publish.publishing') : t('library:publish.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
