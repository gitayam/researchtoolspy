import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { InfoIcon, LogInIcon } from 'lucide-react'
import { useGuestMode } from '@/contexts/GuestModeContext'
import { useNavigate } from 'react-router-dom'

export function GuestModeBanner() {
  const { isGuest } = useGuestMode()
  const navigate = useNavigate()

  if (!isGuest) {
    return null
  }

  return (
    <Alert className="mb-4 border-blue-200 bg-blue-50">
      <InfoIcon className="h-4 w-4 text-blue-600" />
      <AlertTitle className="text-blue-900">Guest Mode</AlertTitle>
      <AlertDescription className="text-blue-800">
        You're exploring as a guest. Your work is saved locally for 7 days.
        <Button
          variant="link"
          className="ml-2 h-auto p-0 text-blue-600 hover:text-blue-800"
          onClick={() => navigate('/login')}
        >
          <LogInIcon className="mr-1 h-3 w-3" />
          Sign in to save permanently
        </Button>
      </AlertDescription>
    </Alert>
  )
}
