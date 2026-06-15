import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useConsentStore } from '@/stores/consent'

/**
 * Sensitive-use consent dialog. Mounted once at the app root. Driven entirely
 * by the consent store — opens when a gated endpoint requires acknowledgement.
 */
export function SensitiveConsentDialog() {
  const open = useConsentStore((state) => state.open)
  const accept = useConsentStore((state) => state.accept)
  const cancel = useConsentStore((state) => state.cancel)

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Treat any dismissal (Escape, overlay) as a cancel
        if (!next) cancel()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Authorized-use acknowledgement</AlertDialogTitle>
          <AlertDialogDescription>
            Features such as entity and person profiling, relationship
            inference, and AI generation are provided for authorized, lawful
            research, OSINT, and educational use only. By continuing, you
            acknowledge that you are using these capabilities for a legitimate
            purpose. Misuse for harassment, stalking, or unlawful surveillance
            is strictly prohibited.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => cancel()}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => { void accept() }}>
            I acknowledge
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
