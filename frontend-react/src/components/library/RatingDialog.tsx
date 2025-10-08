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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Star } from 'lucide-react'

interface RatingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  libraryFrameworkId: string
  frameworkTitle: string
  currentRating?: number
  onRatingSubmitted?: () => void
}

export function RatingDialog({
  open,
  onOpenChange,
  libraryFrameworkId,
  frameworkTitle,
  currentRating = 0,
  onRatingSubmitted,
}: RatingDialogProps) {
  const { t } = useTranslation(['library', 'common'])
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [rating, setRating] = useState(currentRating)
  const [hoverRating, setHoverRating] = useState(0)
  const [reviewText, setReviewText] = useState('')

  const handleSubmit = async () => {
    const userHash = localStorage.getItem('omnicore_user_hash')
    if (!userHash) {
      toast({
        title: t('common:errors.error'),
        description: t('common:errors.loginRequired'),
        variant: 'destructive',
      })
      return
    }

    if (rating === 0) {
      toast({
        title: t('common:errors.error'),
        description: t('library:rate.yourRating'),
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/library/rate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Hash': userHash,
        },
        body: JSON.stringify({
          library_framework_id: libraryFrameworkId,
          rating,
          review_text: reviewText,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: t('common:success'),
          description: t('library:rate.success'),
        })
        onOpenChange(false)
        onRatingSubmitted?.()
        setRating(0)
        setReviewText('')
      } else {
        toast({
          title: t('common:errors.error'),
          description: data.error || t('library:rate.error'),
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('[RatingDialog] Error:', error)
      toast({
        title: t('common:errors.error'),
        description: t('library:rate.error'),
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
          <DialogTitle>{t('library:rate.title')}</DialogTitle>
          <DialogDescription>{frameworkTitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Star Rating */}
          <div className="space-y-2">
            <Label>{t('library:rate.yourRating')}</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-8 w-8 ${
                      star <= (hoverRating || rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-sm text-gray-600">
                {rating} / 5 {t('library:card.rating', { avg: rating, count: 1 })}
              </p>
            )}
          </div>

          {/* Review Text */}
          <div className="space-y-2">
            <Label htmlFor="review">{t('library:rate.writeReview')}</Label>
            <Textarea
              id="review"
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder={t('library:rate.reviewPlaceholder')}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('common:cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={loading || rating === 0}>
            {loading ? t('library:rate.submitting') : currentRating > 0 ? t('library:rate.update') : t('library:rate.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
