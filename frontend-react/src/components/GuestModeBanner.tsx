import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { InfoIcon, LogInIcon } from 'lucide-react'
import { useGuestMode } from '@/contexts/GuestModeContext'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export function GuestModeBanner() {
  const { t } = useTranslation('common')
  const { isGuest } = useGuestMode()
  const navigate = useNavigate()

  if (!isGuest) {
    return null
  }

  return (
    <Alert className="mb-4 border-blue-200 bg-blue-50">
      <InfoIcon className="h-4 w-4 text-blue-600" />
      <AlertTitle className="text-blue-900">{t('auth.guestMode')}</AlertTitle>
      <AlertDescription className="text-blue-800">
        {t('auth.guestModeMessage')}
        <Button
          variant="link"
          className="ml-2 h-auto p-0 text-blue-600 hover:text-blue-800"
          onClick={() => navigate('/login')}
        >
          <LogInIcon className="mr-1 h-3 w-3" />
          {t('auth.signInToSave')}
        </Button>
      </AlertDescription>
    </Alert>
  )
}
