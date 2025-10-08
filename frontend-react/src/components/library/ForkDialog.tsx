import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { GitFork } from 'lucide-react'

interface ForkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  libraryFrameworkId: string
  frameworkTitle: string
  frameworkType: string
}

export function ForkDialog({
  open,
  onOpenChange,
  libraryFrameworkId,
  frameworkTitle,
  frameworkType,
}: ForkDialogProps) {
  const { t } = useTranslation(['library', 'common'])
  const { toast } = useToast()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const handleFork = async () => {
    const userHash = localStorage.getItem('omnicore_user_hash')
    if (!userHash) {
      toast({
        title: t('common:errors.error'),
        description: t('common:errors.loginRequired'),
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/library/fork', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Hash': userHash,
        },
        body: JSON.stringify({
          library_framework_id: libraryFrameworkId,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: t('common:success'),
          description: t('library:fork.success'),
        })
        onOpenChange(false)

        // Navigate to the forked framework
        if (data.forked_framework_id) {
          navigate(`/dashboard/frameworks/${frameworkType}/${data.forked_framework_id}`)
        }
      } else {
        toast({
          title: t('common:errors.error'),
          description: data.error || t('library:fork.error'),
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('[ForkDialog] Error:', error)
      toast({
        title: t('common:errors.error'),
        description: t('library:fork.error'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitFork className="h-5 w-5" />
            {t('library:fork.title')}
          </DialogTitle>
          <DialogDescription>{t('library:fork.description')}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2">
            <div className="font-semibold text-lg">{frameworkTitle}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {t('library:filters.type')}: <span className="font-medium">{frameworkType.toUpperCase()}</span>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            {t('library:fork.confirm')}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('common:cancel')}
          </Button>
          <Button onClick={handleFork} disabled={loading}>
            <GitFork className="h-4 w-4 mr-2" />
            {loading ? t('library:fork.forking') : t('library:fork.workspaceSelect')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
